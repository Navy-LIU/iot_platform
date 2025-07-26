const request = require('supertest');
const express = require('express');
const userRoutes = require('../../routes/user');
const { User } = require('../../models');
const { JWTUtils } = require('../../utils');
const { errorHandler, auth } = require('../../middleware');
const dbConnection = require('../../db/connection');

describe('User Routes', () => {
  let app;
  let testUser;
  let accessToken;

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
    
    // Create test user
    testUser = await User.create({
      email: 'testuser@example.com',
      password: 'password123'
    });

    // Generate access token
    accessToken = JWTUtils.generateAuthToken(testUser);
    
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/user', userRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await dbConnection.query('DELETE FROM users');
    await dbConnection.disconnect();
  });

  describe('GET /api/user/profile', () => {
    test('should get current user profile', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.tokenInfo).toBeDefined();
      expect(response.body.data.tokenInfo.userId).toBe(testUser.id);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('PUT /api/user/profile', () => {
    test('should update user email', async () => {
      const newEmail = 'newemail@example.com';
      
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(newEmail);

      // Verify in database
      const updatedUser = await User.findById(testUser.id);
      expect(updatedUser.email).toBe(newEmail);
    });

    test('should normalize email to lowercase', async () => {
      const newEmail = 'UPPERCASE@EXAMPLE.COM';
      
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: newEmail });

      expect(response.status).toBe(200);
      expect(response.body.data.user.email).toBe('uppercase@example.com');
    });

    test('should reject missing email', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject invalid email format', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'invalid-email' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_EMAIL');
    });

    test('should reject email already taken by another user', async () => {
      // Create another user
      const anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: anotherUser.email });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    test('should allow updating to same email', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: testUser.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/user/profile')
        .send({ email: 'new@example.com' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/user/:id', () => {
    let anotherUser;

    beforeEach(async () => {
      anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123'
      });
    });

    test('should get user by ID', async () => {
      const response = await request(app)
        .get(`/api/user/${anotherUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.id).toBe(anotherUser.id);
      expect(response.body.data.user.email).toBe(anotherUser.email);
      // Should return public profile (no sensitive data)
      expect(response.body.data.user.updatedAt).toBeUndefined();
    });

    test('should reject invalid user ID', async () => {
      const response = await request(app)
        .get('/api/user/invalid')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    test('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/user/99999')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/user/${anotherUser.id}`);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/user/profile', () => {
    test('should delete user account with correct password', async () => {
      const response = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmPassword: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');

      // Verify user is deleted from database
      const deletedUser = await User.findById(testUser.id);
      expect(deletedUser).toBeNull();
    });

    test('should reject deletion without password confirmation', async () => {
      const response = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject deletion with wrong password', async () => {
      const response = await request(app)
        .delete('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmPassword: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/user/profile')
        .send({ confirmPassword: 'password123' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/user/change-password', () => {
    test('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmNewPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify new password works
      const updatedUser = await User.findById(testUser.id);
      const isNewPasswordValid = await updatedUser.verifyPassword('newpassword123');
      expect(isNewPasswordValid).toBe(true);

      // Verify old password no longer works
      const isOldPasswordValid = await updatedUser.verifyPassword('password123');
      expect(isOldPasswordValid).toBe(false);
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ currentPassword: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    test('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should reject weak new password', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_PASSWORD');
    });

    test('should reject same password as current', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('New password must be different from current password');
    });

    test('should reject mismatched password confirmation', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
          confirmNewPassword: 'differentpassword'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('New passwords do not match');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/user/change-password')
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/user/stats', () => {
    test('should get user statistics', async () => {
      const response = await request(app)
        .get('/api/user/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.account).toBeDefined();
      expect(response.body.data.session).toBeDefined();
      expect(response.body.data.account.id).toBe(testUser.id);
      expect(response.body.data.account.email).toBe(testUser.email);
      expect(response.body.data.account.accountAgeDays).toBeDefined();
      expect(response.body.data.session.tokenIssuedAt).toBeDefined();
      expect(response.body.data.session.tokenExpiresAt).toBeDefined();
      expect(response.body.data.session.tokenAgeMinutes).toBeDefined();
      expect(response.body.data.session.remainingMinutes).toBeDefined();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/user/stats');

      expect(response.status).toBe(401);
    });
  });
});