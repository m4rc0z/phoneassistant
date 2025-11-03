const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const request = require('supertest');
const { app, wss } = require('../server'); // Import the app and wss

let server;

// Increase timeout for this test
jest.setTimeout(30000);

describe('Integration Test - Full Call Flow', () => {
    beforeAll(done => {
        server = http.createServer(app);
        server.on('upgrade', (request, socket, head) => {
            if (request.url === '/twilio-ws') {
                wss.handleUpgrade(request, socket, head, ws => {
                    wss.emit('connection', ws, request);
                });
            } else {
                socket.destroy();
            }
        });
        server.listen(3000, done);
    });

    afterAll(done => {
        console.log('Closing server...');
        wss.clients.forEach(client => client.close());
        server.close(done);
    });

    test('should handle a full call flow', done => {
        const ws = new WebSocket('ws://localhost:3000/twilio-ws');
        let welcomeMessageReceived = false;

        ws.on('open', () => {
            console.log('Test WebSocket connection opened.');

            // 1. Send 'connected' message
            ws.send(JSON.stringify({ event: 'connected' }));
            console.log('Sent: connected');

            // 2. Send 'start' message
            ws.send(JSON.stringify({
                event: 'start',
                start: {
                    streamSid: 'mz-test-stream-sid-1234',
                    callSid: 'mz-test-call-sid-5678',
                    // other properties can be added if needed
                }
            }));
            console.log('Sent: start');
        });

        ws.on('message', message => {
            const msg = JSON.parse(message);

            if (msg.event === 'media') {
                if (!welcomeMessageReceived) {
                    // This is the welcome message
                    console.log('Received: welcome media message');
                    expect(msg.media.payload).toBeDefined();
                    welcomeMessageReceived = true;

                    // 3. Stream audio after receiving the welcome message
                    const audioFilePath = path.join(__dirname, '..', 'audio-8khz-mulaw.raw');
                    const audioBuffer = fs.readFileSync(audioFilePath);
                    const chunkSize = 160; // 20ms of 8kHz mu-law audio
                    let i = 0;

                    function sendChunk() {
                        if (i < audioBuffer.length) {
                            const chunk = audioBuffer.slice(i, i + chunkSize);
                            const payload = chunk.toString('base64');
                            ws.send(JSON.stringify({
                                event: 'media',
                                streamSid: 'mz-test-stream-sid-1234',
                                media: {
                                    payload: payload
                                }
                            }));
                            i += chunkSize;
                            setTimeout(sendChunk, 20); // Send next chunk after 20ms
                        } else {
                            console.log('Finished sending audio stream, sending endOfStream.');
                            ws.send(JSON.stringify({ event: 'endOfStream', streamSid: 'mz-test-stream-sid-1234' }));
                        }
                    }

                    console.log('Starting to stream audio...');
                    sendChunk();
                } else {
                    // This is the response from Dialogflow
                    console.log('Received: dialogflow media response');
                    expect(msg.media.payload).toBeDefined();

                    // 4. Send 'stop' message
                    ws.send(JSON.stringify({
                        event: 'stop',
                        stop: {
                            callSid: 'mz-test-call-sid-5678'
                        }
                    }));
                    console.log('Sent: stop');
                    ws.close();
                }
            }
        });

        ws.on('close', () => {
            console.log('Test WebSocket connection closed.');
            done();
        });

        ws.on('error', error => {
            console.error('Test WebSocket error:', error);
            done(error);
        });
    });

    test('should handle default fallback intent when audio is not recognized', async () => {
        // 1. Synthesize audio for a phrase that will not be recognized
        const textToSynthesize = 'bubu123 bubu 123 ich weiss nicht was hier abgeht';
        const response = await request(server)
            .post('/synthesize-for-test')
            .send({ text: textToSynthesize });

        expect(response.status).toBe(200);
        const audioContent = response.body.audioContent;
        expect(audioContent).toBeDefined();

        const audioBuffer = Buffer.from(audioContent, 'base64');

        // 2. Start WebSocket communication and wrap in a promise
        await new Promise((resolve, reject) => {
            const ws = new WebSocket('ws://localhost:3000/twilio-ws');
            let welcomeMessageReceived = false;

            ws.on('open', () => {
                ws.send(JSON.stringify({ event: 'connected' }));
                ws.send(JSON.stringify({
                    event: 'start',
                    start: {
                        streamSid: 'mz-test-fallback-tts-1234',
                        callSid: 'mz-test-fallback-tts-5678',
                    }
                }));
            });

            ws.on('message', message => {
                const msg = JSON.parse(message);

                if (msg.event === 'media') {
                    if (!welcomeMessageReceived) {
                        console.log('Fallback TTS Test: Received welcome message');
                        welcomeMessageReceived = true;

                        // 3. Stream the synthesized audio
                        const chunkSize = 160;
                        let i = 0;
                        function sendChunk() {
                            if (i < audioBuffer.length) {
                                const chunk = audioBuffer.slice(i, i + chunkSize);
                                ws.send(JSON.stringify({
                                    event: 'media',
                                    streamSid: 'mz-test-fallback-tts-1234',
                                    media: { payload: chunk.toString('base64') }
                                }));
                                i += chunkSize;
                                setTimeout(sendChunk, 20);
                            } else {
                                ws.send(JSON.stringify({ event: 'endOfStream', streamSid: 'mz-test-fallback-tts-1234' }));
                            }
                        }
                        sendChunk();

                    } else {
                        // This should be the fallback response
                        console.log('Fallback TTS Test: Received media response');
                        expect(msg.media.payload).toBeDefined();
                        ws.send(JSON.stringify({
                            event: 'stop',
                            stop: { callSid: 'mz-test-fallback-tts-5678' }
                        }));
                        ws.close();
                    }
                }
            });

            ws.on('close', () => {
                console.log('Fallback TTS Test: WebSocket connection closed.');
                resolve();
            });

            ws.on('error', error => {
                console.error('Fallback TTS Test: WebSocket error:', error);
                reject(error);
            });
        });
    });
});
