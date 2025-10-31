
const twilio = require('twilio');

// Anmeldeinformationen aus Umgebungsvariablen laden
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

// Twilio-Client initialisieren
const client = twilio(accountSid, authToken);

// Die Telefonnummer, die angerufen werden soll (deine deutsche Nummer)
const toPhoneNumber = process.env.YOUR_PHONE_NUMBER;

// Deine Twilio-Telefonnummer (die US-Nummer)
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// URL, die Twilio abruft, wenn der Anruf entgegengenommen wird
// Dies sollte auf deinen Webhook zeigen, der TwiML zurückgibt
const url = `https://<your-ngrok-url>/twilio-webhook`;

client.calls.create({
    to: toPhoneNumber,
    from: fromPhoneNumber,
    url: url,
})
.then(call => console.log(`Anruf initiiert mit SID: ${call.sid}`))
.catch(error => console.error(`Fehler beim Initiieren des Anrufs: ${error}`));
