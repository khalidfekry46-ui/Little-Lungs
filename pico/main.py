"""
LITTLE LUNGS - Pico W firmware (Bluetooth version)
MicroPython 1.20 or newer on a Raspberry Pi Pico W. Save on the Pico as main.py.

What it does
  * Reads the chest belt and the abdomen belt (slide potentiometers) 50 times a second.
  * Reads the MAX30100 or MAX30102 heart sensor 100 times a second and finds heart beats.
  * Labels each paced breath diaphragmatic / thoracic / unclear when the tablet says it ended.
  * Moves the lung-model servo with the abdomen belt ("mirror") or runs a slow demo.
  * Talks to the tablet app over Bluetooth Low Energy (Nordic UART service), using the
    JSON messages in docs/pico-protocol.md, one message per line.
  * Prints a 1-second table in Thonny's Shell for bench checks.

No Wi-Fi is used: the tablet uploads to the cloud over its own internet connection.

Wiring (change the numbers below if yours differ)
  Chest belt slide pot   OTA -> GP26 (pin 31)   VCC -> 3V3 (pin 36)   GND -> GND
  Abdomen belt slide pot OTA -> GP27 (pin 32)   VCC -> 3V3            GND -> GND
  Heart sensor           SDA -> GP4 (pin 6)     SCL -> GP5 (pin 7)    VIN -> 3V3   GND -> GND
  Servo                  signal -> GP15 (pin 20); red -> step-down OUT+ (5 V); brown -> OUT- (common GND)
"""
import bluetooth
import machine
import uasyncio as asyncio
import ujson
import utime
import gc
import math
from micropython import const

FW = "2.0-ble"
NAME = "LittleLungs"

# ---------------------------------------------------------------- settings
CHEST_PIN = 26          # ADC pin of the chest belt, or None if not fitted
ABD_PIN = 27            # ADC pin of the abdomen belt, or None if not fitted
I2C_BUS, SDA_PIN, SCL_PIN = 0, 4, 5
SERVO_PIN = 15
SERVO_MIN_US, SERVO_MAX_US = 1000, 2000      # 0 deg and 180 deg; MG995/MG996R accept 1.0-2.0 ms
SERVO_REST_DEG, SERVO_FULL_DEG = 0, 90        # lung model: relaxed and fully pulled diaphragm
BELT_SCALE = 1000 / 65535                     # belt values sent as 0-1000
DIAPHRAGM_SHARE = 0.60   # share of (normalised) movement from the abdomen at or above this = diaphragmatic
THORACIC_SHARE = 0.40    # at or below this = thoracic; in between = unclear
MIN_BREATH = 0.5         # chest + abdomen movement below half of one normal breath = too small, rejected

# ---------------------------------------------------------------- heart sensor
class Heart:
    """MAX30100 (part 0x11) or MAX30102 (part 0x15) at address 0x57, red + infrared, 100 samples a second."""
    ADDR = 0x57

    def __init__(self, i2c):
        self.i2c = i2c
        part = self.r(0xFF)
        if part == 0x11:
            self.kind, self.full = "MAX30100", 65535
            self.w(0x06, 0x40); utime.sleep_ms(50)
            self.w(0x02, 0); self.w(0x03, 0); self.w(0x04, 0)
            self.w(0x07, 0x47)   # high resolution, 100 samples/s, 1600 us
            self.w(0x09, 0x88)   # red 27.1 mA, IR 27.1 mA
            self.w(0x06, 0x03)   # SpO2 mode
        elif part == 0x15:
            self.kind, self.full = "MAX30102", 262143
            self.w(0x09, 0x40); utime.sleep_ms(50)
            self.w(0x04, 0); self.w(0x05, 0); self.w(0x06, 0)
            self.w(0x08, 0x50)   # average 4, roll over
            self.w(0x0A, 0x2F)   # 4096 nA, 400/s (100/s after averaging), 411 us
            self.w(0x0C, 0x24); self.w(0x0D, 0x24)
            self.w(0x09, 0x03)
        else:
            raise RuntimeError("part ID 0x{:02X}".format(part))

    def r(self, reg):
        return self.i2c.readfrom_mem(self.ADDR, reg, 1)[0]

    def w(self, reg, val):
        self.i2c.writeto_mem(self.ADDR, reg, bytes([val]))

    def samples(self):
        """All IR values waiting in the sensor's memory (oldest first)."""
        out = []
        if self.kind == "MAX30100":
            n = (self.r(0x02) - self.r(0x04)) & 0x0F
            if n:
                b = self.i2c.readfrom_mem(self.ADDR, 0x05, 4 * n)
                for k in range(0, 4 * n, 4):
                    out.append((b[k] << 8) | b[k + 1])
        else:
            n = (self.r(0x04) - self.r(0x06)) & 0x1F
            if n:
                b = self.i2c.readfrom_mem(self.ADDR, 0x07, 6 * n)
                for k in range(0, 6 * n, 6):
                    out.append(((b[k + 3] << 16) | (b[k + 4] << 8) | b[k + 5]) & 0x3FFFF)
        return out


