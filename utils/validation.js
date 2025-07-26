const { createError } = require('./errors');

/**
 * Validation utility functions
 */
class ValidationUtils {
  /**
   * Validate required fields in request body
   * @param {Object} data - Request data
   * @param {Array} requiredFields - Array of required field names
   * @throws {MissingFieldsError} If any required fields are missing
   */
  static validateRequiredFields(data, requiredFields) {
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      throw createError.missingFields(missingFields);
    }
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @throws {InvalidEmailError} If email format is invalid
   */
  static validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw createError.invalidEmail(email);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw createError.invalidEmail(email);
    }
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @param {Object} options - Validation options
   * @throws {InvalidPasswordError} If password doesn't meet requirements
   */
  static validatePassword(password, options = {}) {
    const {
      minLength = 6,
      maxLength = 128,
      requireUppercase = false,
      requireLowercase = false,
      requireNumbers = false,
      requireSpecialChars = false
    } = options;

    if (!password || typeof password !== 'string') {
      throw createError.invalidPassword('Password is required');
    }

    if (password.length < minLength) {
      throw createError.invalidPassword(`Password must be at least ${minLength} characters long`);
    }

    if (password.length > maxLength) {
      throw createError.invalidPassword(`Password must be no more than ${maxLength} characters long`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
      throw createError.invalidPassword('Password must contain at least one uppercase letter');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
      throw createError.invalidPassword('Password must contain at least one lowercase letter');
    }

    if (requireNumbers && !/\d/.test(password)) {
      throw createError.invalidPassword('Password must contain at least one number');
    }

    if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw createError.invalidPassword('Password must contain at least one special character');
    }
  }

  /**
   * Validate password confirmation
   * @param {string} password - Original password
   * @param {string} confirmPassword - Password confirmation
   * @throws {ValidationError} If passwords don't match
   */
  static validatePasswordConfirmation(password, confirmPassword) {
    if (confirmPassword && password !== confirmPassword) {
      throw createError.validationFailed('Passwords do not match', ['confirmPassword']);
    }
  }

  /**
   * Sanitize string input
   * @param {string} input - Input to sanitize
   * @returns {string} Sanitized input
   */
  static sanitizeString(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    return input.trim();
  }

  /**
   * Sanitize email input
   * @param {string} email - Email to sanitize
   * @returns {string} Sanitized email
   */
  static sanitizeEmail(email) {
    if (typeof email !== 'string') {
      return email;
    }
    
    return email.toLowerCase().trim();
  }

  /**
   * Validate and sanitize user registration data
   * @param {Object} data - Registration data
   * @returns {Object} Sanitized data
   */
  static validateRegistrationData(data) {
    const { email, password, confirmPassword } = data;

    // Validate required fields
    this.validateRequiredFields(data, ['email', 'password']);

    // Validate email
    this.validateEmail(email);

    // Validate password
    this.validatePassword(password);

    // Validate password confirmation if provided
    if (confirmPassword) {
      this.validatePasswordConfirmation(password, confirmPassword);
    }

    // Return sanitized data
    return {
      email: this.sanitizeEmail(email),
      password: password // Don't sanitize password to preserve exact input
    };
  }

  /**
   * Validate and sanitize user login data
   * @param {Object} data - Login data
   * @returns {Object} Sanitized data
   */
  static validateLoginData(data) {
    const { email, password } = data;

    // Validate required fields
    this.validateRequiredFields(data, ['email', 'password']);

    // Validate email format
    this.validateEmail(email);

    // Return sanitized data
    return {
      email: this.sanitizeEmail(email),
      password: password
    };
  }

  /**
   * Validate pagination parameters
   * @param {Object} query - Query parameters
   * @returns {Object} Validated pagination params
   */
  static validatePagination(query) {
    const { page = 1, limit = 10 } = query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      throw createError.badRequest('Page must be a positive integer');
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw createError.badRequest('Limit must be between 1 and 100');
    }

    return {
      page: pageNum,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    };
  }

  /**
   * Validate ID parameter
   * @param {string|number} id - ID to validate
   * @returns {number} Validated ID
   */
  static validateId(id) {
    const numId = parseInt(id);
    
    if (isNaN(numId) || numId < 1) {
      throw createError.badRequest('Invalid ID format');
    }
    
    return numId;
  }
}

module.exports = ValidationUtils;