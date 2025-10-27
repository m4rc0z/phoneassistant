const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const dialogflow = require('@google-cloud/dialogflow');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech'); // Import TTS Client

const app = express();
const port = 3000;

const cors = require('cors');

// Load the knowledge base
const knowledgeBase = JSON.parse(fs.readFileSync('knowledge_base.json', 'utf8'));

// Dialogflow ES Configuration (replace with your actual values)
const projectId = 'phoneworkflow-jbao'; // Your Google Cloud Project ID
const sessionId = 'YOUR_SESSION_ID'; // A random identifier for the session
const languageCode = 'de-DE';

// Set up Dialogflow ES client
// Make sure to set the GOOGLE_APPLICATION_CREDENTIALS environment variable
// to the path of your service account key file.
const sessionClient = new dialogflow.SessionsClient();
const ttsClient = new TextToSpeechClient(); // Initialize TTS Client

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add this to parse JSON bodies if needed, though not strictly for this flow
app.use(cors()); // Enable CORS for all routes

// Function to detect intent using Dialogflow ES
async function detectIntent(query) {
  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: query,
        languageCode: languageCode, // Added here
      },
    },
    languageCode: languageCode, // Also here
  };

  const [response] = await sessionClient.detectIntent(request);
  return response.queryResult;
}

// Function to synthesize speech using Google Cloud TTS
async function synthesizeSpeech(text) {
  const request = {
    input: { text: text },
    voice: { languageCode: 'de-DE', ssmlGender: 'NEUTRAL' }, // You can choose specific voices here
    audioConfig: { audioEncoding: 'MP3' },
  };

  const [response] = await ttsClient.synthesizeSpeech(request);
  // The audio content is a base64-encoded string
  return response.audioContent.toString('base64');
}

app.post('/call', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const gather = twiml.gather({
    input: 'speech',
    timeout: 3,
    action: '/handle-input',
    language: 'de-DE',
  });
  gather.say('Vielen Dank für Ihren Anruf. Bitte beschreiben Sie kurz Ihr Problem.');
  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/handle-input', async (req, res) => {
  const speechResult = req.body.SpeechResult;
  const ttsMode = req.body.ttsMode; // Get TTS mode from client
  const currentSessionId = req.body.CallSid || sessionId; 

  let responseText = 'Es gab ein Problem bei der Verarbeitung Ihrer Anfrage. Bitte versuchen Sie es später noch einmal.';

  if (!speechResult) {
    responseText = 'Ich habe Sie nicht verstanden. Bitte versuchen Sie es noch einmal.';
    if (ttsMode === 'browser') {
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(responseText);
      twiml.redirect('/call');
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    } else {
      const audioBase64 = await synthesizeSpeech(responseText);
      res.json({ audio: audioBase64, text: responseText });
      return;
    }
  }

  try {
    const queryResult = await detectIntent(speechResult);
    const intentDisplayName = queryResult.intent.displayName;

    const foundProblem = knowledgeBase.problems.find(problem => 
      problem.id === intentDisplayName
    );

    if (foundProblem) {
      responseText = foundProblem.solution;
    } else {
      responseText = 'Ich konnte Ihr Problem leider nicht verstehen. Bitte bleiben Sie in der Leitung, um mit einem Mitarbeiter verbunden zu werden.';
    }

    if (ttsMode === 'browser') {
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(responseText);
      res.type('text/xml');
      res.send(twiml.toString());
    } else {
      const audioBase64 = await synthesizeSpeech(responseText);
      res.json({ audio: audioBase64, text: responseText });
    }

  } catch (error) {
    console.error('Server error:', error);
    if (ttsMode === 'browser') {
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(responseText);
      res.type('text/xml');
      res.send(twiml.toString());
    } else {
      const audioBase64 = await synthesizeSpeech(responseText);
      res.json({ audio: audioBase64, text: responseText });
    }
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;