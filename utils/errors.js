const { HTTP_STATUS, ERROR_CODES } = require('./constants');

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR, errorCode = ERROR_CODES.INTERNAL_ERROR) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      isOperational: this.isOperational
    };
  }
}

/**
 * Authentication related errors
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', errorCode = ERROR_CODES.AUTH_TOKEN_INVALID) {
    super(message, HTTP_STATUS.UNAUTHORIZED, errorCode);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', errorCode = ERROR_CODES.AUTH_CREDENTIALS_INVALID) {
    super(message, HTTP_STATUS.FORBIDDEN, errorCode);
  }
}

class TokenExpiredError extends AppError {
  constructor(message = 'Token has expired') {
    super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.AUTH_TOKEN_EXPIRED);
  }
}

/**
 * Validation related errors
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', fields = []) {
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    this.fields = fields;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields
    };
  }
}

class MissingFieldsError extends AppError {
  constructor(fields = []) {
    const message = `Missing required fields: ${fields.join(', ')}`;
    super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.MISSING_REQUIRED_FIELDS);
    this.fields = fields;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      fields: this.fields
    };
  }
}

/**
 * Resource related errors
 */
class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = null) {
    const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`;
    super(message, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    this.resource = resource;
    this.resourceId = id;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      resource: this.resource,
      resourceId: this.resourceId
    };
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists', field = null, value = null) {
    super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.USER_ALREADY_EXISTS);
    this.field = field;
    this.value = value;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value
    };
  }
}

/**
 * Database related errors
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', originalError = null) {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_QUERY_ERROR);
    this.originalError = originalError;
  }

  toJSON() {
    const json = super.toJSON();
    
    if (process.env.NODE_ENV === 'development' && this.originalError) {
      json.originalError = {
        message: this.originalError.message,
        code: this.originalError.code,
        detail: this.originalError.detail
      };
    }
    
    return json;
  }
}

class DatabaseConnectionError extends AppError {
  constructor(message = 'Database connection failed') {
    super(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.DATABASE_CONNECTION_ERROR);
  }
}

/**
 * User related errors
 */
class UserNotFoundError extends NotFoundError {
  constructor(identifier = null) {
    super('User', identifier);
    this.errorCode = ERROR_CODES.USER_NOT_FOUND;
  }
}

class UserAlreadyExistsError extends ConflictError {
  constructor(email) {
    super(`User with email ${email} already exists`, 'email', email);
    this.errorCode = ERROR_CODES.USER_ALREADY_EXISTS;
  }
}

class InvalidEmailError extends ValidationError {
  constructor(email) {
    super(`Invalid email format: ${email}`, ['email']);
    this.errorCode = ERROR_CODES.USER_INVALID_EMAIL;
    this.email = email;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      email: this.email
    };
  }
}

class InvalidPasswordError extends ValidationError {
  constructor(message = 'Invalid password format') {
    super(message, ['password']);
    this.errorCode = ERROR_CODES.USER_INVALID_PASSWORD;
  }
}

/**
 * Rate limiting error
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      retryAfter: this.retryAfter
    };
  }
}

/**
 * Error factory functions
 */
const createError = {
  // Authentication errors
  authenticationFailed: (message) => new AuthenticationError(message),
  tokenExpired: () => new TokenExpiredError(),
  accessDenied: (message) => new AuthorizationError(message),
  
  // Validation errors
  validationFailed: (message, fields) => new ValidationError(message, fields),
  missingFields: (fields) => new MissingFieldsError(fields),
  invalidEmail: (email) => new InvalidEmailError(email),
  invalidPassword: (message) => new InvalidPasswordError(message),
  
  // Resource errors
  notFound: (resource, id) => new NotFoundError(resource, id),
  userNotFound: (identifier) => new UserNotFoundError(identifier),
  userAlreadyExists: (email) => new UserAlreadyExistsError(email),
  conflict: (message, field, value) => new ConflictError(message, field, value),
  
  // Database errors
  databaseError: (message, originalError) => new DatabaseError(message, originalError),
  databaseConnectionError: (message) => new DatabaseConnectionError(message),
  
  // Rate limiting
  rateLimitExceeded: (message, retryAfter) => new RateLimitError(message, retryAfter),
  
  // Generic errors
  badRequest: (message) => new AppError(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST),
  internalError: (message) => new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR)
};

/**
 * Check if error is operational (expected) or programming error
 */
const isOperationalError = (error) => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

/**
 * Convert database errors to application errors
 */
const handleDatabaseError = (error) => {
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // Unique violation
      if (error.constraint && error.constraint.includes('email')) {
        return createError.userAlreadyExists(error.detail);
      }
      return createError.conflict('Resource already exists');
      
    case '23503': // Foreign key violation
      return createError.badRequest('Invalid reference');
      
    case '23502': // Not null violation
      return createError.missingFields([error.column]);
      
    case '22001': // String data too long
      return createError.badRequest('Data too long for field');
      
    case '08000': // Connection exception
    case '08003': // Connection does not exist
    case '08006': // Connection failure
      return createError.databaseConnectionError('Database connection failed');
      
    default:
      return createError.databaseError('Database operation failed', error);
  }
};

module.exports = {
  // Error classes
  AppError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  ValidationError,
  MissingFieldsError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  DatabaseConnectionError,
  UserNotFoundError,
  UserAlreadyExistsError,
  InvalidEmailError,
  InvalidPasswordError,
  RateLimitError,
  
  // Factory functions
  createError,
  
  // Utility functions
  isOperationalError,
  handleDatabaseError
};