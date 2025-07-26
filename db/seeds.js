const { User } = require('../models');
const dbConnection = require('./connection');

class DatabaseSeeder {
  async run() {
    try {
      console.log('🌱 Starting database seeding...');
      
      // Connect to database
      await dbConnection.connect();
      
      // Create test users
      const testUsers = [
        {
          email: 'admin@example.com',
          password: 'admin123'
        },
        {
          email: 'user@example.com',
          password: 'user123'
        },
        {
          email: 'test@example.com',
          password: 'test123'
        }
      ];

      for (const userData of testUsers) {
        try {
          // Check if user already exists
          const existingUser = await User.findByEmail(userData.email);
          if (!existingUser) {
            const user = await User.create(userData);
            console.log(`✅ Created user: ${user.email}`);
          } else {
            console.log(`⚠️  User already exists: ${userData.email}`);
          }
        } catch (error) {
          console.error(`❌ Failed to create user ${userData.email}:`, error.message);
        }
      }
      
      // Display statistics
      const userCount = await User.count();
      console.log(`📊 Total users in database: ${userCount}`);
      
      console.log('🎉 Database seeding completed');
      
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      throw error;
    }
  }

  async clear() {
    try {
      console.log('🧹 Clearing database...');
      
      await dbConnection.connect();
      
      // Delete all users
      await dbConnection.query('DELETE FROM users');
      
      console.log('✅ Database cleared');
      
    } catch (error) {
      console.error('❌ Clear failed:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const seeder = new DatabaseSeeder();
  
  const command = process.argv[2];
  
  if (command === 'run') {
    seeder.run()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'clear') {
    seeder.clear()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('Usage: node db/seeds.js [run|clear]');
    process.exit(1);
  }
}

module.exports = DatabaseSeeder;