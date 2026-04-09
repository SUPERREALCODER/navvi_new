# NavVisor — Edge Computing Presentation Notes

## What is Edge Computing Here?

> Instead of sending camera frames to a **cloud server** for hazard detection, NavVisor runs the entire AI inference **locally on the Android device** — this is Edge Computing.

No internet needed for hazard detection. No latency. No privacy leaks. Everything is processed in real-time on the phone itself.

---

## The AI Model

| Property | Detail |
|----------|--------|
| **Model Type** | Object/Hazard Detection — TensorFlow Lite |
| **Format** | `.tflite` (INT4 Quantized) |
| **Quantization** | INT4 — ultra-lightweight, optimized for mobile |
| **Runtime** | `react-native-fast-tflite` (C++ native bindings) |
| **Acceleration** | Android GPU delegate (via OpenCL — `libOpenCL.so`) |
| **Input** | Raw camera frame buffer (`ArrayBuffer`) from Vision Camera |
| **Output** | Hazard probability score (0.0 – 1.0) |
| **Threshold** | > 0.7 = Hazard Detected |

---

## Edge Computing Architecture

```
📷 Camera Frame
      │
      ▼  (on-device, 30fps)
┌─────────────────────────┐
│   Vision Camera          │
│   Frame Processor        │  ← runs in a JS Worklet (separate thread)
│   (react-native-vision-camera) │
└──────────┬──────────────┘
           │ raw pixel buffer
           ▼
┌─────────────────────────┐
│   TFLite Inference Engine│
│   (react-native-fast-tflite) │  ← C++ native, GPU accelerated
│   hazards_int4.tflite   │
└──────────┬──────────────┘
           │ probability score
           ▼
   isHazard = prob > 0.7?
           │
    ┌──────┴──────┐
    │             │
   YES            NO
    │             │
🚨 Alert UI   ✅ Safe UI
    │
    ▼
📡 Bluetooth → ESP32
   (HAZ:1 via serial)
    │
    ▼
💡 LED + 📳 Haptic Vibration
```

---

## Key Technologies Used

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Camera** | `react-native-vision-camera` | High-performance frame capture at 30fps |
| **Frame Processing** | `react-native-worklets-core` | Runs inference on a non-blocking JS thread |
| **AI Inference** | `react-native-fast-tflite` | Runs TFLite models natively via C++ |
| **GPU Acceleration** | Android GPU Delegate + OpenCL | Hardware-accelerated matrix math |
| **Model Format** | TFLite INT4 Quantized | 4x smaller than FP32, runs on any ARM device |
| **Communication** | Bluetooth Classic | Sends hazard alerts to ESP32 hardware |
| **Hardware Response** | ESP32 + LED + Vibration Motor | Physical alerts for the visually impaired |

---

## Why Edge Computing? (Presentation Points)

- **⚡ Ultra-Low Latency**: Hazard detection in <50ms — cloud would add 200–500ms
- **📶 Offline-First**: Works without internet — critical for street navigation
- **🔒 Privacy Preserving**: Camera frames never leave the device
- **🔋 Power Efficient**: INT4 quantization reduces compute by 4x vs full precision
- **📱 On-Device AI**: Runs on any mid-range Android phone — no server cost
- **🦾 Hardware Integration**: Directly triggers physical haptic + LED alerts via BT

---

## The Full Pipeline (One Sentence)

> **NavVisor captures live camera frames → runs a quantized TFLite hazard model directly on the phone's GPU → and in <50ms, triggers both an in-app alert AND a physical vibration/LED on the wearable ESP32 device — all without a single cloud API call.**

---

## What "INT4 Quantized" Means (Simple)

- A normal AI model stores weights as 32-bit floats (FP32)
- INT4 stores them as 4-bit integers — **8x smaller in memory, 4x faster**
- Almost no accuracy loss for detection tasks
- Makes it possible to run real-time inference at 30fps on a phone

---

## Presentation Talking Points

1. **The problem**: Visually impaired pedestrians have no real-time spatial awareness
2. **The solution**: An Android app + ESP32 wearable that detects hazards in real-time using on-device AI
3. **The edge computing angle**: All AI runs locally — no cloud, no latency, no internet dependency
4. **The hardware loop**: Phone detects hazard → sends Bluetooth packet → ESP32 fires vibration motor
5. **The navigation layer**: OpenStreetMap + OSRM — fully open-source, no paid APIs
6. **The innovation**: Combining edge AI, BLE hardware control, and open-source mapping in a single wearable nav system
