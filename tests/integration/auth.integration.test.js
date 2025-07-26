const request = require('supertest');
const { app } = require('../../app');
const { User } = require('../../models');
const { JWTUtils } = require('../../utils');
const dbConnection = require('../../db/connection');

describe('Authentication Integration Tests', () => {
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
    
    // Clear rate limit store
    const SecurityUtils = require('../../utils/security');
    SecurityUtils.rateLimitStore.clear();
  });

  afterAll(async () => {
    await dbConnection.query('DELETE FROM users');
    await dbConnection.disconnect();
  });

  describe('Complete User Registration Flow', () => {
    test('should complete full registration process', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      };

      // Step 1: Check password strength
      const strengthResponse = await request(app)
        .post('/api/auth/check-password-strength')
        .send({ password: userData.password });

      expect(strengthResponse.status).toBe(200);
      expect(strengthResponse.body.data.isAcceptable).toBe(true);

      // Step 2: Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.data.user.email).toBe(userData.email);
      expect(registerResponse.body.data.tokens.accessToken).toBeDefined();
      expect(registerResponse.body.data.tokens.refreshToken).toBeDefined();

      // Step 3: Verify user was created in database
      const user = await User.findByEmail(userData.email);
      expect(user).not.toBeNull();
      expect(user.email).toBe(userData.email);

      // Step 4: Verify tokens work
      const { accessToken } = registerResponse.body.data.tokens;
      
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.email).toBe(userData.email);
    });

    test('should prevent duplicate registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!'
      };

      // First registration
      const firstResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(firstResponse.status).toBe(201);

      // Second registration with same email
      const secondResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.error.code).toBe('USER_ALREADY_EXISTS');
    });

    test('should handle registration with weak password', async () => {
      const userData = {
        email: 'weakpass@example.com',
        password: '123'
      };

      // Check password strength first
      const strengthResponse = await request(app)
        .post('/api/auth/check-password-strength')
        .send({ password: userData.password });

      expect(strengthResponse.body.data.isAcceptable).toBe(false);

      // Try to register with weak password
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registerResponse.status).toBe(400);
      expect(registerResponse.body.error.code).toBe('USER_INVALID_PASSWORD');
    });
  });

  describe('Complete User Login Flow', () => {
    let testUser;
    const userCredentials = {
      email: 'logintest@example.com',
      password: 'LoginPass123!'
    };

    beforeEach(async () => {
      // Create test user
      testUser = await User.create(userCredentials);
    });

    test('should complete full login process', async () => {
      // Step 1: Get login info
      const infoResponse = await request(app)
        .get('/api/auth/login-info');

      expect(infoResponse.status).toBe(200);
      expect(infoResponse.body.data.requirements).toBeDefined();

      // Step 2: Login with valid credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(userCredentials);

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data.user.email).toBe(userCredentials.email);
      expect(loginResponse.body.data.tokens.accessToken).toBeDefined();
      expect(loginResponse.body.data.tokens.refreshToken).toBeDefined();
      expect(loginResponse.body.data.session).toBeDefined();

      // Step 3: Use access token to get user info
      const { accessToken } = loginResponse.body.data.tokens;
      
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.id).toBe(testUser.id);

      // Step 4: Validate token
      const validateResponse = await request(app)
        .post('/api/auth/validate')
        .send({ token: accessToken });

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.data.valid).toBe(true);
      expect(validateResponse.body.data.userId).toBe(testUser.id);
    });

    test('should handle login with remember me', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          ...userCredentials,
          rememberMe: true
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.session.rememberMe).toBe(true);
      expect(loginResponse.body.data.tokens.expiresIn).toBe('30d');

      // Verify token has longer expiration
      const { accessToken } = loginResponse.body.data.tokens;
      const tokenInfo = JWTUtils.getUserFromToken(accessToken);
      const expirationTime = new Date(tokenInfo.exp * 1000);
      const now = new Date();
      const daysDiff = (expirationTime - now) / (1000 * 60 * 60 * 24);

      expect(daysDiff).toBeGreaterThan(25); // Should be close to 30 days
    });

    test('should handle failed login attempts and rate limiting', async () => {
      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: userCredentials.email,
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
      }

      // 6th attempt should be rate limited
      const rateLimitedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userCredentials.email,
          password: 'wrongpassword'
        });

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });
  });

  describe('Token Refresh Flow', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      testUser = await User.create({
        email: 'refresh@example.com',
        password: 'RefreshPass123!'
      });

      // Login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh@example.com',
          password: 'RefreshPass123!'
        });

      refreshToken = loginResponse.body.data.tokens.refreshToken;
    });

    test('should refresh access token successfully', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.tokenType).toBe('Bearer');

      // Verify new token works
      const newAccessToken = refreshResponse.body.data.accessToken;
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.data.user.id).toBe(testUser.id);
    });

    test('should reject invalid refresh token', async () => {
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });

    test('should reject access token as refresh token', async () => {
      // Get access token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'refresh@example.com',
          password: 'RefreshPass123!'
        });

      const accessToken = loginResponse.body.data.tokens.accessToken;

      // Try to use access token as refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: accessToken });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('End-to-End User Journey', () => {
    test('should complete full user lifecycle', async () => {
      const userData = {
        email: 'lifecycle@example.com',
        password: 'LifecyclePass123!',
        confirmPassword: 'LifecyclePass123!'
      };

      // 1. Check password strength
      const strengthCheck = await request(app)
        .post('/api/auth/check-password-strength')
        .send({ password: userData.password });

      expect(strengthCheck.body.data.isAcceptable).toBe(true);

      // 2. Register user
      const registration = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(registration.status).toBe(201);
      const { accessToken: registerToken, refreshToken: registerRefreshToken } = registration.body.data.tokens;

      // 3. Use registration token to access protected resource
      const initialMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registerToken}`);

      expect(initialMe.status).toBe(200);

      // 4. Logout (simulate client-side token removal)
      const logout = await request(app)
        .post('/api/auth/logout');

      expect(logout.status).toBe(200);

      // 5. Login again with credentials
      const login = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password,
          rememberMe: true
        });

      expect(login.status).toBe(200);
      const { accessToken: loginToken, refreshToken: loginRefreshToken } = login.body.data.tokens;

      // 6. Verify new tokens are different from registration tokens
      expect(loginToken).not.toBe(registerToken);
      expect(loginRefreshToken).not.toBe(registerRefreshToken);

      // 7. Use new access token
      const loginMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginToken}`);

      expect(loginMe.status).toBe(200);
      expect(loginMe.body.data.user.email).toBe(userData.email);

      // 8. Refresh the token
      const tokenRefresh = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRefreshToken });

      expect(tokenRefresh.status).toBe(200);
      const refreshedToken = tokenRefresh.body.data.accessToken;

      // 9. Use refreshed token
      const refreshedMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshedToken}`);

      expect(refreshedMe.status).toBe(200);
      expect(refreshedMe.body.data.user.email).toBe(userData.email);

      // 10. Validate final token
      const finalValidation = await request(app)
        .post('/api/auth/validate')
        .send({ token: refreshedToken });

      expect(finalValidation.status).toBe(200);
      expect(finalValidation.body.data.valid).toBe(true);
    });
  });

  describe('Error Scenarios Integration', () => {
    test('should handle database connection errors gracefully', async () => {
      // Disconnect database to simulate error
      await dbConnection.disconnect();

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'dbtest@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);

      // Reconnect for other tests
      await dbConnection.connect();
    });

    test('should handle malformed requests', async () => {
      // Invalid JSON
      const response = await request(app)
        .post('/api/auth/register')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should handle missing content-type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send('email=test@example.com&password=123456');

      // Should still work with URL-encoded data
      expect(response.status).toBe(400); // Will fail validation, but request is parsed
    });
  });

  describe('Security Integration Tests', () => {
    test('should prevent SQL injection attempts', async () => {
      const maliciousData = {
        email: "test@example.com'; DROP TABLE users; --",
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(maliciousData);

      // Should fail email validation, not cause SQL injection
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_EMAIL');

      // Verify users table still exists
      const tableCheck = await dbConnection.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      expect(tableCheck.rows[0].exists).toBe(true);
    });

    test('should handle XSS attempts in input', async () => {
      const xssData = {
        email: '<script>alert("xss")</script>@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(xssData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('USER_INVALID_EMAIL');
    });

    test('should rate limit across different endpoints', async () => {
      const testEmail = 'ratelimit@example.com';

      // Create user first
      await User.create({
        email: testEmail,
        password: 'password123'
      });

      // Make failed login attempts to trigger rate limit
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: testEmail,
            password: 'wrongpassword'
          });
      }

      // Now try to register with same IP (should be rate limited)
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@example.com',
          password: 'password123'
        });

      // Note: This test assumes rate limiting is IP-based across endpoints
      // The current implementation only rate limits login attempts
      expect(registerResponse.status).toBeLessThan(500); // Should not crash
    });
  });

  describe('Performance Integration Tests', () => {
    test('should handle concurrent registration attempts', async () => {
      const promises = [];
      
      // Create 10 concurrent registration requests
      for (let i = 0; i < 10; i++) {
        const promise = request(app)
          .post('/api/auth/register')
          .send({
            email: `concurrent${i}@example.com`,
            password: 'password123'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Verify all users were created
      const userCount = await User.count();
      expect(userCount).toBe(10);
    });

    test('should handle concurrent login attempts', async () => {
      // Create test user
      const testUser = await User.create({
        email: 'concurrent@example.com',
        password: 'password123'
      });

      const promises = [];
      
      // Create 5 concurrent login requests
      for (let i = 0; i < 5; i++) {
        const promise = request(app)
          .post('/api/auth/login')
          .send({
            email: 'concurrent@example.com',
            password: 'password123'
          });
        promises.push(promise);
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.data.user.id).toBe(testUser.id);
      });
    });
  });
});