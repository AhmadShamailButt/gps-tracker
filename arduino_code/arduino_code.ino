#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <ESP32Servo.h>

// ── WiFi ──────────────────────────────────────────────
const char* ssid     = "Ezza iPhone";
const char* password = "ezza1235";

// ── Azure IoT Hub ─────────────────────────────────────
const char* iotHubHost = "gps-tracker-hub.azure-devices.net";
const char* deviceId   = "gps-tracker-1";
const char* sasToken   = "SharedAccessSignature sr=gps-tracker-hub.azure-devices.net%2Fdevices%2Fgps-tracker-1&sig=RdOYFmF0NXzpPJRhgxOZazWkdxbFmF3XAvG%2FhVfSTr4%3D&se=1809528554";
const char* mqttTopic  = "devices/gps-tracker-1/messages/events/";

// ── Pin Definitions ───────────────────────────────────
#define LED_GREEN  2
#define LED_RED    4
#define BUZZER     5
#define SERVO_PIN  18

// ── Objects ───────────────────────────────────────────
HardwareSerial gpsSerial(2);
TinyGPSPlus gps;
WiFiClientSecure net;
PubSubClient mqtt(net);
Servo statusServo;

unsigned long lastSend = 0;
bool alertActive = false;

// ─────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected: " + WiFi.localIP().toString());
  // WiFi connected indicator — short double beep
  digitalWrite(BUZZER, HIGH); delay(100);
  digitalWrite(BUZZER, LOW);  delay(100);
  digitalWrite(BUZZER, HIGH); delay(100);
  digitalWrite(BUZZER, LOW);
}

void connectMQTT() {
  mqtt.setServer(iotHubHost, 8883);
  String clientId = String(deviceId);
  String username = String(iotHubHost) + "/" + deviceId + "/?api-version=2021-04-12";

  Serial.print("Connecting to IoT Hub");
  while (!mqtt.connected()) {
    if (mqtt.connect(clientId.c_str(), username.c_str(), sasToken)) {
      Serial.println("\nIoT Hub Connected!");
      // IoT Hub connected — green LED on
      digitalWrite(LED_GREEN, HIGH);
      digitalWrite(LED_RED, LOW);
      statusServo.write(0); // normal position
    } else {
      Serial.print(".");
      delay(3000);
    }
  }
}

void setNormalState() {
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER, LOW);
  statusServo.write(0);   // 0° = normal
  alertActive = false;
}

void setAlertState() {
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, HIGH);
  digitalWrite(BUZZER, HIGH);
  statusServo.write(180); // 180° = alert
  alertActive = true;
}

void sendToAzure(float lat, float lng, float speed, int sats) {
  StaticJsonDocument<256> doc;
  doc["deviceId"]   = deviceId;
  doc["lat"]        = lat;
  doc["lng"]        = lng;
  doc["speed"]      = speed;
  doc["satellites"] = sats;
  doc["alert"]      = alertActive;

  char payload[256];
  serializeJson(doc, payload);

  if (mqtt.publish(mqttTopic, payload)) {
    Serial.printf("✓ Sent: %s\n", payload);
  } else {
    Serial.println("✗ Publish failed — reconnecting");
    connectMQTT();
  }
}

// ─────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);

  // Init pins
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED,   OUTPUT);
  pinMode(BUZZER,    OUTPUT);
  statusServo.attach(SERVO_PIN);

  // Startup sequence — all off
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED,   LOW);
  digitalWrite(BUZZER,    LOW);
  statusServo.write(0);

  // Startup indicator — sweep servo once
  Serial.println("System starting...");
  statusServo.write(0);   delay(500);
  statusServo.write(90);  delay(500);
  statusServo.write(180); delay(500);
  statusServo.write(0);   delay(500);

  connectWiFi();
  net.setInsecure();
  connectMQTT();

  Serial.println("Waiting for GPS fix...");
  digitalWrite(LED_GREEN, HIGH); // green = searching for GPS
}

void loop() {
  // Feed GPS
  while (gpsSerial.available())
    gps.encode(gpsSerial.read());

  // Keep MQTT alive
  if (!mqtt.connected()) {
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, HIGH); // red = disconnected
    connectMQTT();
  }
  mqtt.loop();

  // Send every 10 seconds
  if (millis() - lastSend > 10000) {
    lastSend = millis();

    if (gps.location.isValid()) {
      float speed = gps.speed.kmph();
      float lat   = gps.location.lat();
      float lng   = gps.location.lng();
      int   sats  = gps.satellites.value();

      // Alert if speed > 50 km/h (customize this threshold)
      if (speed >= 0.0) {
        setAlertState();
        Serial.println("⚠ ALERT: High speed detected!");
      } else {
        setNormalState();
      }

      sendToAzure(lat, lng, speed, sats);

    } else {
      Serial.printf("Waiting for GPS fix... Sats: %d\n",
                    gps.satellites.value());
    }
  }

  // Buzzer pulse — don't leave it on solid, pulse it every 500ms
  if (alertActive) {
    static unsigned long lastBeep = 0;
    if (millis() - lastBeep > 500) {
      digitalWrite(BUZZER, !digitalRead(BUZZER)); // toggle
      lastBeep = millis();
    }
  }
}