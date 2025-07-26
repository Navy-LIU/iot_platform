const dbConnection = require('../../db/connection');
const { User } = require('../../models');

class TestUtils {
  static async setupTestDatabase() {
    await dbConnection.connect();
    
    // Ensure test tables exist
    await dbConnection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index if not exists
    await dbConnection.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `);

    // Create update trigger function if not exists
    await dbConnection.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    // Create trigger if not exists
    await dbConnection.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
          BEFORE UPDATE ON users
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  static async cleanupTestDatabase() {
    // Clean up all test data
    await dbConnection.query('DELETE FROM users');
  }

  static async createTestUser(overrides = {}) {
    const defaultData = {
      email: 'test@example.com',
      password: 'password123'
    };

    const userData = { ...defaultData, ...overrides };
    return await User.create(userData);
  }

  static async createMultipleTestUsers(count = 3) {
    const users = [];
    
    for (let i = 1; i <= count; i++) {
      const user = await this.createTestUser({
        email: `user${i}@example.com`,
        password: 'password123'
      });
      users.push(user);
    }
    
    return users;
  }

  static generateRandomEmail() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `test_${timestamp}_${random}@example.com`;
  }

  static generateRandomPassword(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return password;
  }

  static async waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static expectValidUser(user) {
    expect(user).toBeInstanceOf(User);
    expect(user.id).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.createdAt).toBeDefined();
    expect(user.updatedAt).toBeDefined();
    expect(User.isValidEmail(user.email)).toBe(true);
  }

  static expectValidUserArray(users) {
    expect(Array.isArray(users)).toBe(true);
    users.forEach(user => {
      this.expectValidUser(user);
    });
  }

  static async expectUserNotInDatabase(email) {
    const user = await User.findByEmail(email);
    expect(user).toBeNull();
  }

  static async expectUserInDatabase(email) {
    const user = await User.findByEmail(email);
    expect(user).not.toBeNull();
    this.expectValidUser(user);
    return user;
  }
}

module.exports = TestUtils;