const request = require('supertest');
const { app } = require('../app');
const dbConnection = require('../db/connection');

describe('Express App', () => {
  beforeAll(async () => {
    // Connect to test database
    await dbConnection.connect();
  });

  afterAll(async () => {
    // Disconnect from database
    await dbConnection.disconnect();
  });

  describe('Basic Routes', () => {
    test('GET / should return API information', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Zeabur Server Demo API');
      expect(response.body.version).toBeDefined();
      expect(response.body.environment).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.health).toBe('/health');
      expect(response.body.endpoints.api).toBeDefined();
    });

    test('GET /health should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.environment).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.database).toBeDefined();
      expect(response.body.database.status).toBe('healthy');
    });

    test('GET /api/status should return API status', async () => {
      const response = await request(app).get('/api/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.api).toBeDefined();
      expect(response.body.services.api.status).toBe('healthy');
      expect(response.body.services.api.uptime).toBeDefined();
      expect(response.body.services.api.memory).toBeDefined();
      expect(response.body.services.database).toBeDefined();
    });

    test('GET /nonexistent should return 404', async () => {
      const response = await request(app).get('/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toContain('Route GET /nonexistent not found');
    });
  });

  describe('Middleware', () => {
    test('should handle CORS headers', async () => {
      const response = await request(app)
        .get('/')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });

    test('should handle JSON requests', async () => {
      const response = await request(app)
        .post('/nonexistent')
        .send({ test: 'data' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404); // Route doesn't exist, but JSON was parsed
    });

    test('should include security headers', async () => {
      const response = await request(app).get('/');

      // Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    test('should handle large JSON payloads within limit', async () => {
      const largeData = {
        data: 'x'.repeat(1000) // 1KB of data
      };

      const response = await request(app)
        .post('/nonexistent')
        .send(largeData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(404); // Route doesn't exist, but payload was accepted
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/nonexistent')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle unsupported methods', async () => {
      const response = await request(app).patch('/');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Route PATCH / not found');
    });
  });

  describe('Database Health', () => {
    test('should return unhealthy status when database is down', async () => {
      // Disconnect database to simulate failure
      await dbConnection.disconnect();

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.database.status).toBe('disconnected');

      // Reconnect for other tests
      await dbConnection.connect();
    });

    test('should return degraded status for API status when database is down', async () => {
      // Disconnect database to simulate failure
      await dbConnection.disconnect();

      const response = await request(app).get('/api/status');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('degraded');

      // Reconnect for other tests
      await dbConnection.connect();
    });
  });

  describe('Content Types', () => {
    test('should return JSON content type for API responses', async () => {
      const response = await request(app).get('/');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });

    test('should handle URL encoded data', async () => {
      const response = await request(app)
        .post('/nonexistent')
        .send('name=test&value=123')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect(response.status).toBe(404); // Route doesn't exist, but data was parsed
    });
  });

  describe('Request Logging', () => {
    test('should not crash on requests in test environment', async () => {
      // This test ensures logging middleware doesn't break in test env
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
    });
  });

  describe('API Information', () => {
    test('should provide correct API endpoint information', async () => {
      const response = await request(app).get('/');

      expect(response.body.endpoints.api.auth).toBe('/api/auth');
      expect(response.body.endpoints.api.user).toBe('/api/user');
      expect(response.body.endpoints.api.status).toBe('/api/status');
    });

    test('should include version information', async () => {
      const response = await request(app).get('/');

      expect(response.body.version).toBeDefined();
      expect(typeof response.body.version).toBe('string');
    });

    test('should include environment information', async () => {
      const response = await request(app).get('/');

      expect(response.body.environment).toBeDefined();
      expect(['development', 'test', 'production']).toContain(response.body.environment);
    });
  });
});