const request = require('supertest');
const app = require('../index');
const dialogflow = require('@google-cloud/dialogflow');

// Mock the Dialogflow ES SessionsClient
jest.mock('@google-cloud/dialogflow');

describe('POST /call', () => {
  test('should respond with a welcome message and gather input', async () => {
    const response = await request(app).post('/call');
    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Gather input="speech" timeout="3" action="/handle-input" language="de-DE">');
    expect(response.text).toContain('<Say>Vielen Dank für Ihren Anruf. Bitte beschreiben Sie kurz Ihr Problem.</Say>');
  });
});

describe('POST /handle-input', () => {
  const mockDetectIntent = jest.fn();

  beforeAll(() => {
    dialogflow.SessionsClient.mockImplementation(() => ({
      projectAgentSessionPath: jest.fn(() => 'mock-session-path'),
      detectIntent: mockDetectIntent,
    }));
  });

  beforeEach(() => {
    mockDetectIntent.mockClear();
  });

  test('should provide a solution for a known problem via Dialogflow', async () => {
    mockDetectIntent.mockResolvedValueOnce([
      {
        queryResult: {
          intent: { displayName: 'internet_down' },
        },
      },
    ]);

    const response = await request(app)
      .post('/handle-input')
      .type('form')
      .send({ SpeechResult: 'mein internet geht nicht', CallSid: 'test-call-sid' });

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Say>Haben Sie versucht, Ihren Router neu zu starten? Bitte trennen Sie ihn für 30 Sekunden vom Strom und schliessen Sie ihn dann wieder an.</Say>');
    expect(mockDetectIntent).toHaveBeenCalledTimes(1);
  });

  test('should handle unknown problems via Dialogflow', async () => {
    mockDetectIntent.mockResolvedValueOnce([
      {
        queryResult: {
          intent: { displayName: 'Default Fallback Intent' }, // Or any other intent not in knowledge_base
        },
      },
    ]);

    const response = await request(app)
      .post('/handle-input')
      .type('form')
      .send({ SpeechResult: 'mein bildschirm ist kaputt', CallSid: 'test-call-sid' });

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Say>Ich konnte Ihr Problem leider nicht verstehen. Bitte bleiben Sie in der Leitung, um mit einem Mitarbeiter verbunden zu werden.</Say>');
    expect(mockDetectIntent).toHaveBeenCalledTimes(1);
  });

  test('should handle no speech input', async () => {
    const response = await request(app)
      .post('/handle-input')
      .type('form')
      .send({ CallSid: 'test-call-sid' });

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Say>Ich habe Sie nicht verstanden. Bitte versuchen Sie es noch einmal.</Say>');
    expect(response.text).toContain('<Redirect>/call</Redirect>');
    expect(mockDetectIntent).not.toHaveBeenCalled();
  });

  test('should handle Dialogflow error', async () => {
    mockDetectIntent.mockRejectedValueOnce(new Error('Dialogflow API error'));

    const response = await request(app)
      .post('/handle-input')
      .type('form')
      .send({ SpeechResult: 'some input', CallSid: 'test-call-sid' });

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Say>Es gab ein Problem bei der Verarbeitung Ihrer Anfrage. Bitte versuchen Sie es später noch einmal.</Say>');
    expect(mockDetectIntent).toHaveBeenCalledTimes(1);
  });
});
