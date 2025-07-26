const dbConnection = require('../db/connection');

class BaseModel {
  constructor(data = {}) {
    this.id = data.id;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Common database operations that can be inherited
  static async executeQuery(query, params = []) {
    try {
      return await dbConnection.query(query, params);
    } catch (error) {
      console.error('Database query error:', error.message);
      throw error;
    }
  }

  static async transaction(callback) {
    const client = await dbConnection.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Utility methods for common validations
  static validateRequired(fields, data) {
    const missing = [];
    
    for (const field of fields) {
      if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  static sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }
    return str.trim();
  }

  static formatTimestamp(timestamp) {
    if (!timestamp) return null;
    return new Date(timestamp).toISOString();
  }

  // Common JSON serialization
  toJSON() {
    const obj = {};
    
    for (const key in this) {
      if (this.hasOwnProperty(key) && !key.startsWith('_')) {
        obj[key] = this[key];
      }
    }
    
    return obj;
  }
}

module.exports = BaseModel;