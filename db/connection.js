const { Pool } = require('pg');
const config = require('../config');

class DatabaseConnection {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      // Create connection pool
      this.pool = new Pool({
        connectionString: config.database.url,
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
        connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      console.log('✅ Database connected successfully');
      
      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('❌ Unexpected error on idle client', err);
        this.isConnected = false;
      });

      return this.pool;
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('🔌 Database disconnected');
    }
  }

  async healthCheck() {
    try {
      if (!this.pool) {
        return {
          status: 'disconnected',
          message: 'Database pool not initialized'
        };
      }

      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();

      return {
        status: 'healthy',
        message: 'Database connection is healthy',
        data: {
          currentTime: result.rows[0].current_time,
          version: result.rows[0].version,
          totalConnections: this.pool.totalCount,
          idleConnections: this.pool.idleCount,
          waitingConnections: this.pool.waitingCount
        }
      };
    } catch (error) {
      console.error('❌ Database health check failed:', error.message);
      this.isConnected = false;
      
      return {
        status: 'unhealthy',
        message: 'Database health check failed',
        error: error.message
      };
    }
  }

  async query(text, params) {
    try {
      if (!this.pool) {
        throw new Error('Database not connected');
      }

      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (config.nodeEnv === 'development') {
        console.log('🔍 Executed query', { text, duration, rows: result.rowCount });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Query execution failed:', error.message);
      throw error;
    }
  }

  async getClient() {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return await this.pool.connect();
  }

  getPool() {
    return this.pool;
  }

  isHealthy() {
    return this.isConnected && this.pool && !this.pool.ended;
  }
}

// Create singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;