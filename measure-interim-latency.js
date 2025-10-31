const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech');

// --- Konfiguration ---
const audioFilePath = './test_audio_16khz.wav';
const languageCode = 'en-US';
const totalRuns = 5;
const logFile = 'latency-test.md';

// Real-time simulation config
const CHUNK_INTERVAL = 100; // ms
const SAMPLE_RATE = 16000; // Hz
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;
const BYTES_PER_CHUNK = (SAMPLE_RATE * (BITS_PER_SAMPLE / 8) * CHANNELS * CHUNK_INTERVAL) / 1000;

// --- Skript-Logik ---
const client = new SpeechClient();
let currentRun = 1;

// WAV-Header sind normalerweise 44 Bytes lang. Wir müssen sie überspringen.
const WAV_HEADER_SIZE = 44;
const audioBuffer = fs.readFileSync(audioFilePath).slice(WAV_HEADER_SIZE);

console.log(`Starte REALISTISCHE Latenz-Testreihe (100ms Chunks) mit ${totalRuns} Durchläufen...`);

function runTest() {
  if (currentRun > totalRuns) {
    console.log(`\nAlle ${totalRuns} Testläufe abgeschlossen.`);
    console.log(`Ergebnisse wurden in ${logFile} protokolliert.`);
    fs.appendFileSync(logFile, '\n---\nTestreihe (Realistisch, 100ms Chunks) abgeschlossen am ' + new Date().toISOString() + '\n');
    return;
  }

  console.log(`\n--- Starte Testlauf ${currentRun} / ${totalRuns} ---`);

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: SAMPLE_RATE,
      languageCode: languageCode,
    },
    interimResults: true,
  };

  let startTime;
  let firstResultReceived = false;
  let chunkOffset = 0;
  let streamingInterval;

  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', (err) => {
      console.error(`FEHLER in Testlauf ${currentRun}:`, err);
      clearInterval(streamingInterval);
      recognizeStream.destroy();
      currentRun++;
      setTimeout(runTest, 1000);
    })
    .on('data', (data) => {
      if (!firstResultReceived) {
        firstResultReceived = true;
        const endTime = process.hrtime.bigint();
        const latency = (endTime - startTime) / 1000000n;
        const transcript = data.results[0] && data.results[0].alternatives[0] ? data.results[0].alternatives[0].transcript : '[Leeres Ergebnis]';
        const isFinal = data.results[0] ? data.results[0].isFinal : false;
        const timestamp = new Date().toISOString();

        console.log(`Erstes Zwischenergebnis erhalten. Latenz: ${latency} ms`);

        const logMessage = `
* **Testlauf ${currentRun} (${timestamp})**
  * **Erstes Transkript:** "${transcript}" (isFinal: ${isFinal})
  * **Latenz bis zum ersten Ergebnis:** 
${latency} ms
`;
        fs.appendFileSync(logFile, logMessage);

        clearInterval(streamingInterval);
        recognizeStream.destroy();
        currentRun++;
        setTimeout(runTest, 1000);
      }
    });

  // Starte das Streaming der Chunks
  startTime = process.hrtime.bigint();
  console.log('Sende ersten 100ms Audio-Chunk, Zeitmessung gestartet...');

  streamingInterval = setInterval(() => {
    const chunk = audioBuffer.slice(chunkOffset, chunkOffset + BYTES_PER_CHUNK);

    if (chunk.length > 0) {
      recognizeStream.write(chunk);
      chunkOffset += BYTES_PER_CHUNK;
    } else {
      console.log('Gesamte Audiodatei gesendet.');
      recognizeStream.end();
      clearInterval(streamingInterval);
    }
  }, CHUNK_INTERVAL);
}

fs.appendFileSync(logFile, '\n\n---\n## Latenz-Messungen (Realistisch, 100ms Chunks)\n*Simuliert ein Mikrofon durch Streaming von 100ms Audio-Blöcken.*
');

runTest();