const express = require('express');
const twilio = require('twilio');
const fs = require('fs');
const dialogflow = require('@google-cloud/dialogflow');

const app = express();
const port = 3000;

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

app.use(express.urlencoded({ extended: true }));

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
        languageCode: languageCode,
      },
    },
    languageCode: languageCode,
  };

  const [response] = await sessionClient.detectIntent(request);
  return response.queryResult;
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
  // For Dialogflow ES, we can use a fixed session ID for simplicity in this MVP
  // In a real application, you might generate a unique session ID per call
  const currentSessionId = req.body.CallSid || sessionId; 
  const twiml = new twilio.twiml.VoiceResponse();

  if (!speechResult) {
    twiml.say('Ich habe Sie nicht verstanden. Bitte versuchen Sie es noch einmal.');
    twiml.redirect('/call');
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  try {
    const queryResult = await detectIntent(speechResult);
    const intentDisplayName = queryResult.intent.displayName;

    const foundProblem = knowledgeBase.problems.find(problem => 
      problem.id === intentDisplayName
    );

    if (foundProblem) {
      twiml.say(foundProblem.solution);
    } else {
      twiml.say('Ich konnte Ihr Problem leider nicht verstehen. Bitte bleiben Sie in der Leitung, um mit einem Mitarbeiter verbunden zu werden.');
    }
  } catch (error) {
    console.error('Dialogflow detectIntent error:', error);
    twiml.say('Es gab ein Problem bei der Verarbeitung Ihrer Anfrage. Bitte versuchen Sie es später noch einmal.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;