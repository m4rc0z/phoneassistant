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
const SILENCE_DURATION_S = 2; // Seconds of silence to warm up the stream

// --- Skript-Logik ---
const client = new SpeechClient();
let currentRun = 1;

const WAV_HEADER_SIZE = 44;
const audioBuffer = fs.readFileSync(audioFilePath).slice(WAV_HEADER_SIZE);
const silenceChunk = Buffer.alloc(BYTES_PER_CHUNK);

console.log(`Starte HOT STREAM Latenz-Testreihe (2s Stille, dann Sprache) mit ${totalRuns} Durchläufen...`);

function runTest() {
  if (currentRun > totalRuns) {
    console.log(`
Alle ${totalRuns} Testläufe abgeschlossen.`);
    console.log(`Ergebnisse wurden in ${logFile} protokolliert.`);
    fs.appendFileSync(logFile, '\n---\nTestreihe (Hot Stream) abgeschlossen am ' + new Date().toISOString() + '\n');
    return;
  }

  console.log(`
--- Starte Testlauf ${currentRun} / ${totalRuns} ---
`);

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
  let isWarmedUp = false;

  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', (err) => {
      console.error(`FEHLER in Testlauf ${currentRun}:`, err);
      if (streamer) streamer.stop();
      recognizeStream.destroy();
      currentRun++;
      setTimeout(runTest, 1000);
    })
    .on('data', (data) => {
      if (isWarmedUp && !firstResultReceived) {
        firstResultReceived = true;
        const endTime = process.hrtime.bigint();
        const latency = (endTime - startTime) / 1000000n;
        const transcript = data.results[0] && data.results[0].alternatives[0] ? data.results[0].alternatives[0].transcript : '[Leeres Ergebnis]';
        const isFinal = data.results[0] ? data.results[0].isFinal : false;
        const timestamp = new Date().toISOString();

        console.log(`Erstes Sprach-Ergebnis erhalten. Latenz: ${latency} ms`);

        const logMessage = `
* **Testlauf ${currentRun} (${timestamp})**
  * **Erstes Transkript:** "${transcript}" (isFinal: ${isFinal})
  * **Hot Stream Latenz:** 
${latency} ms
`;
        fs.appendFileSync(logFile, logMessage);

        streamer.stop();
        recognizeStream.destroy();
        currentRun++;
        setTimeout(runTest, 1000);
      }
    });

  // Streamer-Objekt, das die Audio-Chunks sendet
  const streamer = {
    interval: null,
    chunkOffset: 0,
    stop: function() { clearInterval(this.interval); },
    start: function() {
      console.log('Stream aufwärmen mit 2 Sekunden Stille...');
      let silenceChunksSent = 0;
      const totalSilenceChunks = (SILENCE_DURATION_S * 1000) / CHUNK_INTERVAL;

      this.interval = setInterval(() => {
        if (!isWarmedUp) {
          // Warm-up Phase
          if (silenceChunksSent < totalSilenceChunks) {
            recognizeStream.write(silenceChunk);
            silenceChunksSent++;
          } else {
            isWarmedUp = true;
            console.log('Stream ist warm. Sende jetzt Sprach-Audio...');
            startTime = process.hrtime.bigint(); // *** ZEITMESSUNG STARTET HIER ***
          }
        } else {
          // Speech Phase
          const chunk = audioBuffer.slice(this.chunkOffset, this.chunkOffset + BYTES_PER_CHUNK);
          if (chunk.length > 0) {
            recognizeStream.write(chunk);
            this.chunkOffset += BYTES_PER_CHUNK;
          } else {
            console.log('Gesamte Audiodatei gesendet.');
            recognizeStream.end();
            this.stop();
          }
        }
      }, CHUNK_INTERVAL);
    }
  };

  streamer.start();
}

// This is the corrected line using backticks
fs.appendFileSync(logFile, `

---
## Latenz-Messungen (Hot Stream)
*Simuliert ein laufendes Gespräch: 2s Stille zum Aufwärmen, dann Messung der Latenz für die Sprache.*
`);

runTest();