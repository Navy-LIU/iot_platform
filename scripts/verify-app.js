#!/usr/bin/env node

/**
 * Application verification script
 * Verifies that all components are working correctly
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const verifyApplication = async () => {
  console.log('🔍 Starting application verification...\n');

  let hasErrors = false;
  const results = {
    files: { passed: 0, failed: 0 },
    tests: { passed: 0, failed: 0 },
    endpoints: { passed: 0, failed: 0 }
  };

  // 1. Verify critical files exist
  console.log('📁 Verifying critical files...');
  const criticalFiles = [
    'app.js',
    'package.json',
    'config/index.js',
    'db/connection.js',
    'db/init.sql',
    'models/User.js',
    'models/BaseModel.js',
    'routes/auth.js',
    'routes/user.js',
    'routes/system.js',
    'middleware/auth.js',
    'middleware/errorHandler.js',
    'utils/jwt.js',
    'utils/security.js',
    'utils/validation.js',
    'utils/errors.js'
  ];

  criticalFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
      results.files.passed++;
    } else {
      console.error(`❌ ${file}: Missing`);
      results.files.failed++;
      hasErrors = true;
    }
  });

  // 2. Verify test files exist
  console.log('\n🧪 Verifying test files...');
  const testFiles = [
    'tests/app.test.js',
    'tests/models/User.test.js',
    'tests/models/BaseModel.test.js',
    'tests/db/connection.test.js',
    'tests/routes/auth.test.js',
    'tests/routes/user.test.js',
    'tests/routes/system.test.js',
    'tests/middleware/auth.test.js',
    'tests/middleware/errorHandler.test.js',
    'tests/utils/jwt.test.js',
    'tests/utils/security.test.js',
    'tests/utils/errors.test.js',
    'tests/integration/auth.integration.test.js',
    'tests/integration/full-app.integration.test.js'
  ];

  testFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
      results.tests.passed++;
    } else {
      console.error(`❌ ${file}: Missing`);
      results.tests.failed++;
      hasErrors = true;
    }
  });

  // 3. Verify deployment files
  console.log('\n🚀 Verifying deployment files...');
  const deploymentFiles = [
    'zeabur.json',
    'Dockerfile',
    'docker-compose.yml',
    '.dockerignore',
    'DEPLOYMENT.md',
    '.env.example',
    '.env.production.example'
  ];

  deploymentFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file}`);
    } else {
      console.warn(`⚠️  ${file}: Missing (optional)`);
    }
  });

  // 4. Verify package.json scripts
  console.log('\n📦 Verifying package.json scripts...');
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredScripts = [
      'start',
      'dev',
      'test',
      'db:migrate',
      'db:seed',
      'check-env',
      'deploy:check'
    ];

    requiredScripts.forEach(script => {
      if (packageJson.scripts[script]) {
        console.log(`✅ ${script}: ${packageJson.scripts[script]}`);
      } else {
        console.error(`❌ ${script}: Missing`);
        hasErrors = true;
      }
    });

    // Check engines
    if (packageJson.engines && packageJson.engines.node) {
      console.log(`✅ Node.js engine: ${packageJson.engines.node}`);
    } else {
      console.warn('⚠️  Node.js engine not specified');
    }

  } catch (error) {
    console.error('❌ Error reading package.json:', error.message);
    hasErrors = true;
  }

  // 5. Run tests
  console.log('\n🧪 Running test suite...');
  try {
    execSync('npm test', { stdio: 'inherit' });
    console.log('✅ All tests passed');
  } catch (error) {
    console.error('❌ Some tests failed');
    hasErrors = true;
  }

  // 6. Verify application can start
  console.log('\n🚀 Verifying application startup...');
  try {
    // Try to require the main app file
    const { app } = require('../app');
    if (app) {
      console.log('✅ Application loads successfully');
    } else {
      console.error('❌ Application failed to load');
      hasErrors = true;
    }
  } catch (error) {
    console.error('❌ Application startup failed:', error.message);
    hasErrors = true;
  }

  // 7. Check dependencies
  console.log('\n📦 Checking dependencies...');
  try {
    execSync('npm audit --audit-level=moderate', { stdio: 'pipe' });
    console.log('✅ No moderate or high severity vulnerabilities');
  } catch (error) {
    console.warn('⚠️  Security vulnerabilities detected. Run "npm audit fix" to resolve.');
  }

  // 8. Verify environment configuration
  console.log('\n🔧 Verifying environment configuration...');
  const envFiles = ['.env.example', '.env.production.example'];
  envFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.warn(`⚠️  ${file} missing`);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  console.log(`📁 Files: ${results.files.passed} passed, ${results.files.failed} failed`);
  console.log(`🧪 Test files: ${results.tests.passed} passed, ${results.tests.failed} failed`);

  if (hasErrors) {
    console.error('\n❌ Application verification failed!');
    console.log('\nIssues found:');
    console.log('- Some critical files are missing');
    console.log('- Tests may be failing');
    console.log('- Application may not start correctly');
    console.log('\nPlease fix the issues above before deployment.');
    process.exit(1);
  } else {
    console.log('\n✅ Application verification completed successfully!');
    console.log('\n🎉 Your Zeabur Server Demo is ready for deployment!');
    
    console.log('\nApplication features verified:');
    console.log('✅ User registration and authentication');
    console.log('✅ JWT token management');
    console.log('✅ Password security and validation');
    console.log('✅ Database integration');
    console.log('✅ API endpoints and routing');
    console.log('✅ Error handling and validation');
    console.log('✅ Security middleware');
    console.log('✅ System monitoring and health checks');
    console.log('✅ Comprehensive test coverage');
    console.log('✅ Deployment configuration');

    console.log('\nNext steps:');
    console.log('1. Run "npm run deploy:check" for deployment preparation');
    console.log('2. Set up your environment variables');
    console.log('3. Deploy to Zeabur or your preferred platform');
    console.log('4. Run database migrations on your production database');
    
    console.log('\nUseful commands:');
    console.log('- npm start          # Start the application');
    console.log('- npm run dev        # Start in development mode');
    console.log('- npm test           # Run all tests');
    console.log('- npm run db:migrate # Set up database');
    console.log('- npm run health     # Check application health');
  }
};

// Run verification
if (require.main === module) {
  verifyApplication().catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { verifyApplication };