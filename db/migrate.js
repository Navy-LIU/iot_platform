const fs = require('fs').promises;
const path = require('path');
const dbConnection = require('./connection');

class DatabaseMigrator {
  async runMigrations() {
    try {
      console.log('🚀 Starting database migrations...');
      
      // Connect to database
      await dbConnection.connect();
      
      // Read and execute init.sql
      const initSqlPath = path.join(__dirname, 'init.sql');
      const initSql = await fs.readFile(initSqlPath, 'utf8');
      
      // Split SQL commands and execute them
      const commands = initSql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0);
      
      for (const command of commands) {
        if (command.trim()) {
          await dbConnection.query(command);
          console.log('✅ Executed migration command');
        }
      }
      
      console.log('🎉 Database migrations completed successfully');
      
      // Test the setup
      const result = await dbConnection.query('SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = \'public\'');
      console.log(`📊 Database has ${result.rows[0].table_count} tables`);
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  }

  async rollback() {
    try {
      console.log('🔄 Rolling back database...');
      
      await dbConnection.connect();
      
      // Drop tables in reverse order
      await dbConnection.query('DROP TABLE IF EXISTS users CASCADE');
      await dbConnection.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
      
      console.log('✅ Database rollback completed');
      
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
}

// CLI usage
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  
  const command = process.argv[2];
  
  if (command === 'up') {
    migrator.runMigrations()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else if (command === 'down') {
    migrator.rollback()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  } else {
    console.log('Usage: node db/migrate.js [up|down]');
    process.exit(1);
  }
}

module.exports = DatabaseMigrator;