const express = require('express');
const { User } = require('../models');
const { JWTUtils, createError } = require('../utils');
const { asyncHandler } = require('../middleware');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw createError.missingFields(['email', 'password']);
  }

  // Validate email format
  if (!User.isValidEmail(email)) {
    throw createError.invalidEmail(email);
  }

  // Validate password strength
  if (!User.isValidPassword(password)) {
    throw createError.invalidPassword('Password must be at least 6 characters long');
  }

  // Validate password confirmation if provided
  if (confirmPassword && password !== confirmPassword) {
    throw createError.validationFailed('Passwords do not match', ['confirmPassword']);
  }

  try {
    // Create new user
    const user = await User.create({
      email: email.toLowerCase().trim(),
      password: password
    });

    // Log successful registration
    console.log(`✅ User registered successfully: ${user.email} (ID: ${user.id})`);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toPublicJSON()
      }
    });
  } catch (error) {
    // Handle specific database errors
    if (error.message && error.message.includes('already exists')) {
      throw createError.userAlreadyExists(email);
    }
    
    // Re-throw other errors
    throw error;
  }
}));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password, rememberMe = false } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw createError.missingFields(['email', 'password']);
  }

  // Validate email format
  if (!User.isValidEmail(email)) {
    throw createError.invalidEmail(email);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const clientIP = req.ip || req.connection.remoteAddress;

  // Check rate limiting for this IP
  const SecurityUtils = require('../utils/security');
  const rateLimit = SecurityUtils.checkRateLimit(`login:${clientIP}`, 5, 15 * 60 * 1000);
  
  if (!rateLimit.allowed) {
    throw createError.rateLimitExceeded(
      'Too many login attempts. Please try again later.',
      rateLimit.retryAfter
    );
  }

  try {
    // Find user by email
    const user = await User.findByEmail(normalizedEmail);
    
    if (!user) {
      // Log failed login attempt
      console.warn(`⚠️  Failed login attempt for non-existent user: ${SecurityUtils.maskSensitiveData(normalizedEmail)} from IP: ${clientIP}`);
      throw createError.authenticationFailed('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await user.verifyPassword(password);
    
    if (!isPasswordValid) {
      // Log failed login attempt
      console.warn(`⚠️  Failed login attempt for user: ${user.email} (ID: ${user.id}) from IP: ${clientIP}`);
      throw createError.authenticationFailed('Invalid email or password');
    }

    // Reset rate limit on successful login
    SecurityUtils.resetRateLimit(`login:${clientIP}`);

    // Extract client information for logging
    const clientInfo = SecurityUtils.extractClientInfo(req);

    // Log successful login with client info
    console.log(`✅ User logged in successfully: ${user.email} (ID: ${user.id})`, {
      ip: clientInfo.ip,
      userAgent: clientInfo.userAgent,
      fingerprint: clientInfo.fingerprint,
      rememberMe: rememberMe,
      timestamp: clientInfo.timestamp
    });

    // Prepare response
    const responseData = {
      user: user.toPublicJSON(),
      session: {
        rememberMe: rememberMe,
        loginTime: new Date().toISOString(),
        fingerprint: clientInfo.fingerprint
      }
    };

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: responseData
    });
  } catch (error) {
    // Don't expose whether user exists or not for security
    if (error.message && error.message.includes('not found')) {
      throw createError.authenticationFailed('Invalid email or password');
    }
    
    // Re-throw other errors
    throw error;
  }
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (session cleanup)
 * @access  Public
 */
router.post('/logout', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * @route   POST /api/auth/check-password-strength
 * @desc    Check password strength without storing it
 * @access  Public
 */
router.post('/check-password-strength', asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw createError.missingFields(['password']);
  }

  const SecurityUtils = require('../utils/security');
  const strengthResult = SecurityUtils.validatePasswordStrength(password);

  res.json({
    success: true,
    message: 'Password strength analysis',
    data: {
      strength: strengthResult.strength,
      score: strengthResult.score,
      feedback: strengthResult.feedback,
      isAcceptable: strengthResult.score >= 3 // Minimum acceptable score
    }
  });
}));

/**
 * @route   GET /api/auth/login-info
 * @desc    Get information about login requirements and security
 * @access  Public
 */
router.get('/login-info', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Login information',
    data: {
      requirements: {
        email: {
          required: true,
          format: 'Valid email address'
        },
        password: {
          required: true,
          minLength: 6,
          recommendations: [
            'Use at least 8 characters',
            'Include uppercase and lowercase letters',
            'Include numbers',
            'Include special characters'
          ]
        }
      },
      security: {
        rateLimiting: {
          maxAttempts: 5,
          windowMinutes: 15,
          message: 'Account will be temporarily locked after 5 failed attempts'
        },
        features: [
          'JWT-based authentication',
          'Secure password hashing',
          'Rate limiting protection',
          'Session fingerprinting'
        ]
      },
      endpoints: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
        validate: 'POST /api/auth/validate',
        passwordStrength: 'POST /api/auth/check-password-strength'
      }
    }
  });
}));

module.exports = router;