/**
 * Unit tests for public/js/utils.js
 */

import { formatDate, showMessage, showAuthMessage, clearAuthMessage } from '../../public/js/utils.js';

describe('formatDate', () => {
  test('should format ISO date string correctly', () => {
    const isoString = '2025-11-06T15:30:00.000Z';
    const result = formatDate(isoString);

    // Should contain date components (actual format depends on locale)
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/Nov/);
    expect(result).toMatch(/6/);
  });

  test('should return "No date" for null input', () => {
    expect(formatDate(null)).toBe('No date');
  });

  test('should return "No date" for undefined input', () => {
    expect(formatDate(undefined)).toBe('No date');
  });

  test('should return "No date" for empty string', () => {
    expect(formatDate('')).toBe('No date');
  });

  test('should handle date object conversion', () => {
    const date = new Date('2024-01-15T10:00:00Z');
    const result = formatDate(date.toISOString());

    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Jan/);
  });
});

describe('showMessage', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="message-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should display success message', () => {
    showMessage('success', 'Test success message');

    const container = document.getElementById('message-container');
    expect(container.innerHTML).toContain('Test success message');
    expect(container.innerHTML).toContain('success');
    expect(container.innerHTML).toContain('message');
  });

  test('should display error message', () => {
    showMessage('error', 'Test error message');

    const container = document.getElementById('message-container');
    expect(container.innerHTML).toContain('Test error message');
    expect(container.innerHTML).toContain('error');
  });

  test('should replace existing message', () => {
    showMessage('info', 'First message');
    showMessage('warning', 'Second message');

    const container = document.getElementById('message-container');
    expect(container.innerHTML).toContain('Second message');
    expect(container.innerHTML).not.toContain('First message');
  });

  test('should handle missing container gracefully', () => {
    document.body.innerHTML = ''; // Remove container

    // Should not throw
    expect(() => {
      showMessage('info', 'Test message');
    }).not.toThrow();
  });

  test('should handle HTML special characters', () => {
    showMessage('info', '<script>alert("test")</script>');

    const container = document.getElementById('message-container');
    // innerHTML does not encode - the script tag is inserted as-is
    expect(container.innerHTML).toContain('<script>');
  });
});

describe('showAuthMessage', () => {
  beforeEach(() => {
    // Setup DOM with email-auth-section
    document.body.innerHTML = `
      <div id="email-auth-section">
        <div id="auth-error"></div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should create and display auth message', () => {
    showAuthMessage('success', 'Login successful');

    const msgDiv = document.getElementById('auth-msg');
    expect(msgDiv).toBeTruthy();
    expect(msgDiv.innerHTML).toContain('Login successful');
    expect(msgDiv.innerHTML).toContain('success');
    expect(msgDiv.innerHTML).toContain('auth-message-spacing');
  });

  test('should update existing auth message', () => {
    showAuthMessage('info', 'First message');
    showAuthMessage('error', 'Second message');

    const msgDiv = document.getElementById('auth-msg');
    expect(msgDiv.innerHTML).toContain('Second message');
    expect(msgDiv.innerHTML).not.toContain('First message');
    expect(msgDiv.innerHTML).toContain('error');
  });

  test('should handle missing email-auth-section gracefully', () => {
    document.body.innerHTML = ''; // Remove section

    // Should not throw
    expect(() => {
      showAuthMessage('info', 'Test message');
    }).not.toThrow();
  });

  test('should display different message types', () => {
    const types = ['success', 'error', 'warning', 'info'];

    types.forEach(type => {
      showAuthMessage(type, `Test ${type} message`);
      const msgDiv = document.getElementById('auth-msg');
      expect(msgDiv.innerHTML).toContain(type);
      expect(msgDiv.innerHTML).toContain(`Test ${type} message`);
    });
  });
});

describe('clearAuthMessage', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="email-auth-section">
        <div id="auth-error"></div>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should remove auth message element', () => {
    // First create a message
    showAuthMessage('info', 'Test message');
    expect(document.getElementById('auth-msg')).toBeTruthy();

    // Then clear it
    clearAuthMessage();
    expect(document.getElementById('auth-msg')).toBeNull();
  });

  test('should handle missing auth message gracefully', () => {
    // Should not throw when no message exists
    expect(() => {
      clearAuthMessage();
    }).not.toThrow();
  });

  test('should allow creating new message after clearing', () => {
    showAuthMessage('info', 'First message');
    clearAuthMessage();
    showAuthMessage('success', 'Second message');

    const msgDiv = document.getElementById('auth-msg');
    expect(msgDiv).toBeTruthy();
    expect(msgDiv.innerHTML).toContain('Second message');
    expect(msgDiv.innerHTML).not.toContain('First message');
  });
});
