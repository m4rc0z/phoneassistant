# Deployment und Setup Anleitung für den Telefon-Assistenten

Diese Anleitung beschreibt alle notwendigen Schritte, um den Telefon-Assistenten einzurichten, zu starten und mit Twilio zu verbinden.

## 1. Projekt-Setup

Stellen Sie sicher, dass Node.js und npm auf Ihrem System installiert sind.

1.  **Projekt klonen oder herunterladen:**
    ```bash
    git clone <your-repository-url>
    cd phoneassistant2
    ```

2.  **Abhängigkeiten installieren:**
    ```bash
    npm install
    ```

## 2. Google Cloud Setup (Dialogflow ES)

Der Assistent verwendet Google Dialogflow ES für die Intent-Erkennung. Sie benötigen ein Google Cloud Projekt und einen Dialogflow ES Agent.

1.  **Google Cloud Projekt erstellen oder auswählen:**
    Gehen Sie zur [Google Cloud Console](https://console.cloud.google.com/) und wählen Sie Ihr Projekt aus oder erstellen Sie ein neues.

2.  **Dienstkonto erstellen und Schlüssel herunterladen:**
    *   Navigieren Sie in der Google Cloud Console zu "IAM & Admin" -> "Dienstkonten".
    *   Klicken Sie auf "+ DIENSTKONTO ERSTELLEN".
    *   Geben Sie einen Namen ein (z.B. `dialogflow-service-account`).
    *   Weisen Sie die Rolle "Dialogflow API Client" zu.
    *   Klicken Sie auf "Fertig".
    *   Klicken Sie auf die E-Mail-Adresse des soeben erstellten Dienstkontos.
    *   Gehen Sie zum Tab "Schlüssel".
    *   Klicken Sie auf "SCHLÜSSEL HINZUFÜGEN" -> "Neuen Schlüssel erstellen".
    *   Wählen Sie "JSON" als Schlüsseltyp und klicken Sie auf "ERSTELLEN".
    *   Die JSON-Schlüsseldatei wird auf Ihren Computer heruntergeladen. Benennen Sie sie um in etwas wie `service-account-key.json` und legen Sie sie sicher im Projektverzeichnis ab (z.B. im Root-Verzeichnis des Projekts).

3.  **`GOOGLE_APPLICATION_CREDENTIALS` Umgebungsvariable setzen:**
    Diese Variable muss auf den *absoluten Pfad* Ihrer heruntergeladenen JSON-Schlüsseldatei zeigen. Führen Sie diesen Befehl in Ihrem Terminal aus, *bevor* Sie den Server starten:
    ```bash
    export GOOGLE_APPLICATION_CREDENTIALS="/pfad/zu/ihrer/service-account-key.json"
    ```
    (Ersetzen Sie `/pfad/zu/ihrer/service-account-key.json` durch den tatsächlichen Pfad zu Ihrer Datei.)

4.  **Dialogflow ES Agent und Intents erstellen:**
    *   Gehen Sie zur [Dialogflow ES Console](https://dialogflow.cloud.google.com/).
    *   Wählen Sie Ihr Google Cloud Projekt aus.
    *   Erstellen Sie einen neuen ES Agent. Notieren Sie sich die **Project ID** (diese sollte bereits in `index.js` aktualisiert sein).
    *   **Intents erstellen:** Für jedes Problem in Ihrer `knowledge_base.json` (z.B. `internet_down`, `password_reset`, `billing_question`) erstellen Sie einen entsprechenden Intent in Dialogflow ES.
        *   Der "Display Name" des Intents muss exakt mit der `id` des Problems in `knowledge_base.json` übereinstimmen.
        *   Fügen Sie "Trainingsphrasen" hinzu, die beschreiben, wie ein Benutzer das Problem formulieren könnte.
        *   Sie müssen keine "Antworten" oder "Fulfillment" in Dialogflow konfigurieren, da die Node.js-Anwendung die Lösung bereitstellt.

## 3. Server starten

Nachdem alle Abhängigkeiten installiert und die Google Cloud-Konfiguration abgeschlossen ist:

```bash
npm start
```

Der Server sollte auf `http://localhost:3000` laufen.

## 4. Server exponieren und Twilio konfigurieren

Um Ihren lokal laufenden Server für Twilio zugänglich zu machen, verwenden Sie `ngrok`.

1.  **`ngrok` installieren und authentifizieren:**
    *   Laden Sie `ngrok` von [ngrok.com](https://ngrok.com/download) herunter und installieren Sie es.
    *   Registrieren Sie sich für ein kostenloses Konto auf [https://dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup).
    *   Holen Sie sich Ihren Authtoken von [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) und installieren Sie ihn in Ihrem Terminal:
        ```bash
        ngrok config add-authtoken <YOUR_AUTHTOKEN>
        ```

2.  **`ngrok` starten:**
    Öffnen Sie ein *neues* Terminalfenster (lassen Sie den Node.js-Server im anderen Fenster laufen) und führen Sie aus:
    ```bash
    ngrok http 3000
    ```
    `ngrok` zeigt Ihnen eine öffentliche URL an (z.B. `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app`).

3.  **Twilio Telefonnummer konfigurieren:**
    *   Gehen Sie zur [Twilio Console](https://www.twilio.com/console).
    *   Navigieren Sie zu "Phone Numbers" -> "Manage" -> "Active numbers".
    *   Klicken Sie auf die Telefonnummer, die Sie verwenden möchten.
    *   Scrollen Sie zum Abschnitt "Voice & Fax".
    *   Unter "A CALL COMES IN" wählen Sie "Webhook" und fügen Sie Ihre `ngrok`-URL gefolgt von `/call` ein.
        *   Beispiel: `https://xxxx-xxxx-xxxx-xxxx.ngrok-free.app/call`
    *   Stellen Sie sicher, dass die Methode auf `HTTP POST` eingestellt ist.
    *   Speichern Sie Ihre Änderungen.

Jetzt können Sie Ihre Twilio-Nummer anrufen und den Telefon-Assistenten testen!