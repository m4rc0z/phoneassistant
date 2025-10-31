# Projekt: Telefon-Assistent für Problemlösungen

## Ziel

Erstellung eines MVP-Prototyps für ein Telefonsystem, das Anrufe entgegennimmt und Hilfestellungen für bekannte Probleme bietet.

## Phase 1: Prototyp 1 (Manuelle Komponenten-Integration)

- [x] **Schritt 1-8:** Initiales Setup, Wissensdatenbank, Dialogflow ES-Integration, TTS-Integration und Client-HTML wurden erfolgreich implementiert.

---

## Phase 2: Latenz-Analyse und Architektur-Neubewertung

- [x] **Schritt 9: Systematische Latenz-Tests**
  - [x] Mehrere Test-Skripte (`measure-latency.js`, `measure-interim-latency.js`, `measure-hot-stream-latency.js`) erstellt.
  - [x] Latenz der Google Speech-to-Text API unter verschiedenen Bedingungen (kalter Start, warmer Stream, Interim Results) gemessen.
  - [x] Test-Ergebnisse in `latency-test.md` protokolliert.

- [x] **Schritt 10: Analyse & Entscheidung**
  - [x] **Erkenntnis:** Die gemessene "Hot Stream"-Latenz von **~600-700 ms** ist für das Ziel einer flüssigen Echtzeit-Konversation zu hoch.
  - [x] **Entscheidung:** Die Architektur wird umgestellt. Anstatt STT manuell aufzurufen, wird das Audio-Streaming direkt an die Dialogflow API übergeben, um von Googles interner, optimierter Infrastruktur zu profitieren.

---

## Phase 3: Prototyp 2 (Performante Dialogflow-Integration)

**Ziel:** Einen Prototyp mit minimaler Latenz bauen, indem ein Telefonie-Anbieter direkt mit der Dialogflow Streaming API verbunden wird.

- [x] **Schritt 1: Projekt-Setup & Abhängigkeiten**
  - [x] WebSocket-Bibliothek `ws` für die Echtzeit-Kommunikation mit Twilio installiert.

- [ ] **Schritt 2: Basis-Server mit Twilio-Webhook**
  - [x] Neue `server.js` mit einem Express-Server und einem Test-Webhook (`/twilio-webhook`) erstellt.
  - [ ] **Aktion ausstehend:** Testanruf, um die Basiskommunikation (Anruf -> ngrok -> server.js) zu verifizieren.

- [ ] **Schritt 3: Öffentliche URL für den lokalen Server**
  - [ ] Anleitung zur Nutzung von `ngrok` bereitgestellt, um den lokalen Server öffentlich erreichbar zu machen.

- [ ] **Schritt 4: Implementierung der Audio-Brücke**
  - [ ] Umbau des Servers zur Weiterleitung des Audio-Streams von Twilio an die `streamingDetectIntent` API von Dialogflow.

- [ ] **Schritt 5: Test und Latenzmessung des neuen Systems**
  - [ ] Messung der End-to-End-Latenz in der neuen Architektur.
