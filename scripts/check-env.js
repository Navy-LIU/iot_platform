#!/usr/bin/env node

/**
 * Environment check script
 * Validates required environment variables and dependencies
 */

const fs = require('fs');
const path = require('path');

const checkEnvironment = () => {
  console.log('🔍 Checking environment configuration...\n');

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

  // Check environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const optionalEnvVars = [
    'PORT',
    'NODE_ENV',
    'CORS_ORIGIN',
    'JWT_EXPIRES_IN'
  ];

  console.log('\n🔧 Environment variables:');
  
  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: Set`);
    } else {
      console.error(`❌ ${envVar}: Missing (required)`);
      hasErrors = true;
    }
  });

  optionalEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: ${process.env[envVar]}`);
    } else {
      console.log(`⚠️  ${envVar}: Not set (using default)`);
    }
  });

  // Check .env file
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log('\n✅ .env file found');
  } else {
    console.log('\n⚠️  .env file not found (using system environment variables)');
  }

  // Check package.json
  const packagePath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packagePath)) {
    console.log('✅ package.json found');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      console.log(`📋 Project: ${packageJson.name} v${packageJson.version}`);
    } catch (error) {
      console.error('❌ Error reading package.json:', error.message);
      hasErrors = true;
    }
  } else {
    console.error('❌ package.json not found');
    hasErrors = true;
  }

  // Check critical files
  const criticalFiles = [
    'app.js',
    'config/index.js',
    'db/connection.js',
    'models/User.js',
    'utils/jwt.js',
    'middleware/auth.js'
  ];

  console.log('\n📁 Critical files:');
  criticalFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.error(`❌ ${file}: Missing`);
      hasErrors = true;
    }
  });

  // Database URL validation
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      console.log('\n🗄️  Database configuration:');
      console.log(`✅ Protocol: ${url.protocol}`);
      console.log(`✅ Host: ${url.hostname}`);
      console.log(`✅ Port: ${url.port || 'default'}`);
      console.log(`✅ Database: ${url.pathname.slice(1)}`);
      console.log(`✅ Username: ${url.username || 'not specified'}`);
    } catch (error) {
      console.error('\n❌ Invalid DATABASE_URL format:', error.message);
      hasErrors = true;
    }
  }

  // JWT Secret validation
  if (process.env.JWT_SECRET) {
    const secretLength = process.env.JWT_SECRET.length;
    console.log('\n🔐 JWT configuration:');
    console.log(`✅ Secret length: ${secretLength} characters`);
    
    if (secretLength < 32) {
      console.error('⚠️  JWT secret should be at least 32 characters for security');
    }
    
    if (process.env.JWT_SECRET === 'demo-jwt-secret-key-for-development-only') {
      console.error('⚠️  Using default JWT secret - change this in production!');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (hasErrors) {
    console.error('❌ Environment check failed. Please fix the errors above.');
    process.exit(1);
  } else {
    console.log('✅ Environment check passed. Ready to start!');
    console.log('\nNext steps:');
    console.log('  npm run db:migrate  # Set up database');
    console.log('  npm run dev         # Start development server');
  }
};

// Run check if called directly
if (require.main === module) {
  checkEnvironment();
}

module.exports = { checkEnvironment };