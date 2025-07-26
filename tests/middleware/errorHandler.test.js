const request = require('supertest');
const express = require('express');
const { errorHandler, notFoundHandler, asyncHandler } = require('../../middleware/errorHandler');
const { AppError, createError } = require('../../utils/errors');
const { HTTP_STATUS, ERROR_CODES } = require('../../utils');

describe('Error Handler Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('errorHandler', () => {
    beforeEach(() => {
      // Add error handler as last middleware
      app.use(errorHandler);
    });

    test('should handle AppError correctly', async () => {
      app.get('/app-error', (req, res, next) => {
        next(createError.userNotFound('123'));
      });

      const response = await request(app).get('/app-error');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.USER_NOT_FOUND);
      expect(response.body.error.message).toContain('User with ID 123 not found');
    });

    test('should handle validation errors', async () => {
      app.get('/validation-error', (req, res, next) => {
        next(createError.validationFailed('Invalid input', ['email', 'password']));
      });

      const response = await request(app).get('/validation-error');

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(response.body.error.message).toBe('Invalid input');
    });

    test('should handle authentication errors', async () => {
      app.get('/auth-error', (req, res, next) => {
        next(createError.authenticationFailed('Invalid token'));
      });

      const response = await request(app).get('/auth-error');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
      expect(response.body.error.message).toBe('Invalid token');
    });

    test('should handle database errors', async () => {
      app.get('/db-error', (req, res, next) => {
        const dbError = new Error('Connection failed');
        dbError.code = '08000'; // PostgreSQL connection error
        next(dbError);
      });

      const response = await request(app).get('/db-error');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body.error.code).toBe(ERROR_CODES.DATABASE_CONNECTION_ERROR);
    });

    test('should handle PostgreSQL unique violation', async () => {
      app.get('/unique-error', (req, res, next) => {
        const dbError = new Error('Duplicate key');
        dbError.code = '23505';
        dbError.constraint = 'users_email_key';
        dbError.detail = 'Key (email)=(test@example.com) already exists.';
        next(dbError);
      });

      const response = await request(app).get('/unique-error');

      expect(response.status).toBe(HTTP_STATUS.CONFLICT);
      expect(response.body.error.code).toBe(ERROR_CODES.USER_ALREADY_EXISTS);
    });

    test('should handle JSON parse errors', async () => {
      app.post('/json-error', (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/json-error')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
      expect(response.body.error.message).toBe('Invalid JSON format');
    });

    test('should handle generic errors', async () => {
      app.get('/generic-error', (req, res, next) => {
        next(new Error('Something went wrong'));
      });

      const response = await request(app).get('/generic-error');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);
    });

    test('should include details in development environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      app.get('/dev-error', (req, res, next) => {
        next(createError.internalError('Development error'));
      });

      const response = await request(app).get('/dev-error');

      expect(response.body.error.details).toBeDefined();
      expect(response.body.error.details.name).toBeDefined();
      expect(response.body.error.details.statusCode).toBeDefined();
      expect(response.body.error.details.stack).toBeDefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should not include details in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      app.get('/prod-error', (req, res, next) => {
        next(createError.internalError('Production error'));
      });

      const response = await request(app).get('/prod-error');

      expect(response.body.error.details).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    test('should handle rate limiting errors with retry-after header', async () => {
      app.get('/rate-limit', (req, res, next) => {
        next(createError.rateLimitExceeded('Too many requests', 60));
      });

      const response = await request(app).get('/rate-limit');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
    });

    test('should log user information when available', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      app.get('/user-error', (req, res, next) => {
        req.user = { id: 1, email: 'test@example.com' };
        next(createError.badRequest('User error'));
      });

      await request(app).get('/user-error');

      expect(consoleSpy).toHaveBeenCalled();
      const logCall = consoleSpy.mock.calls[0][1];
      expect(logCall.user).toEqual({ id: 1, email: 'test@example.com' });

      consoleSpy.mockRestore();
    });
  });

  describe('notFoundHandler', () => {
    beforeEach(() => {
      app.use(notFoundHandler);
    });

    test('should handle 404 for GET requests', async () => {
      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(response.body.error.message).toBe('Route GET /nonexistent not found');
    });

    test('should handle 404 for POST requests', async () => {
      const response = await request(app).post('/nonexistent');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body.error.message).toBe('Route POST /nonexistent not found');
    });

    test('should handle 404 for requests with query parameters', async () => {
      const response = await request(app).get('/nonexistent?param=value');

      expect(response.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(response.body.error.message).toBe('Route GET /nonexistent?param=value not found');
    });
  });

  describe('asyncHandler', () => {
    test('should catch async errors', async () => {
      const asyncRoute = asyncHandler(async (req, res, next) => {
        throw createError.internalError('Async error');
      });

      app.get('/async-error', asyncRoute);
      app.use(errorHandler);

      const response = await request(app).get('/async-error');

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body.error.message).toBe('Async error');
    });

    test('should handle successful async operations', async () => {
      const asyncRoute = asyncHandler(async (req, res) => {
        res.json({ success: true, message: 'Async success' });
      });

      app.get('/async-success', asyncRoute);

      const response = await request(app).get('/async-success');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Async success');
    });

    test('should handle async operations that return promises', async () => {
      const asyncRoute = asyncHandler((req, res) => {
        return Promise.resolve().then(() => {
          res.json({ success: true });
        });
      });

      app.get('/async-promise', asyncRoute);

      const response = await request(app).get('/async-promise');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle rejected promises', async () => {
      const asyncRoute = asyncHandler((req, res) => {
        return Promise.reject(createError.badRequest('Promise rejected'));
      });

      app.get('/async-reject', asyncRoute);
      app.use(errorHandler);

      const response = await request(app).get('/async-reject');

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.error.message).toBe('Promise rejected');
    });
  });

  describe('Error logging', () => {
    test('should log different error levels appropriately', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Server error (500)
      app.get('/server-error', (req, res, next) => {
        next(createError.internalError('Server error'));
      });

      // Client error (400)
      app.get('/client-error', (req, res, next) => {
        next(createError.badRequest('Client error'));
      });

      app.use(errorHandler);

      await request(app).get('/server-error');
      expect(consoleErrorSpy).toHaveBeenCalled();

      await request(app).get('/client-error');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});