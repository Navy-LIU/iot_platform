#!/usr/bin/env node

/**
 * Simple startup check for production deployment
 */

console.log('🚀 Starting Zeabur Server Demo...');

// Check Node.js version
const nodeVersion = process.version;
console.log(`📦 Node.js version: ${nodeVersion}`);

// Check environment
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Check database URL
if (process.env.DATABASE_URL) {
  console.log('✅ Database URL configured');
} else {
  console.warn('⚠️  DATABASE_URL not set - using default');
}

// Check port
const port = process.env.PORT || 3000;
console.log(`🔌 Port: ${port}`);

console.log('✅ Startup checks completed');
console.log('🎯 Ready to start application...');