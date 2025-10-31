const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech');

// --- Konfiguration ---
const audioFilePath = './test_audio_16khz.wav'; // Wir verwenden weiterhin die generierte Testdatei
const languageCode = 'en-US';
const totalRuns = 5; // Anzahl der Testläufe
const logFile = 'latency-test.md';

// --- Skript-Logik ---
const client = new SpeechClient();
let currentRun = 1;

console.log(`Starte Latenz-Testreihe mit ${totalRuns} Durchläufen...`);

function runTest() {
  if (currentRun > totalRuns) {
    console.log(`
Alle ${totalRuns} Testläufe abgeschlossen.`);
    console.log(`Ergebnisse wurden in ${logFile} protokolliert.`);
    fs.appendFileSync(logFile, '\n---\nTestreihe abgeschlossen am ' + new Date().toISOString() + '\n');
    return;
  }

  console.log(`
--- Starte Testlauf ${currentRun} / ${totalRuns} ---`);

  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: languageCode,
    },
    interimResults: false,
  };

  let startTime;

  const recognizeStream = client
    .streamingRecognize(request)
    .on('error', (err) => {
      console.error(`FEHLER in Testlauf ${currentRun}:`, err);
      // Bei einem Fehler den nächsten Lauf starten
      recognizeStream.destroy();
      currentRun++;
      setTimeout(runTest, 1000); // Kurze Pause vor dem nächsten Lauf
    })
    .on('data', (data) => {
      if (data.results[0] && data.results[0].isFinal) {
        const endTime = process.hrtime.bigint();
        const latency = (endTime - startTime) / 1000000n;
        const transcript = data.results[0].alternatives[0].transcript;
        const timestamp = new Date().toISOString();

        console.log(`Ergebnis erhalten. Latenz: ${latency} ms`);

        const logMessage = `
* **Testlauf ${currentRun} (${timestamp})**
  * **Transkript:** "${transcript}"
  * **Latenz:** 
${latency} ms
`;
        fs.appendFileSync(logFile, logMessage);

        // Stream beenden und nächsten Testlauf starten
        recognizeStream.destroy();
        currentRun++;
        setTimeout(runTest, 1000); // Kurze Pause vor dem nächsten Lauf
      }
    });

  // Für jeden Testlauf einen neuen Audio-Stream erstellen
  const audioStream = fs.createReadStream(audioFilePath);

  audioStream.once('data', () => {
    startTime = process.hrtime.bigint();
    console.log('Ersten Audio-Chunk gesendet, Zeitmessung gestartet...');
  });

  audioStream.on('end', () => {
    console.log('Gesamte Audiodatei gesendet.');
    recognizeStream.end();
  });

  audioStream.pipe(recognizeStream);
}

// Den ersten Testlauf starten
runTest();
