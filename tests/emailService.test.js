const path = require('path');

describe('Email Service', () => {
  let originalEnv;
  let emailService;
  let mockNodemailer;

  beforeEach(() => {
    // Preserve original env
    originalEnv = { ...process.env };
    jest.resetModules();
    mockNodemailer = {
      createTransport: jest.fn(() => ({
        sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-123' }),
        verify: jest.fn().mockResolvedValue(true),
      })),
    };
    jest.mock('nodemailer', () => mockNodemailer);
    // Set env vars for SMTP
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'user@test.com';
    process.env.SMTP_PASS = 'secret';
    process.env.EMAIL_FROM = 'Gym <noreply@gymdiet.app>';
    emailService = require('../src/services/emailService');
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
    jest.resetAllMocks();
    jest.unmock('nodemailer');
  });

  test('verifyConnection succeeds with proper config', async () => {
    const ok = await emailService.verifyConnection();
    expect(ok).toBe(true);
    expect(mockNodemailer.createTransport).toHaveBeenCalled();
  });

  test('sendMail succeeds when transport is configured', async () => {
    const result = await emailService.sendMail('to@example.com', 'Subject', '<p>HTML</p>', 'plain');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    const transport = emailService.createTransport();
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: process.env.EMAIL_FROM,
      to: 'to@example.com',
      subject: 'Subject',
      html: '<p>HTML</p>',
      text: 'plain',
    });
  });

  test('sendMail fails gracefully when SMTP not configured', async () => {
    // Remove SMTP configuration
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    // Reload module to pick up new env
    jest.resetModules();
    emailService = require('../src/services/emailService');
    const result = await emailService.sendMail('to@example.com', 'Subject', '<p>HTML</p>', 'plain');
    expect(result.success).toBe(false);
    expect(result.error).toBe('SMTP_NOT_CONFIGURED');
  });
});
