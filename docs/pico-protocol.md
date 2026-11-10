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

## Connection: decide before the hardware step

Browsers only allow the camera on secure (https) pages, and a secure page is not allowed to open a plain `ws://` connection to the Pico. Test one of these on the MatePad early:

1. **MQTT through a free cloud broker** (for example HiveMQ Cloud free tier, private login). The Pico publishes with MicroPython `umqtt` over TLS; the app connects with secure WebSockets. Also shows the IoT cloud link to judges. Needs internet at the station.
2. **Secure WebSocket on the Pico** (`wss://`) with a self-signed certificate. Open `https://<pico address>` once on the tablet and accept the certificate. Works without internet, but TLS uses much of the Pico W's memory.
3. **Bluetooth (Web Bluetooth)** from Chrome on Android. The Pico W supports Bluetooth Low Energy. Works without internet; check that the tablet's browser supports it.

Whichever you pick, only `PicoWS` in `js/pico.js` changes.
