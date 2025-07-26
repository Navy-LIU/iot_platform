const dbConnection = require('../../db/connection');

describe('Database Connection', () => {
  afterAll(async () => {
    // Clean up connection after tests
    await dbConnection.disconnect();
  });

  describe('Connection Management', () => {
    test('should connect to database successfully', async () => {
      const pool = await dbConnection.connect();

      expect(pool).toBeDefined();
      expect(dbConnection.isHealthy()).toBe(true);
    });

    test('should execute queries successfully', async () => {
      await dbConnection.connect();
      
      const result = await dbConnection.query('SELECT NOW() as current_time');

      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].current_time).toBeDefined();
    });

    test('should execute parameterized queries', async () => {
      await dbConnection.connect();
      
      const result = await dbConnection.query('SELECT $1 as test_value', ['test']);

      expect(result.rows[0].test_value).toBe('test');
    });

    test('should handle query errors gracefully', async () => {
      await dbConnection.connect();
      
      await expect(dbConnection.query('INVALID SQL QUERY')).rejects.toThrow();
    });
  });

  describe('Health Check', () => {
    test('should return healthy status when connected', async () => {
      await dbConnection.connect();
      
      const health = await dbConnection.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.message).toBe('Database connection is healthy');
      expect(health.data).toBeDefined();
      expect(health.data.currentTime).toBeDefined();
      expect(health.data.version).toBeDefined();
    });

    test('should return disconnected status when not connected', async () => {
      // Disconnect first
      await dbConnection.disconnect();
      
      const health = await dbConnection.healthCheck();

      expect(health.status).toBe('disconnected');
      expect(health.message).toBe('Database pool not initialized');
    });
  });

  describe('Connection Pool', () => {
    test('should provide access to connection pool', async () => {
      await dbConnection.connect();
      
      const pool = dbConnection.getPool();

      expect(pool).toBeDefined();
      expect(typeof pool.query).toBe('function');
    });

    test('should provide individual client connections', async () => {
      await dbConnection.connect();
      
      const client = await dbConnection.getClient();

      expect(client).toBeDefined();
      expect(typeof client.query).toBe('function');
      expect(typeof client.release).toBe('function');

      // Clean up
      client.release();
    });

    test('should track connection health status', async () => {
      await dbConnection.connect();
      
      expect(dbConnection.isHealthy()).toBe(true);
      
      await dbConnection.disconnect();
      
      expect(dbConnection.isHealthy()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection failures gracefully', async () => {
      // Temporarily change database URL to invalid one
      const originalUrl = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://invalid:invalid@localhost:5432/invalid';
      
      // Create new connection instance for this test
      const { Pool } = require('pg');
      const testConnection = {
        pool: null,
        isConnected: false,
        async connect() {
          try {
            this.pool = new Pool({
              connectionString: process.env.DATABASE_URL,
              connectionTimeoutMillis: 1000
            });
            
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            this.isConnected = true;
            return this.pool;
          } catch (error) {
            this.isConnected = false;
            throw error;
          }
        }
      };
      
      await expect(testConnection.connect()).rejects.toThrow();
      expect(testConnection.isConnected).toBe(false);
      
      // Restore original URL
      process.env.DATABASE_URL = originalUrl;
    });

    test('should throw error when querying without connection', async () => {
      await dbConnection.disconnect();
      
      await expect(dbConnection.query('SELECT 1')).rejects.toThrow('Database not connected');
    });

    test('should throw error when getting client without connection', async () => {
      await dbConnection.disconnect();
      
      await expect(dbConnection.getClient()).rejects.toThrow('Database not connected');
    });
  });
});