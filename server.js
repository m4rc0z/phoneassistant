
const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const dialogflow = require('@google-cloud/dialogflow');
const { v4: uuidv4 } = require('uuid');
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

const ttsQuality = process.env.TTS_QUALITY === 'high' ? 'de-DE-Neural2-F' : 'de-DE-Standard-F';

const sessionClient = new dialogflow.SessionsClient();
const textToSpeechClient = new TextToSpeechClient();

let currentActiveStream = null; // To hold the active Dialogflow stream
const sessionTranscripts = new Map(); // Global map to store transcripts by sessionId

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

// This endpoint is for testing purposes only
app.post('/synthesize-for-test', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).send('Missing text in request body');
        }

        const [response] = await textToSpeechClient.synthesizeSpeech({
            input: { text },
            voice: { languageCode: 'de-DE', name: ttsQuality },
            audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
        });

        res.send({ audioContent: response.audioContent.toString('base64') });
    } catch (error) {
        console.error('Error in /synthesize-for-test:', error);
        res.status(500).send('Failed to synthesize speech');
    }
});

// Dialogflow Fallback Webhook
app.post('/dialogflow-fallback-webhook', async (req, res) => {
    console.log('Dialogflow Fallback Webhook erhalten:', req.body);

    const n8nWebhookUrl = 'http://localhost:5678/webhook-test/dialogflow-fallback';
    const sessionId = req.body.session.split('/').pop(); // Extract sessionId from Dialogflow session path
    const fullTranscript = sessionTranscripts.get(sessionId) || [];

    try {
        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionId: sessionId,
                transcript: fullTranscript,
                dialogflowQueryResult: req.body.queryResult // Include the original Dialogflow queryResult
            })
        });

        if (response.ok) {
            console.log('Daten erfolgreich an n8n gesendet.');
        } else {
            console.error('Fehler beim Senden der Daten an n8n:', response.status, await response.text());
        }
    } catch (error) {
        console.error('Fehler beim Senden der Daten an n8n:', error);
    }

    res.json({
        fulfillmentText: "Ich konnte Ihre Anfrage leider nicht verstehen. Ich habe Ihre Anfrage an einen Mitarbeiter weitergeleitet, der sich in Kürze bei Ihnen melden wird."
    });
});

// Twilio Webhook-Endpunkt
app.post('/twilio-webhook', (req, res) => {
    console.log('--- Twilio Webhook ---');
    console.log('Zeitpunkt:', new Date().toISOString());
    console.log('Request Body:', JSON.stringify(req.body, null, 2));
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));

    const websocketUrl = `wss://${req.headers.host}/twilio-ws`;
    console.log('Generierte WebSocket URL:', websocketUrl);

    const twimlResponse = `
        <Response>
            <Connect>
                <Stream url="${websocketUrl}" />
            </Connect>
        </Response>
    `;

    console.log('Sende TwiML-Antwort:', twimlResponse);
    res.set('Content-Type', 'text/xml');
    res.send(twimlResponse);
    console.log('--- Ende Twilio Webhook ---');
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

