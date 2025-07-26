#!/usr/bin/env node

/**
 * Server startup script
 * This file is used as an alternative entry point for deployment
 */

const { startServer } = require('./app');

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});