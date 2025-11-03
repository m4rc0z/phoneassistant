# Architektur des Telefon-Assistenten

Dieses Dokument beschreibt die Architektur des Telefon-Assistenten-Prototyps.

## Übersicht

Das System besteht aus den folgenden Hauptkomponenten:

1.  **Telefonie-Anbieter (Twilio):** Nimmt Anrufe entgegen und streamt das Audio in Echtzeit an unseren Server.
2.  **Backend-Server (`server.js`):** Das Herzstück des Systems. Es verbindet Twilio mit Dialogflow.
3.  **Dialogflow:** Verarbeitet das Audio, erkennt die Absicht des Anrufers und generiert eine Textantwort.
4.  **Google Text-to-Speech:** Wandelt die Textantwort von Dialogflow in Sprache um.
5.  **Web-Client (`client.html`):** Eine Web-Oberfläche zum Initiieren von Anrufen zu Testzwecken.

## Detaillierter Ablauf

1.  **Ein eingehender Anruf (via Twilio):**
    *   Ein Benutzer ruft eine Twilio-Telefonnummer an.
    *   Twilio sendet eine HTTP-Anfrage an den `/twilio-webhook`-Endpunkt auf unserem `server.js`.
    *   Der Server antwortet mit TwiML (`<Response><Connect><Stream>...`), das Twilio anweist, das Anruf-Audio an unseren WebSocket-Server (`wss://<server-host>/twilio-ws`) zu streamen.

2.  **Audio-Verarbeitung (Backend-Server):**
    *   Der WebSocket-Server auf `server.js` empfängt die Audio-Daten von Twilio im `mulaw`-Format.
    *   Gleichzeitig öffnet der Server einen `streamingDetectIntent`-Stream zur Google Dialogflow API.
    *   Das eingehende Audio von Twilio wird direkt an den Dialogflow-Stream weitergeleitet.

3.  **Dialogflow & Text-to-Speech:**
    *   Dialogflow verarbeitet den Audio-Stream in Echtzeit, führt Speech-to-Text (STT) und Absichtserkennung (NLU) durch.
    *   Sobald Dialogflow eine Absicht erkennt und eine Antwort formuliert hat, sendet es das Ergebnis (als Text) zurück an den `server.js` über den `streamingDetectIntent`-Stream.
    *   Der Server nimmt den Antworttext und verwendet die Google Text-to-Speech API, um daraus eine Audio-Datei (`.mulaw`-Format, 8kHz) zu generieren.

4.  **Antwort an den Anrufer:**
    *   Das generierte Audio wird als "media" Event über die Twilio WebSocket-Verbindung zurück an Twilio gesendet.
    *   Twilio spielt das Audio dem Anrufer in Echtzeit vor.

5.  **Client-seitiges Anrufen (`client.html`):**
    *   Zu Testzwecken kann über die `client.html` ein Anruf initiiert werden.
    *   Die Webseite holt sich ein Access Token vom `/token`-Endpunkt des Servers.
    *   Mit dem Token verbindet sich der Twilio Voice SDK im Browser mit dem Twilio-Service und startet einen Anruf.
    *   Die `client.html` implementiert zudem eine client-seitige Voice Activity Detection (VAD), um bei Sprechpausen das Ende einer Spracheingabe zu signalisieren (`/end-turn`).

## Schaubild

```
Anrufer <--> Twilio <--> WebSocket <--> server.js <--> Dialogflow API
                                          ^
                                          |
                                          v
                                     Google TTS API
```

## Begründung der Architektur

Diese Architektur wurde gewählt, um die Latenz zu minimieren. Anstatt das Audio zuerst selbst in Text umzuwandeln (STT) und diesen dann an Dialogflow zu senden, wird der rohe Audio-Stream direkt an Dialogflow übergeben. Dialogflow nutzt intern optimierte STT-Modelle, was zu einer deutlich geringeren "End-to-End"-Latenz führt und eine flüssigere Konversation ermöglicht.

## Konfiguration

### Text-to-Speech-Qualität

Die Qualität der Text-to-Speech-Stimme kann über die Umgebungsvariable `TTS_QUALITY` gesteuert werden:

*   `TTS_QUALITY=high` (Standard): Verwendet eine hochwertige, neuronale Stimme (`de-DE-Neural2-F`). Dies ist teurer.
*   `TTS_QUALITY=low`: Verwendet eine Standardstimme (`de-DE-Standard-F`). Dies ist kostengünstiger und für Tests empfohlen.

Wenn die Variable nicht gesetzt ist, wird standardmäßig die `low` Qualität verwendet.
