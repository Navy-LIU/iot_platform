#!/usr/bin/env node

/**
 * Production startup script
 * Simplified version for deployment platforms
 */

console.log('🚀 Starting Zeabur Server Demo...');
console.log(`📦 Node.js: ${process.version}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔌 Port: ${process.env.PORT || 3000}`);

// Start the application
require('./app').startServer().catch((error) => {
  console.error('❌ Failed to start server:', error.message);
  // Don't exit immediately, let the process manager handle it
  setTimeout(() => {
    process.exit(1);
  }, 5000);
});