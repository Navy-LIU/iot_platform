const request = require('supertest');
const { app } = require('../../app');
const { User } = require('../../models');
const dbConnection = require('../../db/connection');

describe('Full Application Integration Tests', () => {
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

  describe('Application Startup and Basic Endpoints', () => {
    test('should start application successfully', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Zeabur Server Demo API');
      expect(response.body.endpoints).toBeDefined();
    });

    test('should have all required API endpoints', async () => {
      const response = await request(app).get('/');

      expect(response.body.endpoints.api.auth).toBe('/api/auth');
      expect(response.body.endpoints.api.user).toBe('/api/user');
      expect(response.body.endpoints.api.status).toBe('/api/status');
    });

    test('should have working health check', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.database).toBeDefined();
    });

    test('should have working system status', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('operational');
    });
  });

  describe('Complete User Journey', () => {
    test('should complete full user lifecycle with all API endpoints', async () => {
      // 1. Check system info
      const infoResponse = await request(app).get('/api/system/info');
      expect(infoResponse.status).toBe(200);
      expect(infoResponse.body.data.endpoints.authentication).toBeDefined();

      // 2. Check password strength
      const passwordCheck = await request(app)
        .post('/api/auth/check-password-strength')
        .send({ password: 'StrongPassword123!' });
      
      expect(passwordCheck.status).toBe(200);
      expect(passwordCheck.body.data.isAcceptable).toBe(true);

      // 3. Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'fulltest@example.com',
          password: 'StrongPassword123!',
          confirmPassword: 'StrongPassword123!'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.data.tokens.accessToken).toBeDefined();
      
      const { accessToken, refreshToken } = registerResponse.body.data.tokens;

      // 4. Get user profile
      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe('fulltest@example.com');

      // 5. Get user stats
      const statsResponse = await request(app)
        .get('/api/user/stats')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.data.account).toBeDefined();
      expect(statsResponse.body.data.session).toBeDefined();

      // 6. Update profile
      const updateResponse = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'updated@example.com' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.user.email).toBe('updated@example.com');

      // 7. Change password
      const passwordChangeResponse = await request(app)
        .post('/api/user/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'StrongPassword123!',
          newPassword: 'NewStrongPassword123!',
          confirmNewPassword: 'NewStrongPassword123!'
        });

      expect(passwordChangeResponse.status).toBe(200);

      // 8. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout');

      expect(logoutResponse.status).toBe(200);

      // 9. Login with new credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'updated@example.com',
          password: 'NewStrongPassword123!',
          rememberMe: true
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.session.rememberMe).toBe(true);

      const newAccessToken = loginResponse.body.data.tokens.accessToken;

      // 10. Validate new token
      const validateResponse = await request(app)
        .post('/api/auth/validate')
        .send({ token: newAccessToken });

      expect(validateResponse.status).toBe(200);
      expect(validateResponse.body.data.valid).toBe(true);

      // 11. Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.data.accessToken).toBeDefined();

      // 12. Get system metrics (authenticated endpoint)
      const metricsResponse = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.data.application.totalUsers).toBe(1);

      // 13. Test system ping
      const pingResponse = await request(app).get('/api/system/ping');
      expect(pingResponse.status).toBe(200);
      expect(pingResponse.body.message).toBe('pong');

      // 14. Get detailed health check
      const healthResponse = await request(app).get('/api/system/health');
      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.services.database.status).toBe('healthy');
    });
  });

  describe('Database Integration', () => {
    test('should handle database operations correctly', async () => {
      // Create multiple users
      const users = [
        { email: 'user1@example.com', password: 'password123' },
        { email: 'user2@example.com', password: 'password123' },
        { email: 'user3@example.com', password: 'password123' }
      ];

      const tokens = [];

      // Register all users
      for (const userData of users) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);

        expect(response.status).toBe(201);
        tokens.push(response.body.data.tokens.accessToken);
      }

      // Verify user count in system metrics
      const metricsResponse = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${tokens[0]}`);

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.body.data.application.totalUsers).toBe(3);

      // Test user lookup
      const user1 = await User.findByEmail('user1@example.com');
      const userResponse = await request(app)
        .get(`/api/user/${user1.id}`)
        .set('Authorization', `Bearer ${tokens[1]}`);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.data.user.email).toBe('user1@example.com');
    });

    test('should handle database connection issues gracefully', async () => {
      // Disconnect database
      await dbConnection.disconnect();

      // Test health check
      const healthResponse = await request(app).get('/health');
      expect(healthResponse.status).toBe(503);
      expect(healthResponse.body.status).toBe('unhealthy');

      // Test system status
      const statusResponse = await request(app).get('/api/status');
      expect(statusResponse.status).toBe(503);
      expect(statusResponse.body.success).toBe(false);

      // Reconnect for other tests
      await dbConnection.connect();
    });
  });

  describe('Security Integration', () => {
    test('should enforce authentication across protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'get', path: '/api/user/profile' },
        { method: 'put', path: '/api/user/profile' },
        { method: 'delete', path: '/api/user/profile' },
        { method: 'post', path: '/api/user/change-password' },
        { method: 'get', path: '/api/user/stats' },
        { method: 'get', path: '/api/system/metrics' }
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await request(app)[endpoint.method](endpoint.path);
        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
      }
    });

    test('should handle rate limiting correctly', async () => {
      // Create a user first
      await User.create({
        email: 'ratetest@example.com',
        password: 'password123'
      });

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'ratetest@example.com',
            password: 'wrongpassword'
          });

        expect(response.status).toBe(401);
      }

      // 6th attempt should be rate limited
      const rateLimitedResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ratetest@example.com',
          password: 'wrongpassword'
        });

      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle various error scenarios consistently', async () => {
      // Test 404 for non-existent routes
      const notFoundResponse = await request(app).get('/api/nonexistent');
      expect(notFoundResponse.status).toBe(404);
      expect(notFoundResponse.body.error.code).toBe('NOT_FOUND');

      // Test malformed JSON
      const malformedResponse = await request(app)
        .post('/api/auth/register')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect(malformedResponse.status).toBe(400);
      expect(malformedResponse.body.success).toBe(false);

      // Test validation errors
      const validationResponse = await request(app)
        .post('/api/auth/register')
        .send({ email: 'invalid-email' });

      expect(validationResponse.status).toBe(400);
      expect(validationResponse.body.error.code).toBe('USER_INVALID_EMAIL');
    });
  });

  describe('Performance and Load', () => {
    test('should handle concurrent requests', async () => {
      const promises = [];

      // Create 10 concurrent ping requests
      for (let i = 0; i < 10; i++) {
        promises.push(request(app).get('/api/system/ping'));
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe('pong');
      });
    });

    test('should respond to health checks quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app).get('/health');
      
      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });
  });

  describe('API Documentation and Info', () => {
    test('should provide comprehensive API information', async () => {
      const response = await request(app).get('/api/system/info');

      expect(response.status).toBe(200);
      expect(response.body.data.endpoints.authentication).toBeDefined();
      expect(response.body.data.endpoints.user).toBeDefined();
      expect(response.body.data.endpoints.system).toBeDefined();
      expect(response.body.data.features).toContain('JWT-based authentication');
      expect(response.body.data.security).toBeDefined();
    });

    test('should have consistent response format across all endpoints', async () => {
      // Test successful responses
      const successEndpoints = [
        '/api/system/info',
        '/api/system/ping',
        '/api/auth/login-info'
      ];

      for (const endpoint of successEndpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBeDefined();
      }
    });
  });
});