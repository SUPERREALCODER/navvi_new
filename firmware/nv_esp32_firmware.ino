#include "BluetoothSerial.hpp"

#if !defined(CONFIG_BT_ENABLED) || !defined(CONFIG_BLUEDROID_ENABLED)
#error Bluetooth is not enabled! Please run `make menuconfig` to and enable it
#endif

BluetoothSerial SerialBT;

// Pins for alerts
const int HAZARD_LED_PIN = 2; // Internal LED or external hazard indicator
const int HAPTIC_PIN = 4;     // Vibration motor pin

void setup() {
  Serial.begin(115200);
  SerialBT.begin("NavVisor_ESP32"); // Bluetooth device name
  Serial.println("NavVisor ESP32 Started. Ready to pair.");

  pinMode(HAZARD_LED_PIN, OUTPUT);
  pinMode(HAPTIC_PIN, OUTPUT);
}

void loop() {
  if (SerialBT.available()) {
    String data = SerialBT.readStringUntil('\n');
    data.trim();
    Serial.print("Received: ");
    Serial.println(data);

    parseTelemetry(data);
  }
  delay(20);
}

void parseTelemetry(String data) {
  // Format: DIST:<dist>;DIR:<dir>;HAZ:<0/1>
  // Example: DIST:12.5;DIR:R;HAZ:1

  int distIdx = data.indexOf("DIST:");
  int dirIdx = data.indexOf(";DIR:");
  int hazIdx = data.indexOf(";HAZ:");

  if (distIdx != -1 && dirIdx != -1 && hazIdx != -1) {
    String dist = data.substring(distIdx + 5, dirIdx);
    String dir = data.substring(dirIdx + 5, hazIdx);
    String haz = data.substring(hazIdx + 5);

    Serial.printf("Distance: %s m, Direction: %s, Hazard: %s\n", dist.c_str(), dir.c_str(), haz.c_str());

    // Act on Hazard Alert
    if (haz == "1") {
      digitalWrite(HAZARD_LED_PIN, HIGH);
      digitalWrite(HAPTIC_PIN, HIGH);
      Serial.println("!!! HAZARD DETECTED !!!");
    } else {
      digitalWrite(HAZARD_LED_PIN, LOW);
      digitalWrite(HAPTIC_PIN, LOW);
    }

    // Feedback for Direction (example)
    if (dir == "L") {
      // Logic for left turn
    } else if (dir == "R") {
      // Logic for right turn
    }
  }
}
