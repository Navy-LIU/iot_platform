const request = require('supertest');
const express = require('express');
const { 
  authenticateToken, 
  optionalAuth, 
  requireAuth, 
  requireOwnership,
  extractUserFromToken,
  validateRefreshToken
} = require('../../middleware/auth');
const { JWTUtils, HTTP_STATUS, ERROR_CODES } = require('../../utils');
const { User } = require('../../models');
const dbConnection = require('../../db/connection');

describe('Authentication Middleware', () => {
  let app;
  let testUser;
  let validToken;
  let refreshToken;

  beforeAll(async () => {
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
    // Clean up and create test user
    await dbConnection.query('DELETE FROM users');
    
    testUser = await User.create({
      email: 'test@example.com',
      password: 'password123'
    });

    validToken = JWTUtils.generateAuthToken(testUser);
    refreshToken = JWTUtils.generateRefreshToken(testUser);

    // Create Express app for testing
    app = express();
    app.use(express.json());
  });

  afterAll(async () => {
    await dbConnection.query('DELETE FROM users');
    await dbConnection.disconnect();
  });

  describe('authenticateToken middleware', () => {
    beforeEach(() => {
      app.get('/protected', authenticateToken, (req, res) => {
        res.json({
          success: true,
          user: req.user.toJSON(),
          token: req.token
        });
      });
    });

    test('should authenticate valid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.token.userId).toBe(testUser.id);
    });

    test('should authenticate token without Bearer prefix', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', validToken);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    test('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/protected');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_MISSING);
    });

    test('should reject empty token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer ');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_MISSING);
    });

    test('should reject invalid token format', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
    });

    test('should reject expired token', async () => {
      const expiredToken = JWTUtils.generateToken({
        userId: testUser.id,
        email: testUser.email,
        type: 'auth'
      }, { expiresIn: '0s' });

      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    });

    test('should reject refresh token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
      expect(response.body.error.message).toBe('Invalid token type');
    });

    test('should reject token for non-existent user', async () => {
      // Delete the user
      await testUser.delete();

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.USER_NOT_FOUND);
    });
  });

  describe('optionalAuth middleware', () => {
    beforeEach(() => {
      app.get('/optional', optionalAuth, (req, res) => {
        res.json({
          success: true,
          authenticated: !!req.user,
          user: req.user ? req.user.toJSON() : null
        });
      });
    });

    test('should authenticate when valid token provided', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.authenticated).toBe(true);
      expect(response.body.user.id).toBe(testUser.id);
    });

    test('should continue without authentication when no token provided', async () => {
      const response = await request(app)
        .get('/optional');

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.authenticated).toBe(false);
      expect(response.body.user).toBeNull();
    });
  });

  describe('requireAuth middleware', () => {
    beforeEach(() => {
      app.get('/require-auth', authenticateToken, requireAuth, (req, res) => {
        res.json({ success: true, user: req.user.toJSON() });
      });

      app.get('/require-auth-optional', optionalAuth, requireAuth, (req, res) => {
        res.json({ success: true, user: req.user.toJSON() });
      });
    });

    test('should pass when user is authenticated', async () => {
      const response = await request(app)
        .get('/require-auth')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    test('should fail when user is not authenticated', async () => {
      const response = await request(app)
        .get('/require-auth-optional');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_MISSING);
    });
  });

  describe('requireOwnership middleware', () => {
    let anotherUser;

    beforeEach(async () => {
      anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123'
      });

      app.get('/user/:userId', authenticateToken, requireOwnership, (req, res) => {
        res.json({ success: true, user: req.user.toJSON() });
      });

      app.get('/profile/:id', authenticateToken, requireOwnership, (req, res) => {
        res.json({ success: true, user: req.user.toJSON() });
      });
    });

    test('should allow access to own resource', async () => {
      const response = await request(app)
        .get(`/user/${testUser.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    test('should allow access using id parameter', async () => {
      const response = await request(app)
        .get(`/profile/${testUser.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
    });

    test('should deny access to other user resource', async () => {
      const response = await request(app)
        .get(`/user/${anotherUser.id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_CREDENTIALS_INVALID);
    });

    test('should require authentication first', async () => {
      const response = await request(app)
        .get(`/user/${testUser.id}`);

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe('extractUserFromToken middleware', () => {
    beforeEach(() => {
      app.get('/extract', extractUserFromToken, (req, res) => {
        res.json({
          success: true,
          tokenUser: req.tokenUser,
          token: req.token
        });
      });
    });

    test('should extract user info from valid token', async () => {
      const response = await request(app)
        .get('/extract')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.tokenUser.id).toBe(testUser.id);
      expect(response.body.tokenUser.email).toBe(testUser.email);
      expect(response.body.token.userId).toBe(testUser.id);
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/extract')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
    });

    test('should reject missing token', async () => {
      const response = await request(app)
        .get('/extract');

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_MISSING);
    });
  });

  describe('validateRefreshToken middleware', () => {
    beforeEach(() => {
      app.post('/refresh', validateRefreshToken, (req, res) => {
        res.json({
          success: true,
          user: req.user.toJSON(),
          refreshToken: req.refreshToken
        });
      });
    });

    test('should validate valid refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(HTTP_STATUS.OK);
      expect(response.body.success).toBe(true);
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.refreshToken.decoded.type).toBe('refresh');
    });

    test('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({});

      expect(response.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_MISSING);
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
    });

    test('should reject auth token as refresh token', async () => {
      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken: validToken });

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.AUTH_TOKEN_INVALID);
      expect(response.body.error.message).toBe('Invalid token type');
    });

    test('should reject refresh token for non-existent user', async () => {
      // Delete the user
      await testUser.delete();

      const response = await request(app)
        .post('/refresh')
        .send({ refreshToken });

      expect(response.status).toBe(HTTP_STATUS.UNAUTHORIZED);
      expect(response.body.error.code).toBe(ERROR_CODES.USER_NOT_FOUND);
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      // Disconnect database to simulate error
      await dbConnection.disconnect();

      app.get('/db-error', authenticateToken, (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/db-error')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      expect(response.body.error.code).toBe(ERROR_CODES.INTERNAL_ERROR);

      // Reconnect for cleanup
      await dbConnection.connect();
    });
  });
});