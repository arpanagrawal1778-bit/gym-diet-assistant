const { setupTestDb, teardownTestDb } = require('./setup');
const { getDb } = require('../src/config/database');
const reminderService = require('../src/services/reminderService');

jest.mock('../src/services/emailService', () => ({
  sendMail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
}));

const emailService = require('../src/services/emailService');

describe('Reminder Service', () => {
  let db;
  const userId = 1;
  const userEmail = 'user@example.com';

  beforeAll(() => {
    // Setup test DB and create a user
    db = setupTestDb();
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(userId, 'Test User', userEmail, 'hash');
  });

  afterAll(() => {
    teardownTestDb();
  });

  beforeEach(() => {
    // Clear reminder_logs before each test
    db.prepare('DELETE FROM reminder_logs').run();
    jest.clearAllMocks();
  });

  test('sendReminder succeeds and logs', async () => {
    const result = await reminderService.sendReminder(userId, userEmail, 'meal');
    expect(result.sent).toBe(true);
    expect(emailService.sendMail).toHaveBeenCalled();
    const log = db.prepare('SELECT * FROM reminder_logs WHERE user_id = ?').get(userId);
    expect(log).toBeDefined();
    expect(log.reminder_type).toBe('meal');
    expect(log.status).toBe('sent');
  });

  test('prevent duplicate reminder same day', async () => {
    // First send
    await reminderService.sendReminder(userId, userEmail, 'workout');
    // Second send same day
    const result = await reminderService.sendReminder(userId, userEmail, 'workout');
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    // Only one log entry
    const count = db.prepare('SELECT COUNT(*) as cnt FROM reminder_logs WHERE user_id = ? AND reminder_type = ?').get(userId, 'workout').cnt;
    expect(count).toBe(1);
  });

  test('unknown reminder type returns error', async () => {
    const result = await reminderService.sendReminder(userId, userEmail, 'unknown_type');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('UNKNOWN_TYPE');
  });

  test('missing email returns error', async () => {
    const result = await reminderService.sendReminder(userId, null, 'meal');
    expect(result.sent).toBe(false);
    expect(result.error).toBe('NO_EMAIL');
  });
});
