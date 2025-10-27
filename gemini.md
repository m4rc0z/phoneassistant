# Projekt: Telefon-Assistent für Problemlösungen

## Ziel

Erstellung eines MVP-Prototyps für ein Telefonsystem, das Anrufe entgegennimmt und Hilfestellungen für bekannte Probleme bietet.

## Status

- [x] **Schritt 1: Projektstruktur anlegen**
  - [x] `package.json` mit Abhängigkeiten (`express`, `twilio`, `jest`) erstellt.
  - [x] `index.js` für den Express-Server angelegt.
  - [x] `test/` Ordner für Unit-Tests erstellt.
  - [x] Abhängigkeiten mit `npm install` installiert.

- [x] **Schritt 2: Wissensdatenbank erstellen**
  - [x] Eine `knowledge_base.json`-Datei erstellt, die bekannte Probleme und deren Lösungen enthält.

- [x] **Schritt 3: Minimaler Twilio-Webhook und Lösungs-Logik (Dummy)**
  - [x] Express-Server in `index.js` implementiert.
  - [x] Route `/call` erstellt, die eine TwiML-Begrüßungsnachricht zurückgibt und Benutzereingaben sammelt.
  - [x] Route `/handle-input` erstellt, die Benutzereingaben verarbeitet und eine Lösung aus `knowledge_base.json` basierend auf Keywords zurückgibt.
  - [x] `appointments.js` und `test/appointments.test.js` entfernt.

- [x] **Schritt 4: Tests für die neue Logik**
  - [x] `test/assistant.test.js` mit Tests für `/call` und `/handle-input` erstellt.
  - [x] `supertest` als dev-Abhängigkeit installiert.

- [x] **Schritt 5: Dialogflow-Integration für NLU (ursprünglich CX, jetzt ES)**
  - [x] `@google-cloud/dialogflow-cx` deinstalliert.
  - [x] `@google-cloud/dialogflow` installiert.
  - [x] `index.js` an den Dialogflow ES-Client und die entsprechenden API-Aufrufe angepasst.
  - [x] `test/assistant.test.js` an den Dialogflow ES-Client angepasst (Mocking).

- [x] **Schritt 6: Dialogflow ES-Intents erstellen**
  - [x] Anweisungen zum Erstellen von Dialogflow ES-Intents für jedes bekannte Problem in der `knowledge_base.json` bereitgestellt.
  - [x] `projectId` in `index.js` aktualisiert.

- [x] **Schritt 7: Server starten und testen**
  - [x] Den Server gestartet und die Funktionalität mit einer Twilio-Testnummer getestet (manuell über `curl` und Dialogflow-Integration verifiziert).
  - [x] `DEPLOYMENT.md` mit detaillierten Anweisungen für das Setup und den Betrieb erstellt.
  - [x] CORS in `index.js` aktiviert, um die Kommunikation mit `client.html` zu ermöglichen.
  - [x] `client.html` erstellt, um Sprachinteraktion über den Browser zu ermöglichen.

- [x] **Schritt 8: Google Cloud Text-to-Speech (TTS) Integration**
  - [x] `@google-cloud/text-to-speech` installiert.
  - [x] `index.js` an die TTS API angepasst, um Audiodaten (Base64-kodiert) an den Client zu senden.
  - [x] `client.html` angepasst, um die empfangenen Audiodaten abzuspielen.
  - [x] IAM-Berechtigungen für das Dienstkonto aktualisiert (Rolle "Cloud Text-to-Speech User").

## Nächste Schritte

- [ ] **Schritt 9: TTS-Modus-Umschaltung implementieren**
  - [ ] `client.html` um einen Toggle-Button erweitern, um zwischen Google Cloud TTS und Browser `SpeechSynthesis` zu wechseln.
  - [ ] `client.html` anpassen, um einen Parameter an den Backend-Aufruf zu senden, der den gewünschten TTS-Modus angibt.
  - [ ] `index.js` anpassen, um basierend auf diesem Parameter entweder Google Cloud TTS-Audio (JSON) oder TwiML (XML) zurückzugeben.