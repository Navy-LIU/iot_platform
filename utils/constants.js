// JWT related constants
const JWT_CONSTANTS = {
  TOKEN_TYPES: {
    AUTH: 'auth',
    REFRESH: 'refresh',
    RESET: 'reset',
    VERIFY: 'verify'
  },
  
  DEFAULT_EXPIRATION: {
    AUTH: '24h',
    REFRESH: '7d',
    RESET: '1h',
    VERIFY: '24h'
  },
  
  ISSUER: 'zeabur-server-demo',
  AUDIENCE: 'zeabur-server-demo-users',
  
  HEADER_PREFIX: 'Bearer ',
  
  ERROR_MESSAGES: {
    INVALID_TOKEN: 'Invalid token',
    EXPIRED_TOKEN: 'Token has expired',
    MISSING_TOKEN: 'Token is required',
    INVALID_FORMAT: 'Invalid token format',
    INVALID_USER: 'Invalid user data',
    INVALID_PAYLOAD: 'Invalid token payload',
    GENERATION_FAILED: 'Token generation failed',
    VERIFICATION_FAILED: 'Token verification failed'
  }
};

// HTTP Status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

// Error codes for API responses
const ERROR_CODES = {
  // Authentication errors
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_CREDENTIALS_INVALID: 'AUTH_CREDENTIALS_INVALID',
  
  // User errors
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_INVALID_EMAIL: 'USER_INVALID_EMAIL',
  USER_INVALID_PASSWORD: 'USER_INVALID_PASSWORD',
  
  // Database errors
  DATABASE_CONNECTION_ERROR: 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR: 'DATABASE_QUERY_ERROR',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
  
  // General errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST'
};

module.exports = {
  JWT_CONSTANTS,
  HTTP_STATUS,
  ERROR_CODES
};