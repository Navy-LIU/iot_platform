const SecurityUtils = require('../../utils/security');

describe('Security Utils', () => {
  describe('generateRandomString', () => {
    test('should generate random string of specified length', () => {
      const str1 = SecurityUtils.generateRandomString(16);
      const str2 = SecurityUtils.generateRandomString(16);

      expect(str1).toHaveLength(32); // hex encoding doubles length
      expect(str2).toHaveLength(32);
      expect(str1).not.toBe(str2); // Should be different
    });

    test('should generate different strings each time', () => {
      const strings = Array.from({ length: 10 }, () => SecurityUtils.generateRandomString(8));
      const uniqueStrings = new Set(strings);

      expect(uniqueStrings.size).toBe(10); // All should be unique
    });
  });

  describe('generateSessionId', () => {
    test('should generate session ID', () => {
      const sessionId = SecurityUtils.generateSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toHaveLength(64); // 32 bytes = 64 hex chars
    });
  });

  describe('hashString', () => {
    test('should hash string consistently', () => {
      const input = 'test string';
      const hash1 = SecurityUtils.hashString(input);
      const hash2 = SecurityUtils.hashString(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    test('should produce different hashes for different inputs', () => {
      const hash1 = SecurityUtils.hashString('input1');
      const hash2 = SecurityUtils.hashString('input2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRequestFingerprint', () => {
    test('should generate fingerprint from request', () => {
      const mockReq = {
        get: jest.fn((header) => {
          const headers = {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip'
          };
          return headers[header];
        }),
        ip: '192.168.1.1'
      };

      const fingerprint = SecurityUtils.generateRequestFingerprint(mockReq);

      expect(fingerprint).toBeDefined();
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint).toHaveLength(64);
    });

    test('should generate same fingerprint for same request', () => {
      const mockReq = {
        get: jest.fn((header) => {
          const headers = {
            'User-Agent': 'Mozilla/5.0',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip'
          };
          return headers[header];
        }),
        ip: '192.168.1.1'
      };

      const fingerprint1 = SecurityUtils.generateRequestFingerprint(mockReq);
      const fingerprint2 = SecurityUtils.generateRequestFingerprint(mockReq);

      expect(fingerprint1).toBe(fingerprint2);
    });
  });

  describe('sanitizeInput', () => {
    test('should remove dangerous characters', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = SecurityUtils.sanitizeInput(input);

      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
    });

    test('should remove javascript protocol', () => {
      const input = 'javascript:alert("xss")';
      const sanitized = SecurityUtils.sanitizeInput(input);

      expect(sanitized).not.toContain('javascript:');
    });

    test('should remove event handlers', () => {
      const input = 'onclick=alert("xss")';
      const sanitized = SecurityUtils.sanitizeInput(input);

      expect(sanitized).not.toContain('onclick=');
    });

    test('should handle non-string input', () => {
      expect(SecurityUtils.sanitizeInput(123)).toBe(123);
      expect(SecurityUtils.sanitizeInput(null)).toBe(null);
      expect(SecurityUtils.sanitizeInput(undefined)).toBe(undefined);
    });
  });

  describe('isValidIP', () => {
    test('should validate IPv4 addresses', () => {
      expect(SecurityUtils.isValidIP('192.168.1.1')).toBe(true);
      expect(SecurityUtils.isValidIP('127.0.0.1')).toBe(true);
      expect(SecurityUtils.isValidIP('255.255.255.255')).toBe(true);
      expect(SecurityUtils.isValidIP('0.0.0.0')).toBe(true);
    });

    test('should reject invalid IPv4 addresses', () => {
      expect(SecurityUtils.isValidIP('256.1.1.1')).toBe(false);
      expect(SecurityUtils.isValidIP('192.168.1')).toBe(false);
      expect(SecurityUtils.isValidIP('192.168.1.1.1')).toBe(false);
      expect(SecurityUtils.isValidIP('not.an.ip.address')).toBe(false);
    });

    test('should validate IPv6 addresses', () => {
      expect(SecurityUtils.isValidIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });
  });

  describe('extractClientInfo', () => {
    test('should extract client information', () => {
      const mockReq = {
        ip: '192.168.1.1',
        connection: { remoteAddress: '192.168.1.2' },
        get: jest.fn(() => 'Mozilla/5.0')
      };

      const clientInfo = SecurityUtils.extractClientInfo(mockReq);

      expect(clientInfo).toHaveProperty('ip');
      expect(clientInfo).toHaveProperty('userAgent');
      expect(clientInfo).toHaveProperty('fingerprint');
      expect(clientInfo).toHaveProperty('timestamp');
      expect(clientInfo.ip).toBe('192.168.1.1');
      expect(clientInfo.userAgent).toBe('Mozilla/5.0');
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      // Clear rate limit store
      SecurityUtils.rateLimitStore.clear();
    });

    test('should allow requests within limit', () => {
      const result = SecurityUtils.checkRateLimit('test-key', 5, 60000);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.retryAfter).toBe(0);
    });

    test('should block requests exceeding limit', () => {
      // Make 5 requests (max limit)
      for (let i = 0; i < 5; i++) {
        SecurityUtils.checkRateLimit('test-key', 5, 60000);
      }

      // 6th request should be blocked
      const result = SecurityUtils.checkRateLimit('test-key', 5, 60000);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should reset after time window', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        SecurityUtils.checkRateLimit('test-key', 5, 100); // 100ms window
      }

      // Wait for window to pass
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = SecurityUtils.checkRateLimit('test-key', 5, 100);
          expect(result.allowed).toBe(true);
          resolve();
        }, 150);
      });
    });
  });

  describe('resetRateLimit', () => {
    test('should reset rate limit for key', () => {
      // Make some requests
      SecurityUtils.checkRateLimit('test-key', 5, 60000);
      SecurityUtils.checkRateLimit('test-key', 5, 60000);

      // Reset
      SecurityUtils.resetRateLimit('test-key');

      // Should be back to full limit
      const result = SecurityUtils.checkRateLimit('test-key', 5, 60000);
      expect(result.remaining).toBe(4); // 5 - 1 (current request)
    });
  });

  describe('maskSensitiveData', () => {
    test('should mask email addresses', () => {
      const email = 'user@example.com';
      const masked = SecurityUtils.maskSensitiveData(email);

      expect(masked).toMatch(/^us\*+om$/);
      expect(masked).not.toBe(email);
    });

    test('should handle short strings', () => {
      const short = 'ab';
      const masked = SecurityUtils.maskSensitiveData(short);

      expect(masked).toBe('***');
    });

    test('should handle empty or null input', () => {
      expect(SecurityUtils.maskSensitiveData('')).toBe('***');
      expect(SecurityUtils.maskSensitiveData(null)).toBe('***');
      expect(SecurityUtils.maskSensitiveData(undefined)).toBe('***');
    });
  });

  describe('generateResetToken', () => {
    test('should generate reset token', () => {
      const token = SecurityUtils.generateResetToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    test('should generate unique tokens', () => {
      const token1 = SecurityUtils.generateResetToken();
      const token2 = SecurityUtils.generateResetToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('validatePasswordStrength', () => {
    test('should validate strong password', () => {
      const result = SecurityUtils.validatePasswordStrength('StrongP@ssw0rd123');

      expect(result.strength).toBe('very-strong');
      expect(result.score).toBeGreaterThan(4);
      expect(result.feedback).toContain('Password strength is good');
    });

    test('should identify weak password', () => {
      const result = SecurityUtils.validatePasswordStrength('123');

      expect(result.strength).toBe('weak');
      expect(result.score).toBeLessThan(3);
      expect(result.feedback.length).toBeGreaterThan(1);
    });

    test('should penalize repeated characters', () => {
      const result = SecurityUtils.validatePasswordStrength('aaaaaaaaA1!');

      expect(result.feedback).toContain('Avoid repeated characters');
    });

    test('should penalize common sequences', () => {
      const result = SecurityUtils.validatePasswordStrength('123abcA!');

      expect(result.feedback).toContain('Avoid common sequences');
    });

    test('should handle empty password', () => {
      const result = SecurityUtils.validatePasswordStrength('');

      expect(result.strength).toBe('very-weak');
      expect(result.score).toBe(0);
      expect(result.feedback).toContain('Password is required');
    });

    test('should handle null password', () => {
      const result = SecurityUtils.validatePasswordStrength(null);

      expect(result.strength).toBe('very-weak');
      expect(result.score).toBe(0);
    });
  });

  describe('cleanupRateLimit', () => {
    test('should remove expired entries', () => {
      // Add entry with short expiration
      SecurityUtils.checkRateLimit('test-key', 5, 100);
      
      expect(SecurityUtils.rateLimitStore.has('test-key')).toBe(true);

      // Wait for expiration and cleanup
      return new Promise((resolve) => {
        setTimeout(() => {
          SecurityUtils.cleanupRateLimit();
          expect(SecurityUtils.rateLimitStore.has('test-key')).toBe(false);
          resolve();
        }, 150);
      });
    });
  });
});