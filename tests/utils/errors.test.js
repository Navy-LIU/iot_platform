const {
  AppError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  UserNotFoundError,
  UserAlreadyExistsError,
  DatabaseError,
  createError,
  isOperationalError,
  handleDatabaseError
} = require('../../utils/errors');
const { HTTP_STATUS, ERROR_CODES } = require('../../utils');

describe('Error Utils', () => {
  describe('AppError', () => {
    test('should create basic app error', () => {
      const error = new AppError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(error.errorCode).toBe(ERROR_CODES.INTERNAL_ERROR);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });

    test('should create app error with custom status and code', () => {
      const error = new AppError('Custom error', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);

      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.errorCode).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    test('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'AppError',
        message: 'Test error',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        errorCode: ERROR_CODES.BAD_REQUEST,
        isOperational: true
      });
    });
  });

  describe('AuthenticationError', () => {
    test('should create authentication error with defaults', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('Authentication failed');
      expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(error.errorCode).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
    });

    test('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Token expired');

      expect(error.message).toBe('Token expired');
      expect(error.statusCode).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe('ValidationError', () => {
    test('should create validation error with fields', () => {
      const error = new ValidationError('Validation failed', ['email', 'password']);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.errorCode).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.fields).toEqual(['email', 'password']);
    });

    test('should serialize with fields', () => {
      const error = new ValidationError('Test', ['field1']);
      const json = error.toJSON();

      expect(json.fields).toEqual(['field1']);
    });
  });

  describe('NotFoundError', () => {
    test('should create not found error with resource', () => {
      const error = new NotFoundError('User', '123');

      expect(error.message).toBe('User with ID 123 not found');
      expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
      expect(error.resource).toBe('User');
      expect(error.resourceId).toBe('123');
    });

    test('should create not found error without ID', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.resource).toBe('User');
      expect(error.resourceId).toBeNull();
    });
  });

  describe('UserNotFoundError', () => {
    test('should create user not found error', () => {
      const error = new UserNotFoundError('123');

      expect(error.message).toBe('User with ID 123 not found');
      expect(error.errorCode).toBe(ERROR_CODES.USER_NOT_FOUND);
      expect(error.resource).toBe('User');
      expect(error.resourceId).toBe('123');
    });
  });

  describe('UserAlreadyExistsError', () => {
    test('should create user already exists error', () => {
      const error = new UserAlreadyExistsError('test@example.com');

      expect(error.message).toBe('User with email test@example.com already exists');
      expect(error.statusCode).toBe(HTTP_STATUS.CONFLICT);
      expect(error.errorCode).toBe(ERROR_CODES.USER_ALREADY_EXISTS);
      expect(error.field).toBe('email');
      expect(error.value).toBe('test@example.com');
    });
  });

  describe('DatabaseError', () => {
    test('should create database error', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseError('DB operation failed', originalError);

      expect(error.message).toBe('DB operation failed');
      expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(error.errorCode).toBe(ERROR_CODES.DATABASE_QUERY_ERROR);
      expect(error.originalError).toBe(originalError);
    });

    test('should include original error in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const originalError = new Error('Connection failed');
      originalError.code = '08000';
      originalError.detail = 'Connection timeout';

      const error = new DatabaseError('DB error', originalError);
      const json = error.toJSON();

      expect(json.originalError).toEqual({
        message: 'Connection failed',
        code: '08000',
        detail: 'Connection timeout'
      });

      process.env.NODE_ENV = originalEnv;
    });

    test('should not include original error in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const originalError = new Error('Connection failed');
      const error = new DatabaseError('DB error', originalError);
      const json = error.toJSON();

      expect(json.originalError).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('createError factory', () => {
    test('should create authentication errors', () => {
      const error = createError.authenticationFailed('Invalid credentials');

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid credentials');
    });

    test('should create validation errors', () => {
      const error = createError.validationFailed('Invalid input', ['email']);

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.fields).toEqual(['email']);
    });

    test('should create user not found error', () => {
      const error = createError.userNotFound('123');

      expect(error).toBeInstanceOf(UserNotFoundError);
      expect(error.resourceId).toBe('123');
    });

    test('should create user already exists error', () => {
      const error = createError.userAlreadyExists('test@example.com');

      expect(error).toBeInstanceOf(UserAlreadyExistsError);
      expect(error.value).toBe('test@example.com');
    });

    test('should create database error', () => {
      const originalError = new Error('DB failed');
      const error = createError.databaseError('Operation failed', originalError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.originalError).toBe(originalError);
    });

    test('should create generic errors', () => {
      const badRequestError = createError.badRequest('Bad input');
      const internalError = createError.internalError('Server error');

      expect(badRequestError.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(internalError.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    });
  });

  describe('isOperationalError', () => {
    test('should identify operational errors', () => {
      const appError = new AppError('Test error');
      const genericError = new Error('Generic error');

      expect(isOperationalError(appError)).toBe(true);
      expect(isOperationalError(genericError)).toBe(false);
    });
  });

  describe('handleDatabaseError', () => {
    test('should handle unique violation for email', () => {
      const dbError = new Error('Duplicate key');
      dbError.code = '23505';
      dbError.constraint = 'users_email_key';
      dbError.detail = 'Key (email)=(test@example.com) already exists.';

      const error = handleDatabaseError(dbError);

      expect(error).toBeInstanceOf(UserAlreadyExistsError);
    });

    test('should handle generic unique violation', () => {
      const dbError = new Error('Duplicate key');
      dbError.code = '23505';
      dbError.constraint = 'some_other_key';

      const error = handleDatabaseError(dbError);

      expect(error.statusCode).toBe(HTTP_STATUS.CONFLICT);
      expect(error.message).toBe('Resource already exists');
    });

    test('should handle foreign key violation', () => {
      const dbError = new Error('Foreign key violation');
      dbError.code = '23503';

      const error = handleDatabaseError(dbError);

      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.message).toBe('Invalid reference');
    });

    test('should handle not null violation', () => {
      const dbError = new Error('Not null violation');
      dbError.code = '23502';
      dbError.column = 'email';

      const error = handleDatabaseError(dbError);

      expect(error.statusCode).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(error.errorCode).toBe(ERROR_CODES.MISSING_REQUIRED_FIELDS);
    });

    test('should handle connection errors', () => {
      const dbError = new Error('Connection failed');
      dbError.code = '08000';

      const error = handleDatabaseError(dbError);

      expect(error.statusCode).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(error.errorCode).toBe(ERROR_CODES.DATABASE_CONNECTION_ERROR);
    });

    test('should handle unknown database errors', () => {
      const dbError = new Error('Unknown error');
      dbError.code = '99999';

      const error = handleDatabaseError(dbError);

      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.message).toBe('Database operation failed');
    });
  });
});