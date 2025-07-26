const { JWTUtils, HTTP_STATUS, ERROR_CODES } = require('../utils');
const { User } = require('../models');

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING,
          message: 'Authorization header is required'
        }
      });
    }

    // Extract token (handle both "Bearer token" and "token" formats)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING,
          message: 'Token is required'
        }
      });
    }

    // Verify token format
    if (!JWTUtils.isValidTokenFormat(token)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid token format'
        }
      });
    }

    // Verify and decode token
    let decoded;
    try {
      decoded = JWTUtils.verifyToken(token);
    } catch (error) {
      const isExpired = error.message.includes('expired');
      
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: isExpired ? ERROR_CODES.AUTH_TOKEN_EXPIRED : ERROR_CODES.AUTH_TOKEN_INVALID,
          message: error.message
        }
      });
    }

    // Verify token type (should be auth token)
    if (decoded.type !== 'auth') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid token type'
        }
      });
    }

    // Get user from database to ensure they still exist
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.USER_NOT_FOUND,
          message: 'User not found'
        }
      });
    }

    // Attach user and token info to request
    req.user = user;
    req.token = {
      raw: token,
      decoded: decoded,
      userId: decoded.userId,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // If no auth header, continue without authentication
    if (!authHeader) {
      req.user = null;
      req.token = null;
      return next();
    }

    // If auth header exists, try to authenticate
    return authenticateToken(req, res, next);
  } catch (error) {
    // On error, continue without authentication
    req.user = null;
    req.token = null;
    next();
  }
};

/**
 * Middleware to check if user is authenticated (has valid token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAuth = (req, res, next) => {
  if (!req.user || !req.token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_TOKEN_MISSING,
        message: 'Authentication required'
      }
    });
  }
  
  next();
};

/**
 * Middleware to check if the authenticated user matches the requested user ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireOwnership = (req, res, next) => {
  if (!req.user || !req.token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_TOKEN_MISSING,
        message: 'Authentication required'
      }
    });
  }

  const requestedUserId = parseInt(req.params.userId || req.params.id);
  const authenticatedUserId = req.user.id;

  if (requestedUserId !== authenticatedUserId) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_CREDENTIALS_INVALID,
        message: 'Access denied: insufficient permissions'
      }
    });
  }

  next();
};

/**
 * Middleware to extract user info from token without database lookup
 * Useful for performance-critical endpoints where user existence check isn't needed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const extractUserFromToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING,
          message: 'Authorization header is required'
        }
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token || !JWTUtils.isValidTokenFormat(token)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid token'
        }
      });
    }

    const userInfo = JWTUtils.getUserFromToken(token);
    
    if (!userInfo) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid or expired token'
        }
      });
    }

    // Attach minimal user info to request
    req.tokenUser = {
      id: userInfo.userId,
      email: userInfo.email,
      type: userInfo.type
    };
    
    req.token = {
      raw: token,
      decoded: userInfo,
      userId: userInfo.userId,
      email: userInfo.email,
      iat: userInfo.iat,
      exp: userInfo.exp
    };

    next();
  } catch (error) {
    console.error('Token extraction error:', error);
    
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: {
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: 'Token extraction failed'
      }
    });
  }
};

/**
 * Middleware to validate refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_MISSING,
          message: 'Refresh token is required'
        }
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = JWTUtils.verifyToken(refreshToken);
    } catch (error) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid refresh token'
        }
      });
    }

    // Verify token type
    if (decoded.type !== 'refresh') {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.AUTH_TOKEN_INVALID,
          message: 'Invalid token type'
        }
      });
    }

    // Verify user still exists
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ERROR_CODES.USER_NOT_FOUND,
          message: 'User not found'
        }
      });
    }

    req.user = user;
    req.refreshToken = {
      raw: refreshToken,
      decoded: decoded
    };

    next();
  } catch (error) {
    console.error('Refresh token validation error:', error);
    
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Token validation failed'
      }
    });
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  requireAuth,
  requireOwnership,
  extractUserFromToken,
  validateRefreshToken
};