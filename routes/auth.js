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

    // Generate JWT tokens
    const tokens = JWTUtils.generateTokenPair(user);

    // Log successful registration
    console.log(`✅ User registered successfully: ${user.email} (ID: ${user.id})`);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.toPublicJSON(),
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenType: 'Bearer',
          expiresIn: '24h'
        }
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

    // Generate JWT tokens with appropriate expiration
    const tokenOptions = rememberMe ? { expiresIn: '30d' } : {};
    const refreshTokenOptions = rememberMe ? { expiresIn: '90d' } : { expiresIn: '7d' };
    
    const accessToken = JWTUtils.generateAuthToken(user, tokenOptions);
    const refreshToken = JWTUtils.generateRefreshToken(user, refreshTokenOptions);

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
      tokens: {
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: 'Bearer',
        expiresIn: rememberMe ? '30d' : '24h'
      },
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
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  // Validate refresh token presence
  if (!refreshToken) {
    throw createError.missingFields(['refreshToken']);
  }

  try {
    // Generate new access token
    const newAccessToken = JWTUtils.refreshAccessToken(refreshToken);

    // Get user info from refresh token for logging
    const userInfo = JWTUtils.getUserFromToken(refreshToken);
    console.log(`🔄 Token refreshed for user ID: ${userInfo.userId}`);

    // Return new access token
    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: '24h'
      }
    });
  } catch (error) {
    // Handle token refresh errors
    if (error.message && error.message.includes('refresh')) {
      throw createError.authenticationFailed('Invalid refresh token');
    }
    
    throw error;
  }
}));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Public
 * @note    In a stateless JWT system, logout is primarily handled client-side
 *          This endpoint exists for consistency and potential future token blacklisting
 */
router.post('/logout', asyncHandler(async (req, res) => {
  // In a stateless JWT system, we can't invalidate tokens server-side
  // without maintaining a blacklist. For this demo, we'll just return success
  // and rely on the client to remove the tokens.
  
  // Future enhancement: Implement token blacklisting with Redis
  
  res.json({
    success: true,
    message: 'Logout successful. Please remove tokens from client storage.'
  });
}));

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info from token
 * @access  Private
 */
router.get('/me', asyncHandler(async (req, res) => {
  // This endpoint would typically use authentication middleware
  // For now, we'll extract user info from the Authorization header
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    throw createError.authenticationFailed('Authorization header required');
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  try {
    // Get user info from token
    const userInfo = JWTUtils.getUserFromToken(token);
    
    if (!userInfo) {
      throw createError.authenticationFailed('Invalid token');
    }

    // Find user in database to get latest info
    const user = await User.findById(userInfo.userId);
    
    if (!user) {
      throw createError.userNotFound(userInfo.userId);
    }

    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        tokenInfo: {
          userId: userInfo.userId,
          email: userInfo.email,
          issuedAt: new Date(userInfo.iat * 1000).toISOString(),
          expiresAt: new Date(userInfo.exp * 1000).toISOString()
        }
      }
    });
  } catch (error) {
    if (error.message && error.message.includes('token')) {
      throw createError.authenticationFailed('Invalid or expired token');
    }
    
    throw error;
  }
}));

/**
 * @route   POST /api/auth/validate
 * @desc    Validate token without returning user data
 * @access  Public
 */
router.post('/validate', asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw createError.missingFields(['token']);
  }

  try {
    // Validate token
    const userInfo = JWTUtils.getUserFromToken(token);
    
    if (!userInfo) {
      throw createError.authenticationFailed('Invalid token');
    }

    // Check if user still exists
    const user = await User.findById(userInfo.userId);
    
    if (!user) {
      throw createError.authenticationFailed('User no longer exists');
    }

    res.json({
      success: true,
      message: 'Token is valid',
      data: {
        valid: true,
        userId: userInfo.userId,
        email: userInfo.email,
        expiresAt: new Date(userInfo.exp * 1000).toISOString()
      }
    });
  } catch (error) {
    // Return invalid status instead of throwing error
    res.json({
      success: true,
      message: 'Token validation result',
      data: {
        valid: false,
        reason: error.message
      }
    });
  }
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