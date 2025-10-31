async function main() {
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = await import('uuid');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID; // Your Account SID (AC...)
const authToken = process.env.TWILIO_AUTH_TOKEN;   // Your Auth Token (32-char string)
const twilioClient = new twilio(accountSid, authToken);

// For Access Token generation, use API Key SID and API Key Secret
const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;     // Your API Key SID (SK...)
const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET; // Your API Key Secret (32-char string)

const projectId = 'phoneworkflow-jbao'; // Ersetze dies durch deine Dialogflow Projekt-ID
const languageCode = 'de-DE';

const sessionClient = new dialogflow.SessionsClient();
const textToSpeechClient = new TextToSpeechClient();

let currentActiveStream = null; // To hold the active Dialogflow stream

const app = express();
const PORT = 3000;

// Endpoint to manually end the turn
app.post('/end-turn', (req, res) => {
    console.log('Manueller Turn-Ende-Trigger über HTTP empfangen.');
    if (currentActiveStream) {
        console.log('Beende aktiven Dialogflow-Turn via HTTP.');
        currentActiveStream.end();
        currentActiveStream = null; // Set to null immediately to prevent race condition
    }
    res.sendStatus(200);
});

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files from the current directory

// Twilio Webhook-Endpunkt
app.post('/twilio-webhook', (req, res) => {
    console.log('Twilio Webhook erhalten:', req.body);

    res.set('Content-Type', 'text/xml');
    res.send(`
        <Response>
            <Connect>
                <Stream url="wss://${req.headers.host}/twilio-ws" />
            </Connect>
        </Response>
    `);
});

// Endpoint zum Generieren von Twilio Access Tokens für den Client
app.get('/token', (req, res) => {
    console.log('DEBUG: /token endpoint hit.');
    console.log('DEBUG: accountSid in /token:', accountSid);
    const identity = 'user'; // Kann dynamisch sein, z.B. aus einer Benutzer-Session
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: 'APc7a8050c16dc5bf4f345c686ae6a7596', // Ersetze dies durch die SID deiner TwiML App
        incomingAllow: true,
    });

    const token = new AccessToken(
        accountSid, // Use Account SID here
        twilioApiKeySid,
        twilioApiKeySecret,
        { identity: identity }
    );
    token.addGrant(voiceGrant);

    res.set('Content-Type', 'application/json');
    res.send(JSON.stringify({ token: token.toJwt() }));
});

// WebSocket-Server für Twilio Media Streams
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', ws => {
    console.log('Twilio WebSocket verbunden');

    const sessionId = uuidv4();
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    let detectStream = null; // Keep this for the scope of the connection
    let streamSid = null; // To store the streamSid from the start event

    function endTurn() {
        if (detectStream) {
            console.log('Beende Dialogflow-Turn.');
            detectStream.end();
        }
        if (currentActiveStream === detectStream) {
            currentActiveStream = null;
        }
        detectStream = null;
    }

    function startTurn() {
        console.log(`Starte neuen Dialogflow-Turn mit Session: ${sessionId}`);
        detectStream = sessionClient.streamingDetectIntent()
            .on('error', (error) => {
                console.error('Dialogflow Stream Fehler:', error);
                if (currentActiveStream === detectStream) {
                    currentActiveStream = null;
                }
                detectStream = null;
            })
            .on('data', async data => {
                if (data.recognitionResult) {
                    console.log(`Zwischenergebnis: ${data.recognitionResult.transcript}`);
                }
                if (data.queryResult && data.queryResult.fulfillmentText) {
                    console.log(`Dialogflow Antwort: ${data.queryResult.fulfillmentText}`);

                    const [response] = await textToSpeechClient.synthesizeSpeech({
                        input: { text: data.queryResult.fulfillmentText },
                        voice: { languageCode: 'de-DE', name: 'de-DE-Neural2-F' },
                        audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
                    });

                    ws.send(JSON.stringify({
                        event: 'media',
                        streamSid: streamSid, // Include the streamSid
                        media: {
                            payload: Buffer.from(response.audioContent).toString('base64'),
                        }
                    }));
                    console.log('Audio-Antwort an Twilio gesendet.');
                }
            })
            .on('finish', () => {
                console.log('Dialogflow stream beendet.');
                if (currentActiveStream === detectStream) {
                    currentActiveStream = null;
                }
            });

        currentActiveStream = detectStream; // Assign to global

        detectStream.write({
            session: sessionPath,
            queryInput: {
                audioConfig: {
                    audioEncoding: 'AUDIO_ENCODING_MULAW',
                    sampleRateHertz: 8000,
                    languageCode: languageCode,
                },
                singleUtterance: false,
            },
        });
    }

    ws.on('message', async message => {
        const msg = JSON.parse(message);
        switch (msg.event) {
            case 'connected':
                console.log('Twilio Media Stream: Connected');
                break;
            case 'start':
                console.log('Twilio Media Stream: Start');
                streamSid = msg.start.streamSid; // Capture the streamSid
                startTurn();
                break;
            case 'media':
                // If there is no active stream, start a new turn.
                if (!currentActiveStream) {
                    console.log('Kein aktiver Stream, starte neuen Turn...');
                    startTurn();
                }

                // Now, write to the stream (which might have just been created).
                if (currentActiveStream && detectStream) {
                    const audio = Buffer.from(msg.media.payload, 'base64');
                    detectStream.write({ inputAudio: audio });
                }
                break;
            case 'stop':
                console.log('Twilio Media Stream: Stop');
                endTurn();
                break;
            default:
                break;
        }
    });

    ws.on('close', () => {
        console.log('Twilio WebSocket getrennt');
        endTurn();
    });

    ws.on('error', error => {
        console.error('Twilio WebSocket Fehler:', error);
        endTurn();
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});

server.on('upgrade', (request, socket, head) => {
    if (request.url === '/twilio-ws') {
        wss.handleUpgrade(request, socket, head, ws => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});
}

main();
