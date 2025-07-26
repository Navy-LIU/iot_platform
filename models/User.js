const bcrypt = require('bcrypt');
const dbConnection = require('../db/connection');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Static methods for database operations
  static async create(userData) {
    const { email, password } = userData;
    
    // Validate input
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (!User.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!User.isValidPassword(password)) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await User.hashPassword(password);

    // Insert user into database
    const query = `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at, updated_at
    `;
    
    const result = await dbConnection.query(query, [email, passwordHash]);
    const userRow = result.rows[0];

    return new User({
      id: userRow.id,
      email: userRow.email,
      created_at: userRow.created_at,
      updated_at: userRow.updated_at
    });
  }

  static async findById(id) {
    if (!id) {
      return null;
    }

    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await dbConnection.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  static async findByEmail(email) {
    if (!email) {
      return null;
    }

    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await dbConnection.query(query, [email.toLowerCase()]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  static async findAll(limit = 100, offset = 0) {
    const query = `
      SELECT id, email, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const result = await dbConnection.query(query, [limit, offset]);
    
    return result.rows.map(row => new User(row));
  }

  static async count() {
    const query = 'SELECT COUNT(*) as count FROM users';
    const result = await dbConnection.query(query);
    
    return parseInt(result.rows[0].count);
  }

  // Instance methods
  async update(updateData) {
    const allowedFields = ['email'];
    const updates = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'email' && !User.isValidEmail(updateData[field])) {
          throw new Error('Invalid email format');
        }
        
        updates.push(`${field} = $${paramCount}`);
        values.push(updateData[field]);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(this.id);
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING id, email, created_at, updated_at
    `;

    const result = await dbConnection.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const updatedUser = result.rows[0];
    this.email = updatedUser.email;
    this.updatedAt = updatedUser.updated_at;

    return this;
  }

  async delete() {
    if (!this.id) {
      throw new Error('Cannot delete user without ID');
    }

    const query = 'DELETE FROM users WHERE id = $1';
    const result = await dbConnection.query(query, [this.id]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }

    return true;
  }

  async verifyPassword(password) {
    if (!password || !this.passwordHash) {
      return false;
    }

    return await bcrypt.compare(password, this.passwordHash);
  }

  async updatePassword(newPassword) {
    if (!User.isValidPassword(newPassword)) {
      throw new Error('Password must be at least 6 characters long');
    }

    const passwordHash = await User.hashPassword(newPassword);
    
    const query = `
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING updated_at
    `;

    const result = await dbConnection.query(query, [passwordHash, this.id]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    this.passwordHash = passwordHash;
    this.updatedAt = result.rows[0].updated_at;

    return this;
  }

  // Static utility methods
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPassword(password) {
    return password && password.length >= 6;
  }

  // Instance methods for JSON serialization
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toPublicJSON() {
    return {
      id: this.id,
      email: this.email,
      createdAt: this.createdAt
    };
  }
}

module.exports = User;