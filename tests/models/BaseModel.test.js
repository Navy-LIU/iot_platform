const { BaseModel } = require('../../models');
const dbConnection = require('../../db/connection');

describe('BaseModel', () => {
  beforeAll(async () => {
    await dbConnection.connect();
  });

  afterAll(async () => {
    await dbConnection.disconnect();
  });

  describe('Query Execution', () => {
    test('should execute queries through BaseModel', async () => {
      const result = await BaseModel.executeQuery('SELECT NOW() as current_time');

      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].current_time).toBeDefined();
    });

    test('should execute parameterized queries', async () => {
      const result = await BaseModel.executeQuery('SELECT $1 as test_value', ['test']);

      expect(result.rows[0].test_value).toBe('test');
    });

    test('should handle query errors', async () => {
      await expect(BaseModel.executeQuery('INVALID SQL')).rejects.toThrow();
    });
  });

  describe('Transaction Support', () => {
    beforeEach(async () => {
      // Create a test table for transaction testing
      await BaseModel.executeQuery(`
        CREATE TABLE IF NOT EXISTS test_transactions (
          id SERIAL PRIMARY KEY,
          value VARCHAR(50)
        )
      `);
      
      // Clean up any existing data
      await BaseModel.executeQuery('DELETE FROM test_transactions');
    });

    afterEach(async () => {
      // Clean up test table
      await BaseModel.executeQuery('DROP TABLE IF EXISTS test_transactions');
    });

    test('should commit successful transactions', async () => {
      const result = await BaseModel.transaction(async (client) => {
        await client.query('INSERT INTO test_transactions (value) VALUES ($1)', ['test1']);
        await client.query('INSERT INTO test_transactions (value) VALUES ($1)', ['test2']);
        return 'success';
      });

      expect(result).toBe('success');

      // Verify data was committed
      const checkResult = await BaseModel.executeQuery('SELECT COUNT(*) as count FROM test_transactions');
      expect(parseInt(checkResult.rows[0].count)).toBe(2);
    });

    test('should rollback failed transactions', async () => {
      try {
        await BaseModel.transaction(async (client) => {
          await client.query('INSERT INTO test_transactions (value) VALUES ($1)', ['test1']);
          await client.query('INSERT INTO test_transactions (value) VALUES ($1)', ['test2']);
          
          // Force an error
          throw new Error('Transaction failed');
        });
      } catch (error) {
        expect(error.message).toBe('Transaction failed');
      }

      // Verify data was rolled back
      const checkResult = await BaseModel.executeQuery('SELECT COUNT(*) as count FROM test_transactions');
      expect(parseInt(checkResult.rows[0].count)).toBe(0);
    });

    test('should rollback on SQL errors', async () => {
      try {
        await BaseModel.transaction(async (client) => {
          await client.query('INSERT INTO test_transactions (value) VALUES ($1)', ['test1']);
          
          // Execute invalid SQL
          await client.query('INVALID SQL QUERY');
        });
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Verify data was rolled back
      const checkResult = await BaseModel.executeQuery('SELECT COUNT(*) as count FROM test_transactions');
      expect(parseInt(checkResult.rows[0].count)).toBe(0);
    });
  });

  describe('Validation Utilities', () => {
    test('should validate required fields', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        age: 25
      };

      // Should not throw for valid data
      expect(() => {
        BaseModel.validateRequired(['name', 'email'], data);
      }).not.toThrow();

      // Should throw for missing fields
      expect(() => {
        BaseModel.validateRequired(['name', 'email', 'phone'], data);
      }).toThrow('Missing required fields: phone');

      // Should throw for empty string fields
      const dataWithEmpty = { ...data, email: '' };
      expect(() => {
        BaseModel.validateRequired(['name', 'email'], dataWithEmpty);
      }).toThrow('Missing required fields: email');

      // Should throw for whitespace-only fields
      const dataWithWhitespace = { ...data, name: '   ' };
      expect(() => {
        BaseModel.validateRequired(['name', 'email'], dataWithWhitespace);
      }).toThrow('Missing required fields: name');
    });

    test('should sanitize strings', () => {
      expect(BaseModel.sanitizeString('  hello world  ')).toBe('hello world');
      expect(BaseModel.sanitizeString('test')).toBe('test');
      expect(BaseModel.sanitizeString('')).toBe('');
      expect(BaseModel.sanitizeString(123)).toBe(123);
      expect(BaseModel.sanitizeString(null)).toBe(null);
    });

    test('should format timestamps', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const formatted = BaseModel.formatTimestamp(date);
      
      expect(formatted).toBe('2023-01-01T12:00:00.000Z');
      expect(BaseModel.formatTimestamp(null)).toBe(null);
      expect(BaseModel.formatTimestamp(undefined)).toBe(null);
    });
  });

  describe('JSON Serialization', () => {
    test('should serialize object to JSON', () => {
      const model = new BaseModel({
        id: 1,
        created_at: new Date(),
        updated_at: new Date()
      });

      model.name = 'Test';
      model._private = 'should not appear';

      const json = model.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('updatedAt');
      expect(json).toHaveProperty('name');
      expect(json).not.toHaveProperty('_private');
    });

    test('should handle empty model', () => {
      const model = new BaseModel();
      const json = model.toJSON();

      expect(json).toEqual({
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined
      });
    });
  });

  describe('Constructor', () => {
    test('should initialize with data', () => {
      const data = {
        id: 1,
        created_at: new Date(),
        updated_at: new Date()
      };

      const model = new BaseModel(data);

      expect(model.id).toBe(data.id);
      expect(model.createdAt).toBe(data.created_at);
      expect(model.updatedAt).toBe(data.updated_at);
    });

    test('should initialize with empty data', () => {
      const model = new BaseModel();

      expect(model.id).toBeUndefined();
      expect(model.createdAt).toBeUndefined();
      expect(model.updatedAt).toBeUndefined();
    });
  });
});