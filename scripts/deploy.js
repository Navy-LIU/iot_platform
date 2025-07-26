#!/usr/bin/env node

/**
 * Deployment preparation script
 * Checks environment and prepares for deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const deploymentChecks = async () => {
  console.log('🚀 Starting deployment preparation...\n');

  let hasErrors = false;

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  console.log(`📦 Node.js version: ${nodeVersion}`);
  if (majorVersion < 18) {
    console.error('❌ Node.js version 18 or higher is required for deployment');
    hasErrors = true;
  } else {
    console.log('✅ Node.js version is compatible');
  }

  // Check package.json
  const packagePath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packagePath)) {
    console.error('❌ package.json not found');
    hasErrors = true;
  } else {
    console.log('✅ package.json found');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check required scripts
      const requiredScripts = ['start', 'test'];
      const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
      
      if (missingScripts.length > 0) {
        console.error(`❌ Missing required scripts: ${missingScripts.join(', ')}`);
        hasErrors = true;
      } else {
        console.log('✅ Required scripts are present');
      }

      // Check engines
      if (packageJson.engines && packageJson.engines.node) {
        console.log(`✅ Node.js engine specified: ${packageJson.engines.node}`);
      } else {
        console.warn('⚠️  Node.js engine not specified in package.json');
      }

    } catch (error) {
      console.error('❌ Error reading package.json:', error.message);
      hasErrors = true;
    }
  }

  // Check critical files
  const criticalFiles = [
    'app.js',
    'config/index.js',
    'db/connection.js',
    'db/init.sql',
    'models/User.js',
    'routes/auth.js',
    'routes/user.js',
    'routes/system.js'
  ];

  console.log('\n📁 Checking critical files:');
  criticalFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.error(`❌ ${file}: Missing`);
      hasErrors = true;
    }
  });

  // Check environment variables for production
  console.log('\n🔧 Environment variables for production:');
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET'
  ];

  const optionalEnvVars = [
    'PORT',
    'NODE_ENV',
    'CORS_ORIGIN'
  ];

  // Note: In production, these should be set in the deployment platform
  console.log('Required environment variables (set these in your deployment platform):');
  requiredEnvVars.forEach(envVar => {
    console.log(`  - ${envVar}`);
  });

  console.log('Optional environment variables:');
  optionalEnvVars.forEach(envVar => {
    console.log(`  - ${envVar}`);
  });

  // Run tests
  console.log('\n🧪 Running tests...');
  try {
    execSync('npm test', { stdio: 'inherit' });
    console.log('✅ All tests passed');
  } catch (error) {
    console.error('❌ Tests failed');
    hasErrors = true;
  }

  // Check dependencies
  console.log('\n📦 Checking dependencies...');
  try {
    execSync('npm audit --audit-level=high', { stdio: 'pipe' });
    console.log('✅ No high-severity vulnerabilities found');
  } catch (error) {
    console.warn('⚠️  Security vulnerabilities detected. Run "npm audit fix" to resolve.');
  }

  // Build check (if applicable)
  console.log('\n🔨 Build check...');
  try {
    // For this project, we don't have a build step, but we can check if all modules load
    require('../app.js');
    console.log('✅ Application loads successfully');
  } catch (error) {
    console.error('❌ Application failed to load:', error.message);
    hasErrors = true;
  }

  // Generate deployment summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));

  if (hasErrors) {
    console.error('❌ Deployment preparation failed. Please fix the errors above.');
    console.log('\nNext steps:');
    console.log('1. Fix all reported errors');
    console.log('2. Run this script again');
    console.log('3. Deploy to your platform');
    process.exit(1);
  } else {
    console.log('✅ Deployment preparation completed successfully!');
    console.log('\nNext steps for Zeabur deployment:');
    console.log('1. Push your code to a Git repository');
    console.log('2. Connect your repository to Zeabur');
    console.log('3. Add a PostgreSQL service in Zeabur');
    console.log('4. Set the following environment variables in Zeabur:');
    console.log('   - DATABASE_URL (from PostgreSQL service)');
    console.log('   - JWT_SECRET (generate a secure random string)');
    console.log('   - NODE_ENV=production');
    console.log('5. Deploy!');
    
    console.log('\nOptional environment variables:');
    console.log('   - PORT (default: 3000)');
    console.log('   - CORS_ORIGIN (default: *)');
    
    console.log('\nHealth check endpoint: /health');
    console.log('API documentation: /api/system/info');
  }
};

// Run deployment checks
if (require.main === module) {
  deploymentChecks().catch((error) => {
    console.error('❌ Deployment preparation failed:', error);
    process.exit(1);
  });
}

module.exports = { deploymentChecks };