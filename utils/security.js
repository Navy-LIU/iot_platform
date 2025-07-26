const crypto = require('crypto');

/**
 * Security utility functions
 */
class SecurityUtils {
  /**
   * Generate a secure random string
   * @param {number} length - Length of the random string
   * @returns {string} Random string
   */
  static generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a secure session ID
   * @returns {string} Session ID
   */
  static generateSessionId() {
    return this.generateRandomString(32);
  }

  /**
   * Hash a string using SHA-256
   * @param {string} input - Input string to hash
   * @returns {string} Hashed string
   */
  static hashString(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Generate a fingerprint from request headers
   * @param {Object} req - Express request object
   * @returns {string} Request fingerprint
   */
  static generateRequestFingerprint(req) {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip || ''
    ];
    
    return this.hashString(components.join('|'));
  }

  /**
   * Sanitize user input to prevent XSS
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
  }

  /**
   * Check if IP address is in a valid format
   * @param {string} ip - IP address to validate
   * @returns {boolean} True if valid IP
   */
  static isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Extract client information from request
   * @param {Object} req - Express request object
   * @returns {Object} Client information
   */
  static extractClientInfo(req) {
    return {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || 'Unknown',
      fingerprint: this.generateRequestFingerprint(req),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simple rate limiting check (in-memory)
   * Note: In production, use Redis or similar for distributed rate limiting
   */
  static rateLimitStore = new Map();

  /**
   * Check rate limit for a key
   * @param {string} key - Rate limit key (e.g., IP address)
   * @param {number} maxAttempts - Maximum attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} Rate limit result
   */
  static checkRateLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const record = this.rateLimitStore.get(key) || { attempts: 0, resetTime: now + windowMs };
    
    // Reset if window has passed
    if (now > record.resetTime) {
      record.attempts = 0;
      record.resetTime = now + windowMs;
    }
    
    // Check if limit exceeded
    if (record.attempts >= maxAttempts) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      };
    }
    
    // Increment attempts
    record.attempts++;
    this.rateLimitStore.set(key, record);
    
    return {
      allowed: true,
      remaining: maxAttempts - record.attempts,
      resetTime: record.resetTime,
      retryAfter: 0
    };
  }

  /**
   * Reset rate limit for a key
   * @param {string} key - Rate limit key
   */
  static resetRateLimit(key) {
    this.rateLimitStore.delete(key);
  }

  /**
   * Clean up expired rate limit entries
   */
  static cleanupRateLimit() {
    const now = Date.now();
    
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (now > record.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Mask sensitive data for logging
   * @param {string} data - Data to mask
   * @param {number} visibleChars - Number of visible characters at start/end
   * @returns {string} Masked data
   */
  static maskSensitiveData(data, visibleChars = 2) {
    if (!data || typeof data !== 'string' || data.length <= visibleChars * 2) {
      return '***';
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(Math.max(3, data.length - visibleChars * 2));
    
    return `${start}${middle}${end}`;
  }

  /**
   * Generate a secure password reset token
   * @returns {string} Reset token
   */
  static generateResetToken() {
    return this.generateRandomString(64);
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result with score and feedback
   */
  static validatePasswordStrength(password) {
    if (!password || typeof password !== 'string') {
      return {
        score: 0,
        strength: 'very-weak',
        feedback: ['Password is required']
      };
    }

    let score = 0;
    const feedback = [];

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('Use at least 8 characters');

    if (password.length >= 12) score += 1;

    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Include numbers');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('Include special characters');

    // Common patterns check
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Avoid repeated characters');
    }

    if (/123|abc|qwe/i.test(password)) {
      score -= 1;
      feedback.push('Avoid common sequences');
    }

    // Determine strength
    let strength;
    if (score <= 2) strength = 'weak';
    else if (score <= 4) strength = 'medium';
    else if (score <= 5) strength = 'strong';
    else strength = 'very-strong';

    return {
      score: Math.max(0, score),
      strength,
      feedback: feedback.length > 0 ? feedback : ['Password strength is good']
    };
  }
}

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  SecurityUtils.cleanupRateLimit();
}, 5 * 60 * 1000);

module.exports = SecurityUtils;