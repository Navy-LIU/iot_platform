#!/usr/bin/env node

/**
 * Development server startup script
 * Includes additional development features
 */

const { startServer } = require('../app');
const dbConnection = require('../db/connection');

const startDevelopmentServer = async () => {
  try {
    console.log('🔧 Starting development server...');
    console.log('📝 Environment: development');
    
    // Check if database needs migration
    try {
      await dbConnection.connect();
      
      // Check if users table exists
      const result = await dbConnection.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (!result.rows[0].exists) {
        console.log('⚠️  Users table not found. You may need to run migrations:');
        console.log('   npm run db:migrate');
      }
      
      await dbConnection.disconnect();
    } catch (error) {
      console.log('⚠️  Database connection failed. Make sure PostgreSQL is running.');
      console.log('   Database URL:', process.env.DATABASE_URL || 'Not set');
    }
    
    // Start the server
    await startServer();
  } catch (error) {
    console.error('❌ Development server failed to start:', error);
    process.exit(1);
  }
};

// Start development server
startDevelopmentServer();