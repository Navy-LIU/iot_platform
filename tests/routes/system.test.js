const request = require('supertest');
const express = require('express');
const systemRoutes = require('../../routes/system');
const { User } = require('../../models');
const { JWTUtils } = require('../../utils');
const { errorHandler } = require('../../middleware');
const dbConnection = require('../../db/connection');

describe('System Routes', () => {
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
    
    // Create test user for authenticated endpoints
    testUser = await User.create({
      email: 'testuser@example.com',
      password: 'password123'
    });

    // Generate access token
    accessToken = JWTUtils.generateAuthToken(testUser);
    
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/system', systemRoutes);
    app.use(errorHandler);
  });

  afterAll(async () => {
    await dbConnection.query('DELETE FROM users');
    await dbConnection.disconnect();
  });

  describe('GET /api/system/health', () => {
    test('should return detailed health status', async () => {
      const response = await request(app)
        .get('/api/system/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.responseTime).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.environment).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.database).toBeDefined();
      expect(response.body.services.api).toBeDefined();
      expect(response.body.system).toBeDefined();
      expect(response.body.system.memory).toBeDefined();
      expect(response.body.system.cpu).toBeDefined();
    });

    test('should return unhealthy status when database is down', async () => {
      // Disconnect database to simulate failure
      await dbConnection.disconnect();

      const response = await request(app)
        .get('/api/system/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');

      // Reconnect for other tests
      await dbConnection.connect();
    });

    test('should include system information', async () => {
      const response = await request(app)
        .get('/api/system/health');

      expect(response.body.system.platform).toBeDefined();
      expect(response.body.system.arch).toBeDefined();
      expect(response.body.system.nodeVersion).toBeDefined();
      expect(response.body.system.uptime).toBeDefined();
      expect(response.body.system.memory.total).toBeDefined();
      expect(response.body.system.cpu.count).toBeDefined();
    });
  });

  describe('GET /api/system/status', () => {
    test('should return system status', async () => {
      const response = await request(app)
        .get('/api/system/status');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('operational');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.version).toBeDefined();
      expect(response.body.environment).toBeDefined();
      expect(response.body.services).toBeDefined();
      expect(response.body.services.api).toBeDefined();
      expect(response.body.services.database).toBeDefined();
      expect(response.body.metrics).toBeDefined();
    });

    test('should include user count in metrics', async () => {
      const response = await request(app)
        .get('/api/system/status');

      expect(response.body.metrics.totalUsers).toBe(1); // One test user created
      expect(response.body.metrics.uptime).toBeDefined();
      expect(response.body.metrics.memoryUsage).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
      // Disconnect database
      await dbConnection.disconnect();

      const response = await request(app)
        .get('/api/system/status');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.status).toBe('degraded');

      // Reconnect for other tests
      await dbConnection.connect();
    });
  });

  describe('GET /api/system/info', () => {
    test('should return API information', async () => {
      const response = await request(app)
        .get('/api/system/info');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.api).toBeDefined();
      expect(response.body.data.api.name).toBe('Zeabur Server Demo');
      expect(response.body.data.api.version).toBeDefined();
      expect(response.body.data.api.description).toBeDefined();
      expect(response.body.data.endpoints).toBeDefined();
      expect(response.body.data.endpoints.authentication).toBeDefined();
      expect(response.body.data.endpoints.user).toBeDefined();
      expect(response.body.data.endpoints.system).toBeDefined();
      expect(response.body.data.features).toBeDefined();
      expect(response.body.data.security).toBeDefined();
    });

    test('should include all endpoint categories', async () => {
      const response = await request(app)
        .get('/api/system/info');

      const endpoints = response.body.data.endpoints;
      
      // Check authentication endpoints
      expect(endpoints.authentication.register).toBe('POST /api/auth/register');
      expect(endpoints.authentication.login).toBe('POST /api/auth/login');
      
      // Check user endpoints
      expect(endpoints.user.profile).toBe('GET /api/user/profile');
      expect(endpoints.user.updateProfile).toBe('PUT /api/user/profile');
      
      // Check system endpoints
      expect(endpoints.system.health).toBe('GET /api/system/health');
      expect(endpoints.system.status).toBe('GET /api/system/status');
    });

    test('should include feature list', async () => {
      const response = await request(app)
        .get('/api/system/info');

      const features = response.body.data.features;
      expect(features).toContain('JWT-based authentication');
      expect(features).toContain('User registration and login');
      expect(features).toContain('Database health monitoring');
    });
  });

  describe('GET /api/system/metrics', () => {
    test('should return detailed metrics for authenticated users', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
      expect(response.body.data.memory.process).toBeDefined();
      expect(response.body.data.memory.system).toBeDefined();
      expect(response.body.data.cpu).toBeDefined();
      expect(response.body.data.database).toBeDefined();
      expect(response.body.data.application).toBeDefined();
    });

    test('should include process memory metrics', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${accessToken}`);

      const processMemory = response.body.data.memory.process;
      expect(processMemory.rss).toBeDefined();
      expect(processMemory.heapTotal).toBeDefined();
      expect(processMemory.heapUsed).toBeDefined();
      expect(processMemory.heapUsagePercent).toBeDefined();
      expect(typeof processMemory.heapUsagePercent).toBe('number');
    });

    test('should include system memory metrics', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${accessToken}`);

      const systemMemory = response.body.data.memory.system;
      expect(systemMemory.total).toBeDefined();
      expect(systemMemory.free).toBeDefined();
      expect(systemMemory.used).toBeDefined();
      expect(systemMemory.usagePercent).toBeDefined();
      expect(typeof systemMemory.usagePercent).toBe('number');
    });

    test('should include database metrics', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${accessToken}`);

      const database = response.body.data.database;
      expect(database.status).toBeDefined();
      expect(database.connections).toBeDefined();
      expect(typeof database.connections).toBe('number');
    });

    test('should include application metrics', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${accessToken}`);

      const application = response.body.data.application;
      expect(application.totalUsers).toBe(1);
      expect(application.environment).toBeDefined();
      expect(application.nodeVersion).toBeDefined();
      expect(application.version).toBeDefined();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/system/metrics');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_MISSING');
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_TOKEN_INVALID');
    });
  });

  describe('GET /api/system/ping', () => {
    test('should return pong response', async () => {
      const response = await request(app)
        .get('/api/system/ping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('pong');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
      expect(response.body.version).toBeDefined();
    });

    test('should be accessible without authentication', async () => {
      const response = await request(app)
        .get('/api/system/ping');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should include basic system info', async () => {
      const response = await request(app)
        .get('/api/system/ping');

      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThan(0);
      expect(typeof response.body.version).toBe('string');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Error Handling', () => {
    test('should handle metrics collection errors', async () => {
      // Disconnect database to cause error
      await dbConnection.disconnect();

      const response = await request(app)
        .get('/api/system/metrics')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');

      // Reconnect for other tests
      await dbConnection.connect();
    });
  });

  describe('Response Times', () => {
    test('should respond to ping quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/system/ping');

      const responseTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });

    test('should include response time in health check', async () => {
      const response = await request(app)
        .get('/api/system/health');

      expect(response.body.responseTime).toBeDefined();
      expect(response.body.responseTime).toMatch(/^\d+ms$/);
    });
  });
});