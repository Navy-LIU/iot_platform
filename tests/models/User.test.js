const { User } = require('../../models');
const dbConnection = require('../../db/connection');

describe('User Model', () => {
  beforeAll(async () => {
    // Connect to test database
    await dbConnection.connect();
    
    // Run migrations to ensure tables exist
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
    // Clean up users table before each test
    await dbConnection.query('DELETE FROM users');
  });

  afterAll(async () => {
    // Clean up and disconnect
    await dbConnection.query('DELETE FROM users');
    await dbConnection.disconnect();
  });

  describe('User Creation', () => {
    test('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const user = await User.create(userData);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
      expect(user.passwordHash).toBeUndefined(); // Should not be exposed
    });

    test('should throw error when email is missing', async () => {
      const userData = {
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow('Email and password are required');
    });

    test('should throw error when password is missing', async () => {
      const userData = {
        email: 'test@example.com'
      };

      await expect(User.create(userData)).rejects.toThrow('Email and password are required');
    });

    test('should throw error when email format is invalid', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(User.create(userData)).rejects.toThrow('Invalid email format');
    });

    test('should throw error when password is too short', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123'
      };

      await expect(User.create(userData)).rejects.toThrow('Password must be at least 6 characters long');
    });

    test('should throw error when user with email already exists', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Create first user
      await User.create(userData);

      // Try to create second user with same email
      await expect(User.create(userData)).rejects.toThrow('User with this email already exists');
    });
  });

  describe('Password Operations', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    test('should hash password correctly', async () => {
      const password = 'testpassword';
      const hashedPassword = await User.hashPassword(password);

      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 chars
    });

    test('should verify correct password', async () => {
      const foundUser = await User.findByEmail('test@example.com');
      const isValid = await foundUser.verifyPassword('password123');

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const foundUser = await User.findByEmail('test@example.com');
      const isValid = await foundUser.verifyPassword('wrongpassword');

      expect(isValid).toBe(false);
    });

    test('should update password successfully', async () => {
      const foundUser = await User.findByEmail('test@example.com');
      const newPassword = 'newpassword123';

      await foundUser.updatePassword(newPassword);

      // Verify old password no longer works
      const oldPasswordValid = await foundUser.verifyPassword('password123');
      expect(oldPasswordValid).toBe(false);

      // Verify new password works
      const newPasswordValid = await foundUser.verifyPassword(newPassword);
      expect(newPasswordValid).toBe(true);
    });

    test('should throw error when updating to invalid password', async () => {
      const foundUser = await User.findByEmail('test@example.com');

      await expect(foundUser.updatePassword('123')).rejects.toThrow('Password must be at least 6 characters long');
    });
  });

  describe('User Queries', () => {
    let testUsers;

    beforeEach(async () => {
      testUsers = [
        await User.create({ email: 'user1@example.com', password: 'password123' }),
        await User.create({ email: 'user2@example.com', password: 'password123' }),
        await User.create({ email: 'user3@example.com', password: 'password123' })
      ];
    });

    test('should find user by ID', async () => {
      const user = await User.findById(testUsers[0].id);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(testUsers[0].id);
      expect(user.email).toBe(testUsers[0].email);
    });

    test('should return null for non-existent ID', async () => {
      const user = await User.findById(99999);

      expect(user).toBeNull();
    });

    test('should find user by email', async () => {
      const user = await User.findByEmail('user1@example.com');

      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('user1@example.com');
    });

    test('should return null for non-existent email', async () => {
      const user = await User.findByEmail('nonexistent@example.com');

      expect(user).toBeNull();
    });

    test('should find all users', async () => {
      const users = await User.findAll();

      expect(users).toHaveLength(3);
      expect(users[0]).toBeInstanceOf(User);
    });

    test('should respect limit and offset in findAll', async () => {
      const users = await User.findAll(2, 1);

      expect(users).toHaveLength(2);
    });

    test('should count users correctly', async () => {
      const count = await User.count();

      expect(count).toBe(3);
    });
  });

  describe('User Updates', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    test('should update user email', async () => {
      const newEmail = 'newemail@example.com';
      await user.update({ email: newEmail });

      expect(user.email).toBe(newEmail);

      // Verify in database
      const foundUser = await User.findById(user.id);
      expect(foundUser.email).toBe(newEmail);
    });

    test('should throw error when updating to invalid email', async () => {
      await expect(user.update({ email: 'invalid-email' })).rejects.toThrow('Invalid email format');
    });

    test('should throw error when no valid fields to update', async () => {
      await expect(user.update({})).rejects.toThrow('No valid fields to update');
    });
  });

  describe('User Deletion', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    test('should delete user successfully', async () => {
      const result = await user.delete();

      expect(result).toBe(true);

      // Verify user is deleted
      const foundUser = await User.findById(user.id);
      expect(foundUser).toBeNull();
    });

    test('should throw error when deleting user without ID', async () => {
      const userWithoutId = new User({ email: 'test@example.com' });

      await expect(userWithoutId.delete()).rejects.toThrow('Cannot delete user without ID');
    });
  });

  describe('Validation Methods', () => {
    test('should validate email format correctly', () => {
      expect(User.isValidEmail('test@example.com')).toBe(true);
      expect(User.isValidEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(User.isValidEmail('invalid-email')).toBe(false);
      expect(User.isValidEmail('test@')).toBe(false);
      expect(User.isValidEmail('@example.com')).toBe(false);
      expect(User.isValidEmail('')).toBe(false);
    });

    test('should validate password correctly', () => {
      expect(User.isValidPassword('password123')).toBe(true);
      expect(User.isValidPassword('123456')).toBe(true);
      expect(User.isValidPassword('12345')).toBe(false);
      expect(User.isValidPassword('')).toBe(false);
      expect(User.isValidPassword(null)).toBe(false);
    });
  });

  describe('JSON Serialization', () => {
    let user;

    beforeEach(async () => {
      user = await User.create({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    test('should serialize to JSON without password hash', () => {
      const json = user.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('email');
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('updatedAt');
      expect(json).not.toHaveProperty('passwordHash');
      expect(json).not.toHaveProperty('password_hash');
    });

    test('should serialize to public JSON with limited fields', () => {
      const json = user.toPublicJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('email');
      expect(json).toHaveProperty('createdAt');
      expect(json).not.toHaveProperty('updatedAt');
      expect(json).not.toHaveProperty('passwordHash');
    });
  });
});