wss.on('connection', (ws, req) => {
    console.log('--- WebSocket-Verbindung --');
    console.log('Zeitpunkt:', new Date().toISOString());
    console.log('Twilio WebSocket verbunden.');
    console.log('Request URL:', req.url);
    console.log('Request Headers:', JSON.stringify(req.headers, null, 2));

    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
            console.log('Ping an Twilio gesendet.');
        }
    }, 20000); // Ping every 20 seconds

    ws.on('pong', () => {
        console.log('Pong von Twilio empfangen.');
    });

    const sessionId = uuidv4();
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);
    sessionTranscripts.set(sessionId, []);

    async function sendWelcomeMessage() {
        const welcomeMessage = 'Herzlich willkommen beim Telefon-Assistenten. Wie kann ich Ihnen helfen?';
        console.log(`Sende Willkommensnachricht: "${welcomeMessage}"`);

        try {
            const [response] = await textToSpeechClient.synthesizeSpeech({
                input: { text: welcomeMessage },
                voice: { languageCode: 'de-DE', name: ttsQuality },
                audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
            });

            // Prüfen, ob die WebSocket-Verbindung noch offen ist
            if (ws.readyState !== WebSocket.OPEN) {
                console.log('WebSocket wurde geschlossen, bevor die Willkommensnachricht gesendet werden konnte.');
                return;
            }

            ws.send(JSON.stringify({
                event: 'media',
                streamSid: streamSid, // Include the streamSid
                media: {
                    payload: Buffer.from(response.audioContent).toString('base64'),
                }
            }));
            console.log('Willkommensnachricht an Twilio gesendet.');
        } catch (error) {
            console.error('Fehler beim Generieren oder Senden der Willkommensnachricht:', error);
        }
    }


    async function handleFallback(streamSid, sessionId) {
        const fallbackMessage = "Ich konnte Ihre Anfrage leider nicht verstehen. Ich habe Ihre Anfrage an einen Mitarbeiter weitergeleitet, der sich in Kürze bei Ihnen melden wird.";
        console.log('Fallback-Logik wird ausgeführt. Sende Daten an n8n und beende Anruf.');

        try {
            // Send fallback message to user
            const [response] = await textToSpeechClient.synthesizeSpeech({
                input: { text: fallbackMessage },
                voice: { languageCode: 'de-DE', name: ttsQuality },
                audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
            });

            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    event: 'media',
                    streamSid: streamSid,
                    media: {
                        payload: Buffer.from(response.audioContent).toString('base64'),
                    }
                }));
            }
        } catch (error) {
            console.error('Fehler beim Synthetisieren der Fallback-Nachricht:', error);
        }


        // Send transcript to n8n webhook
        const n8nWebhookUrl = 'http://localhost:5678/webhook-test/dialogflow-fallback'; // Replace with your n8n webhook URL
        try {
            const n8nResponse = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    transcript: sessionTranscripts.get(sessionId),
                    lastUserUtterance: 'N/A' // Cannot get this in a forced fallback
                })
            });

            if (n8nResponse.ok) {
                console.log('Transkript erfolgreich an n8n gesendet.');
            } else {
                console.error('Fehler beim Senden des Transkripts an n8n:', n8nResponse.status, await n8nResponse.text());
            }
        } catch (error) {
            console.error('Fehler beim Senden des Transkripts an n8n:', error);
        }

        // End the call
        endTurn();
    }

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
                    sessionTranscripts.get(sessionId).push(`User: ${data.recognitionResult.transcript}`);
                }

                if (data.queryResult && data.queryResult.intent && data.queryResult.fulfillmentText) {
                    console.log(`Dialogflow Antwort: ${data.queryResult.fulfillmentText}`);
                    sessionTranscripts.get(sessionId).push(`Assistant: ${data.queryResult.fulfillmentText}`);

                    // Check for fallback intent
                    if (data.queryResult.intent.displayName === 'Default Fallback Intent') {
                        await handleFallback(streamSid, sessionId);
                        return;
                    }

                    const [response] = await textToSpeechClient.synthesizeSpeech({
                        input: { text: data.queryResult.fulfillmentText },
                        voice: { languageCode: 'de-DE', name: ttsQuality },
                        audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 },
                    });

                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            event: 'media',
                            streamSid: streamSid, // Include the streamSid
                            media: {
                                payload: Buffer.from(response.audioContent).toString('base64'),
                            }
                        }));
                        console.log('Audio-Antwort an Twilio gesendet.');
                    }
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
                singleUtterance: true,
            },
        });
    }

    ws.on('message', async message => {
        try {
            const msg = JSON.parse(message);
            // console.log('Eingehende WebSocket-Nachricht:', JSON.stringify(msg, null, 2));

            switch (msg.event) {
                case 'connected':
                    console.log('Twilio Media Stream: Connected Event empfangen.');
                    break;
                case 'start':
                    console.log('Twilio Media Stream: Start Event empfangen.');
                    console.log('Start-Nachricht Details:', JSON.stringify(msg.start, null, 2));
                    streamSid = msg.start.streamSid; // Capture the streamSid
                    console.log(`Stream SID captured: ${streamSid}`);
                    try {
                        await sendWelcomeMessage(); // Send welcome message
                    } catch (error) {
                        console.error('Fehler beim Senden der Willkommensnachricht nach Start-Event:', error);
                    }
                    break;
                case 'media':
                    // console.log('Twilio Media Stream: Media Event empfangen.'); // Sehr gesprächig, daher auskommentiert
                    if (!currentActiveStream) {
                        console.log('Erstes Medienereignis empfangen, starte neuen Dialogflow-Turn...');
                        startTurn();
                    }

                    if (currentActiveStream && detectStream) {
                        const audio = Buffer.from(msg.media.payload, 'base64');
                        detectStream.write({ inputAudio: audio });
                    }
                    break;
                case 'stop':
                    console.log('Twilio Media Stream: Stop Event empfangen.');
                    console.log('Stop-Nachricht Details:', JSON.stringify(msg.stop, null, 2));
                    endTurn();
                    break;
                case 'endOfStream':
                    console.log('Twilio Media Stream: End of Stream Event empfangen.');
                    endTurn();
                    break;
                case 'mark':
                    console.log('Twilio Media Stream: Mark Event empfangen.');
                    console.log('Mark-Nachricht Details:', JSON.stringify(msg.mark, null, 2));
                    break;
                default:
                    console.log('Unbekanntes WebSocket-Event empfangen:', msg.event);
                    break;
            }
        } catch (error) {
            console.error('Fehler beim Verarbeiten der WebSocket-Nachricht:', error);
            ws.close(1002, 'Invalid JSON received'); // 1002: Protocol Error
        }
    });

    ws.on('close', (code, reason) => {
        clearInterval(heartbeat);
        console.log(`--- WebSocket-Verbindung geschlossen ---`);
        console.log(`Zeitpunkt: ${new Date().toISOString()}`);
        console.log(`Code: ${code}, Grund: ${reason}`);
        sessionTranscripts.delete(sessionId);
        endTurn();
    });

    ws.on('error', error => {
        clearInterval(heartbeat);
        console.error('--- WebSocket-Fehler ---');
        console.error(`Zeitpunkt: ${new Date().toISOString()}`);
        console.error(error);
        sessionTranscripts.delete(sessionId);
        endTurn();
    });
});

// Only start the server if this file is run directly
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`Server läuft auf Port ${PORT}`);
    });

    server.on('upgrade', (request, socket, head) => {
        console.log('--- HTTP Upgrade Request ---');
        console.log('Zeitpunkt:', new Date().toISOString());
        console.log('Request URL:', request.url);
        console.log('Request Headers:', JSON.stringify(request.headers, null, 2));

        if (request.url === '/twilio-ws') {
            console.log('Upgrade-Request für /twilio-ws wird an wss weitergeleitet.');
            wss.handleUpgrade(request, socket, head, ws => {
                wss.emit('connection', ws, request);
            });
        } else {
            console.log('Upgrade-Request für einen unbekannten Pfad. Socket wird zerstört.');
            socket.destroy();
        }
    });
}

module.exports = { app, wss }; // Export app and wss for testing

