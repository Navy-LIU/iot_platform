const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const { User } = require('../../models');
const { JWTUtils } = require('../../utils');
const { errorHandler } = require('../../middleware');
const dbConnection = require('../../db/connection');

describe('Auth Routes', () => {
  let app;

  beforeAll(async () => {
    // Connect to test database
    await dbConnection.connect();
    
    // Setup test database
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  beforeEach(async () => {
    // Clean up users table
    await dbConnection.query('DELETE FROM users');
    
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await dbConnection.query('DELETE FROM users');
    await dbConnection.disconnect();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'password123'
    };

    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(validUserData.email);
      expect(response.body.data.user.id).toBeDefined();
      expect(response.body.data.tokens).toBeDefined();
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.tokens.tokenType).toBe('Bearer');
    });

    test('should register user with password confirmation', async () => {
      const userData = {
        ...validUserData,
        confirmPassword: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    test('should normalize email to lowercase', async () => {
      const userData = {
        email: 'TEST@EXAMPLE.COM',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    test('should reject registration without email', async () => {
      const userData = {
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject registration without password', async () => {
      const userData = {
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject invalid email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_EMAIL');
    });

    test('should reject weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_PASSWORD');
    });

    test('should reject mismatched password confirmation', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Passwords do not match');
    });

    test('should reject duplicate email registration', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // Create test user
      testUser = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
      
      // Clear rate limit store
      const SecurityUtils = require('../../utils/security');
      SecurityUtils.rateLimitStore.clear();
    });

    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.tokens.accessToken).toBeDefined();
      expect(response.body.data.tokens.refreshToken).toBeDefined();
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.session.rememberMe).toBe(false);
    });

    test('should login with remember me option', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          rememberMe: true
        });

      expect(response.status).toBe(200);
      expect(response.body.data.session.rememberMe).toBe(true);
      expect(response.body.data.tokens.expiresIn).toBe('30d');
    });

    test('should login with case-insensitive email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'TEST@EXAMPLE.COM',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject login without email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject login without password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_EMAIL');
    });

    test('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    test('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
      expect(response.body.error.message).toBe('Invalid email or password');
    });

    test('should implement rate limiting', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    test('should reset rate limit on successful login', async () => {
      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
      }

      // Successful login should reset rate limit
      const successResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(successResponse.status).toBe(200);

      // Should be able to make more attempts after reset
      const nextResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(nextResponse.status).toBe(401); // Not rate limited
    });
  });

  describe('POST /api/auth/refresh', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
      
      refreshToken = JWTUtils.generateRefreshToken(testUser);
    });

    test('should refresh token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.tokenType).toBe('Bearer');
    });

    test('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should reject access token as refresh token', async () => {
      const accessToken = JWTUtils.generateAuthToken(testUser);
      
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout successful');
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
      
      accessToken = JWTUtils.generateAuthToken(testUser);
    });

    test('should get user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.tokenInfo).toBeDefined();
      expect(response.body.data.tokenInfo.userId).toBe(testUser.id);
    });

    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('POST /api/auth/validate', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
      
      accessToken = JWTUtils.generateAuthToken(testUser);
    });

    test('should validate valid token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: accessToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.email).toBe(testUser.email);
    });

    test('should return invalid for bad token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({ token: 'invalid-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.reason).toBeDefined();
    });

    test('should reject request without token', async () => {
      const response = await request(app)
        .post('/api/auth/validate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('POST /api/auth/check-password-strength', () => {
    test('should check strong password', async () => {
      const response = await request(app)
        .post('/api/auth/check-password-strength')
        .send({ password: 'StrongP@ssw0rd123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.strength).toBe('very-strong');
      expect(response.body.data.isAcceptable).toBe(true);
    });

    test('should check weak password', async () => {
      const response = await request(app)
        .post('/api/auth/check-password-strength')
        .send({ password: '123' });

      expect(response.status).toBe(200);
      expect(response.body.data.strength).toBe('weak');
      expect(response.body.data.isAcceptable).toBe(false);
      expect(response.body.data.feedback.length).toBeGreaterThan(1);
    });

    test('should require password field', async () => {
      const response = await request(app)
        .post('/api/auth/check-password-strength')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('GET /api/auth/login-info', () => {
    test('should return login information', async () => {
      const response = await request(app)
        .get('/api/auth/login-info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.requirements).toBeDefined();
      expect(response.body.data.security).toBeDefined();
      expect(response.body.data.endpoints).toBeDefined();
      expect(response.body.data.requirements.email.required).toBe(true);
      expect(response.body.data.requirements.password.minLength).toBe(6);
      expect(response.body.data.security.rateLimiting.maxAttempts).toBe(5);
    });
  });
});