class BeatFinder:
    """Heart beats from the infrared signal (photoplethysmography).

    Blood in the fingertip absorbs infrared light, so each beat makes a small dip in the
    reflected light. Steps: remove the slow baseline (high-pass), smooth (low-pass), flip so
    beats are peaks, find peaks above half of the recent peak height, at least 0.33 s apart
    (180 bpm), and turn the gaps between beats into beats per minute."""

    def __init__(self, rate_hz=100, finger_level=0.08, full=65535):
        self.dt = 1000 / rate_hz
        self.finger_dc = finger_level * full
        self.dc = 0.0
        self.lp = 0.0
        self.prev = 0.0
        self.prev2 = 0.0
        self.peak_h = 0.0
        self.t = 0.0
        self.last_beat = None
        self.gaps = []
        self.bpm = 0.0
        self.q = 0.0
        self.finger = False

    def add(self, ir):
        self.t += self.dt
        if self.dc == 0:
            self.dc = ir
        self.dc += (ir - self.dc) * 0.02            # baseline, about 0.5 s
        self.finger = self.dc > self.finger_dc
        ac = -(ir - self.dc)                          # beats become peaks
        self.lp += (ac - self.lp) * 0.25              # smoothing
        x = self.lp
        self.peak_h *= 0.995                          # slowly forget old peak heights
        beat = False
        # prev is a local maximum and tall enough
        if self.prev > self.prev2 and self.prev >= x and self.prev > 0.5 * self.peak_h and self.prev > 0:
            if self.last_beat is None or self.t - self.last_beat >= 330:
                if self.last_beat is not None:
                    gap = self.t - self.last_beat
                    if 330 <= gap <= 2000:
                        self.gaps.append(gap)
                        self.gaps = self.gaps[-6:]
                self.last_beat = self.t
                beat = True
        self.peak_h = max(self.peak_h, self.prev)
        self.prev2, self.prev = self.prev, x
        if self.last_beat is not None and self.t - self.last_beat > 3000:
            self.gaps = []                            # no beat for 3 s: start again
        if len(self.gaps) >= 3 and self.finger:
            g = sorted(self.gaps)
            med = g[len(g) // 2]
            mean = sum(self.gaps) / len(self.gaps)
            sd = (sum((v - mean) ** 2 for v in self.gaps) / len(self.gaps)) ** 0.5
            self.bpm = 60000 / med
            self.q = max(0.0, min(1.0, 1 - sd / mean / 0.25)) if self.finger else 0.0
        else:
            self.bpm, self.q = 0.0, 0.0
        return beat


class BreathJudge:
    """Labels one paced breath from how much each belt moved.

    During calibration the student breathes normally; the typical size of a normal breath on
    each belt is saved, so a loose belt and a tight belt count equally. For each paced breath,
    each belt's movement (highest minus lowest) is divided by its normal size, and the share
    coming from the abdomen decides the label."""

    def __init__(self):
        self.base_c = None
        self.base_a = None
        self.low_a = None
        self.cal_c = []
        self.cal_a = []
        self.reset_breath()

    def reset_breath(self):
        self.n = None
        self.c_lo = self.a_lo = 1e9
        self.c_hi = self.a_hi = -1e9

    def calibrate_add(self, c, a):
        if len(self.cal_c) < 3000:
            self.cal_c.append(c); self.cal_a.append(a)

    def calibrate_end(self):
        def spread(v):
            if len(v) < 20:
                return None
            s = sorted(v)
            return max(5.0, s[int(len(s) * 0.95)] - s[int(len(s) * 0.05)])
        def low(v):
            return sorted(v)[int(len(v) * 0.05)] if len(v) >= 20 else None
        self.base_c, self.base_a = spread(self.cal_c), spread(self.cal_a)
        self.low_a = low(self.cal_a)          # abdomen fully breathed out: the servo's 0 position
        self.cal_c, self.cal_a = [], []

    def track(self, c, a):
        if self.n is None:
            return
        self.c_lo = min(self.c_lo, c); self.c_hi = max(self.c_hi, c)
        self.a_lo = min(self.a_lo, a); self.a_hi = max(self.a_hi, a)

    def judge(self, two_belts):
        c_amp = max(0.0, self.c_hi - self.c_lo)
        a_amp = max(0.0, self.a_hi - self.a_lo)
        out = {"type": "breath", "n": self.n, "chest_amp": round(c_amp, 1), "abd_amp": round(a_amp, 1)}
        if not two_belts:
            out.update(label="unclear", conf=0.0, rejected=True, note="one belt fitted")
            return out
        bc = self.base_c or 20.0
        ba = self.base_a or 20.0
        cn, an = c_amp / bc, a_amp / ba
        share = an / (an + cn) if an + cn > 0 else 0.5
        label = "diaphragmatic" if share >= DIAPHRAGM_SHARE else "thoracic" if share <= THORACIC_SHARE else "unclear"
        rejected = (cn + an) < MIN_BREATH
        out.update(label="unclear" if rejected else label, conf=round(min(0.99, 0.5 + abs(share - 0.5)), 2),
                   rejected=rejected, share=round(share, 3))
        return out


# ---------------------------------------------------------------- Bluetooth (Nordic UART service)
_IRQ_CONNECT = const(1)
_IRQ_DISCONNECT = const(2)
_IRQ_WRITE = const(3)
_IRQ_MTU = const(21)
_UART = bluetooth.UUID("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
_TX = (bluetooth.UUID("6E400003-B5A3-F393-E0A9-E50E24DCCA9E"), 0x0002 | 0x0010)   # read, notify
_RX = (bluetooth.UUID("6E400002-B5A3-F393-E0A9-E50E24DCCA9E"), 0x0004 | 0x0008)   # write (with/without response)


class Link:
    """Bluetooth link to the tablet. Messages are JSON lines; long lines are split into
    pieces that fit one Bluetooth packet, and the app joins them again."""

    def __init__(self, on_message):
        self.on_message = on_message
        self.ble = bluetooth.BLE()
        self.ble.active(True)
        try:
            self.ble.config(gap_name=NAME)
            self.ble.config(mtu=247)
        except Exception:
            pass
        ((self.tx, self.rx),) = self.ble.gatts_register_services(((_UART, (_TX, _RX)),))
        self.ble.gatts_set_buffer(self.rx, 256, True)
        self.ble.irq(self.irq)
        self.conn = None
        self.chunk = 20
        self.inbox = b""
        self.just_connected = False
        self.advertise()

    def advertise(self):
        name = NAME.encode()
        adv = bytes([2, 0x01, 0x06]) + bytes([len(name) + 1, 0x09]) + name
        uid = bytes(_UART)
        resp = bytes([len(uid) + 1, 0x07]) + uid
        self.ble.gap_advertise(100_000, adv_data=adv, resp_data=resp)

    def irq(self, event, data):
        if event == _IRQ_CONNECT:
            self.conn = data[0]
            self.chunk = 20
            self.just_connected = True
        elif event == _IRQ_DISCONNECT:
            self.conn = None
            self.advertise()
        elif event == _IRQ_WRITE:
            self.inbox += self.ble.gatts_read(self.rx)
            while b"\n" in self.inbox:
                line, self.inbox = self.inbox.split(b"\n", 1)
                try:
                    self.on_message(ujson.loads(line))
                except Exception:
                    pass
            if len(self.inbox) > 512:
                self.inbox = b""
        elif event == _IRQ_MTU:
            self.chunk = max(20, data[1] - 3)

    def send(self, obj, important=False):
        if self.conn is None:
            return False
        data = (ujson.dumps(obj) + "\n").encode()
        for i in range(0, len(data), self.chunk):
            part = data[i:i + self.chunk]
            for attempt in range(20 if important else 1):
                try:
                    self.ble.gatts_notify(self.conn, self.tx, part)
                    break
                except OSError:
                    if not important:
                        return False
                    utime.sleep_ms(5)
            else:
                return False
        return True


# ---------------------------------------------------------------- the station
class Station:
    def __init__(self):
        self.chest = machine.ADC(CHEST_PIN) if CHEST_PIN is not None else None
        self.abd = machine.ADC(ABD_PIN) if ABD_PIN is not None else None
        self.c = self.a = 0.0
        self.heart = None
        try:
            self.heart = Heart(machine.I2C(I2C_BUS, sda=machine.Pin(SDA_PIN), scl=machine.Pin(SCL_PIN), freq=400_000))
        except Exception as e:
            print("[HEART] not found:", e)
        self.beats = BeatFinder(full=self.heart.full if self.heart else 65535)
        self.judge = BreathJudge()
        self.mode = "idle"
        self.phase = "rest"
        self.mirror = False
        self.demo_until = 0
        self.demo_start = 0
        self.pwm = machine.PWM(machine.Pin(SERVO_PIN))
        self.pwm.freq(50)
        self.servo_deg = SERVO_REST_DEG
        self.servo_ms = []           # belt reading to servo command, ms
        self.outbox = []             # important messages waiting to be sent
        self.link = Link(self.command)
        self.set_servo(SERVO_REST_DEG)

    # -------- servo
    def set_servo(self, deg):
        deg = max(0, min(180, deg))
        self.servo_deg = deg
        self.pwm.duty_ns(int((SERVO_MIN_US + (SERVO_MAX_US - SERVO_MIN_US) * deg / 180) * 1000))

    def belt_for_servo(self):
        """Abdomen belt as 0-1 between the student's calibrated low and high (or the full range)."""
        v = self.a if self.abd else self.c
        lo, span = 0.0, 1000.0
        if self.judge.base_a and self.judge.low_a is not None and self.abd:
            lo, span = self.judge.low_a, self.judge.base_a * 1.5
        return max(0.0, min(1.0, (v - lo) / span)) if span > 0 else 0.0

    # -------- messages from the tablet
    def command(self, m):
        t = m.get("type")
        if t == "ping":
            self.outbox.append({"type": "pong", "fw": FW})
        elif t == "mode":
            new = m.get("mode", "idle")
            if self.mode == "calibrate" and new != "calibrate":
                self.judge.calibrate_end()
            self.mode = new
        elif t == "pace":
            ph, n = m.get("phase"), m.get("breath")
            if self.phase == "out" and ph != "out" and self.judge.n is not None and self.mode == "trial":
                self.outbox.append(self.judge.judge(self.chest is not None and self.abd is not None))
                self.judge.reset_breath()
            if ph == "in" and n is not None:
                self.judge.reset_breath()
                self.judge.n = n
            self.phase = ph
        elif t == "mirror":
            self.mirror = bool(m.get("on"))
            if not self.mirror:
                self.set_servo(SERVO_REST_DEG)
        elif t == "demo":
            self.demo_start = utime.ticks_ms()
            self.demo_until = utime.ticks_add(self.demo_start, 4 * 8000)

    # -------- 50 times a second
    def sample(self):
        t0 = utime.ticks_us()
        if self.chest:
            self.c += (self.chest.read_u16() * BELT_SCALE - self.c) * 0.5
        if self.abd:
            self.a += (self.abd.read_u16() * BELT_SCALE - self.a) * 0.5
        if self.mode == "calibrate":
            self.judge.calibrate_add(self.c, self.a)
        self.judge.track(self.c, self.a)
        if self.heart:
            try:
                for ir in self.heart.samples():
                    self.beats.add(ir)
            except OSError:
                pass
        now = utime.ticks_ms()
        if utime.ticks_diff(self.demo_until, now) > 0:
            x = (utime.ticks_diff(now, self.demo_start) % 8000) / 8000     # 4 s in, 4 s out
            self.set_servo(SERVO_REST_DEG + (SERVO_FULL_DEG - SERVO_REST_DEG) * (0.5 - 0.5 * math.cos(2 * math.pi * x)))
        elif self.mirror:
            target = SERVO_REST_DEG + (SERVO_FULL_DEG - SERVO_REST_DEG) * self.belt_for_servo()
            self.set_servo(self.servo_deg + (target - self.servo_deg) * 0.35)
            self.servo_ms.append(utime.ticks_diff(utime.ticks_us(), t0) / 1000)
            self.servo_ms = self.servo_ms[-50:]

    def belts_ok(self):
        vals = [v for v, on in ((self.c, self.chest), (self.a, self.abd)) if on]
        return bool(vals) and all(20 < v < 980 for v in vals)

    def status(self):
        return {"type": "status", "hr_ok": self.heart is not None, "finger": self.beats.finger,
                "chest": round(self.c, 1), "abd": round(self.a, 1), "belts_ok": self.belts_ok()}


async def sampler(st):
    while True:
        st.sample()
        await asyncio.sleep_ms(20)


async def sender(st):
    k = 0
    while True:
        link = st.link
        if link.just_connected:
            link.just_connected = False
            link.send({"type": "hello", "fw": FW}, True)
            link.send(st.status(), True)
        while st.outbox:
            link.send(st.outbox.pop(0), True)
        link.send({"type": "belts", "c": round(st.c, 1), "a": round(st.a, 1)})
        if k % 5 == 0:
            link.send({"type": "hr", "bpm": round(st.beats.bpm, 1), "q": round(st.beats.q, 2)})
        if k % 10 == 0:
            link.send(st.status())
        if k % 50 == 0 and st.mirror and st.servo_ms:
            link.send({"type": "servo", "latency_ms": round(sum(st.servo_ms) / len(st.servo_ms), 1)})
        k += 1
        await asyncio.sleep_ms(100)          # belts 10 times a second


async def bench_log(st):
    n = 0
    while True:
        if n % 15 == 0:
            print("TIME  | LINK | MODE      | CHEST | ABD   | FINGER | BPM   | Q    | SERVO | RAM")
        print("{:4d}s | {:4} | {:9} | {:5.0f} | {:5.0f} | {:6} | {:5.1f} | {:4.2f} | {:5.1f} | {}".format(
            n, "on" if st.link.conn is not None else "--", st.mode, st.c, st.a, "yes" if st.beats.finger else "no",
            st.beats.bpm, st.beats.q, st.servo_deg, gc.mem_free()))
        n += 1
        gc.collect()
        await asyncio.sleep_ms(1000)


async def main():
    print("Little Lungs Pico W firmware", FW, "- advertising as", NAME)
    st = Station()
    print("Heart sensor:", st.heart.kind if st.heart else "none")
    asyncio.create_task(sampler(st))
    asyncio.create_task(sender(st))
    await bench_log(st)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Stopped.")
