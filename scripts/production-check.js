#!/usr/bin/env node

/**
 * Production environment check
 * Simplified check for deployment platforms
 */

console.log('🔍 Production environment check...');

let hasErrors = false;

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

console.log(`📦 Node.js version: ${nodeVersion}`);
if (majorVersion < 18) {
  console.error('❌ Node.js version 18 or higher is required');
  hasErrors = true;
} else {
  console.log('✅ Node.js version is compatible');
}

// Check environment
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

// Check database URL (optional in production)
if (process.env.DATABASE_URL) {
  console.log('✅ DATABASE_URL is set');
} else {
  console.warn('⚠️  DATABASE_URL not set - app will run in degraded mode');
}

// Check port
const port = process.env.PORT || 3000;
console.log(`🔌 Port: ${port}`);

if (hasErrors) {
  console.error('❌ Environment check failed');
  process.exit(1);
} else {
  console.log('✅ Environment check passed');
  console.log('🚀 Ready for production deployment');
}