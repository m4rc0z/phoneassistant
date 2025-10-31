const dialogflow = require('@google-cloud/dialogflow');
const uuid = require('uuid');
const fs = require('fs');

const projectId = 'phoneworkflow-jbao'; // Deine Dialogflow Projekt-ID
const languageCode = 'de-DE';

const sessionClient = new dialogflow.SessionsClient();

async function testDialogflowStream() {
    const sessionId = uuid.v4();
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    const detectStream = sessionClient.streamingDetectIntent()
        .on('error', console.error)
        .on('data', data => {
            if (data.recognitionResult) {
                console.log(`Intermediate transcript: ${data.recognitionResult.transcript}`);
            }
            if (data.queryResult && data.queryResult.fulfillmentText) {
                console.log(`Dialogflow response: ${data.queryResult.fulfillmentText}`);
            }
        });

    // Sende die erste Anfrage mit Konfigurationsparametern
    detectStream.write({
        session: sessionPath,
        queryInput: {
            audioConfig: {
                audioEncoding: 'AUDIO_ENCODING_MULAW', // Twilio uses MULAW
                sampleRateHertz: 8000, // Twilio uses 8000 Hz
                languageCode: languageCode,
            },
            singleUtterance: false,
        },
    });

    // Lese die konvertierte Audio-Datei und streame sie an Dialogflow
    const audioFileStream = fs.createReadStream('audio-8khz-mulaw.raw', { highWaterMark: 320 }); // 40ms chunks (8000 samples/sec * 1 byte/sample * 0.040 sec = 320 bytes)

    let audioSentTime = 0;

    audioFileStream.on('data', chunk => {
        if (detectStream) {
            detectStream.write({
                inputAudio: chunk,
            });
            audioSentTime = Date.now();
        }
    });

    detectStream.on('data', data => {
        if (data.recognitionResult) {
            console.log(`Intermediate transcript: ${data.recognitionResult.transcript}`);
        }
        if (data.queryResult) {
            const latency = Date.now() - audioSentTime;
            console.log('Dialogflow queryResult:', JSON.stringify(data.queryResult, null, 2));
            if (data.queryResult.fulfillmentText) {
                console.log(`Dialogflow response: ${data.queryResult.fulfillmentText} (Latency: ${latency}ms)`);
            } else {
                console.log(`Dialogflow queryResult received (Latency: ${latency}ms)`);
            }
        }
    });

    audioFileStream.on('end', () => {
        console.log('Audio file finished streaming.');
        detectStream.end(); // Beende den Dialogflow-Stream, wenn die Audio-Datei zu Ende ist
    });

    audioFileStream.on('error', error => {
        console.error('Error reading audio file:', error);
        detectStream.end();
    });
}

testDialogflowStream();
