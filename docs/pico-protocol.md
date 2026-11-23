# Pico W messages

The tablet and the Pico W exchange small JSON messages. The app's simulator sends exactly the same messages, so when the real Pico speaks this format, switching Settings > Pico W to Live is the only change.

## Pico W to tablet

| Message | When | Example |
| --- | --- | --- |
| hello | On connect | `{"type":"hello","fw":"1.0"}` |
| pong | Reply to ping | `{"type":"pong","fw":"1.0"}` |
| status | Every second, and on change | `{"type":"status","hr_ok":true,"finger":false,"chest":431,"abd":527,"belts_ok":true}` |
| hr | About twice a second | `{"type":"hr","bpm":78.4,"q":0.96}` (`q` is signal quality 0 to 1 from the heart-signal filter) |
| belts | 10 to 20 times a second | `{"type":"belts","c":431.2,"a":527.9}` (raw potentiometer readings) |
| breath | Shortly after each paced breath ends | `{"type":"breath","n":3,"label":"diaphragmatic","conf":0.91,"chest_amp":20.1,"abd_amp":88.4,"rejected":false}` |
| servo | Every few seconds while the lung model mirrors | `{"type":"servo","latency_ms":118}` (belt change to servo movement) |

`label` is `diaphragmatic`, `thoracic` or `unclear`. `rejected` is true when the breath filter thinks the breath was spoiled (talking, moving).

## Tablet to Pico W

| Message | Meaning |
| --- | --- |
| `{"type":"ping"}` | Reply with pong |
| `{"type":"mode","mode":"idle"}` | `idle`, `calibrate` (record the student's normal breathing as the baseline) or `trial` |
| `{"type":"pace","phase":"in","dur_ms":4000,"breath":3}` | The tablet starts each paced phase. `phase` is `in`, `out`, `gap` (breath finished) or `rest`. Classify breath `n` when its `out` phase ends |
| `{"type":"mirror","on":true}` | Lung model follows the abdominal belt, or stops |
| `{"type":"demo"}` | Lung model runs its own slow diaphragmatic demo (question C1) |

The tablet measures breath response time itself: from the moment it ends the `out` phase to the moment the `breath` message arrives. No clock syncing is needed.

## Connection: Bluetooth Low Energy (chosen and tested)

Tested on the station's Huawei MatePad 11.5 PaperMatte in Chrome: Web Bluetooth works there (the device list appears). The plain `ws://` route is blocked because the app is an https page, so the Pico W talks to the tablet over Bluetooth Low Energy and never needs Wi-Fi.

```
Pico W  --Bluetooth LE (Nordic UART service, JSON lines)-->  tablet app  --tablet Wi-Fi / mobile data (https)-->  Google Sheet
         <--pace, mode, mirror, demo, ping------------------                (saved on the tablet first, in IndexedDB)
```

* **Service:** Nordic UART, `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`. The Pico notifies on TX `6E400003-...`; the tablet writes to RX `6E400002-...`.
* **Framing:** one JSON message per line, ending in `\n`. A Bluetooth packet carries 20 bytes unless a bigger size is agreed, so long lines are cut into pieces; the receiver joins pieces until it sees `\n`.
* **Name:** the Pico advertises as `LittleLungs`. The app's station check asks the operator to tap Connect and choose it once per app start (browsers only open the Bluetooth list after a tap). If the link drops, the app reconnects every 2 s by itself.
* **Settings:** Settings > Pico W > *Live Pico W (Bluetooth)*. The WebSocket mode stays only for bench tests from a laptop.
* **Firmware:** `pico/main.py` (MicroPython 1.20 or newer on the Pico W).

## Where the data goes

1. **On the Pico:** nothing is stored; it measures and sends.
2. **On the tablet:** the whole session (every tap, answer, placement, breath and the raw belt and heart-rate stream) is saved in the browser's IndexedDB as it happens and again every 10 s. Works with no internet.
3. **In the cloud:** every 10 s during a session the app sends new rows to the Google Sheet (`type: "live"`): Roster and Sessions rows are replaced, other rows are appended, including one **Sensors** row per second (belt min/mean/max, heart rate, signal quality). When the session ends, a full upload replaces all of that session's rows, which also removes any duplicate live rows. Offline rows wait and upload when the internet is back.
