const jwt = require('jsonwebtoken');
const config = require('../config');

class JWTUtils {
  /**
   * Generate a JWT token for a user
   * @param {Object} payload - The payload to encode in the token
   * @param {Object} options - Additional options for token generation
   * @returns {string} The generated JWT token
   */
  static generateToken(payload, options = {}) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be a valid object');
    }

    if (!payload.userId) {
      throw new Error('Payload must contain userId');
    }

    // Default options
    const defaultOptions = {
      expiresIn: config.jwt.expiresIn,
      issuer: 'zeabur-server-demo',
      audience: 'zeabur-server-demo-users'
    };

    const tokenOptions = { ...defaultOptions, ...options };

    try {
      return jwt.sign(payload, config.jwt.secret, tokenOptions);
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Generate a token for user authentication
   * @param {Object} user - User object containing id and email
   * @returns {string} The generated JWT token
   */
  static generateAuthToken(user) {
    if (!user || !user.id || !user.email) {
      throw new Error('User must have id and email properties');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      type: 'auth'
    };

    return this.generateToken(payload);
  }

  /**
   * Generate a refresh token
   * @param {Object} user - User object containing id and email
   * @returns {string} The generated refresh token
   */
  static generateRefreshToken(user) {
    if (!user || !user.id || !user.email) {
      throw new Error('User must have id and email properties');
    }

    const payload = {
      userId: user.id,
      email: user.email,
      type: 'refresh'
    };

    return this.generateToken(payload, { expiresIn: '7d' });
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - The JWT token to verify
   * @param {Object} options - Additional options for token verification
   * @returns {Object} The decoded token payload
   */
  static verifyToken(token, options = {}) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a valid string');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/, '');

    // Default options
    const defaultOptions = {
      issuer: 'zeabur-server-demo',
      audience: 'zeabur-server-demo-users'
    };

    const verifyOptions = { ...defaultOptions, ...options };

    try {
      return jwt.verify(cleanToken, config.jwt.secret, verifyOptions);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token not active yet');
      } else {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    }
  }

  /**
   * Decode a JWT token without verification (for debugging)
   * @param {string} token - The JWT token to decode
   * @returns {Object} The decoded token payload
   */
  static decodeToken(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a valid string');
    }

    const cleanToken = token.replace(/^Bearer\s+/, '');

    try {
      return jwt.decode(cleanToken, { complete: true });
    } catch (error) {
      throw new Error(`Token decode failed: ${error.message}`);
    }
  }

  /**
   * Check if a token is expired
   * @param {string} token - The JWT token to check
   * @returns {boolean} True if token is expired, false otherwise
   */
  static isTokenExpired(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload || !decoded.payload.exp) {
        return true;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   * @param {string} token - The JWT token
   * @returns {Date|null} The expiration date or null if invalid
   */
  static getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload || !decoded.payload.exp) {
        return null;
      }

      return new Date(decoded.payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get remaining time until token expires
   * @param {string} token - The JWT token
   * @returns {number} Remaining time in seconds, or 0 if expired/invalid
   */
  static getTokenRemainingTime(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload || !decoded.payload.exp) {
        return 0;
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const remainingTime = decoded.payload.exp - currentTime;
      
      return Math.max(0, remainingTime);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Extract user information from token
   * @param {string} token - The JWT token
   * @returns {Object|null} User information or null if invalid
   */
  static getUserFromToken(token) {
    try {
      const decoded = this.verifyToken(token);
      
      return {
        userId: decoded.userId,
        email: decoded.email,
        type: decoded.type,
        iat: decoded.iat,
        exp: decoded.exp
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} user - User object containing id and email
   * @returns {Object} Object containing accessToken and refreshToken
   */
  static generateTokenPair(user) {
    return {
      accessToken: this.generateAuthToken(user),
      refreshToken: this.generateRefreshToken(user)
    };
  }

  /**
   * Refresh an access token using a refresh token
   * @param {string} refreshToken - The refresh token
   * @returns {string} New access token
   */
  static refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Generate new access token
      const user = {
        id: decoded.userId,
        email: decoded.email
      };

      return this.generateAuthToken(user);
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Validate token format without verification
   * @param {string} token - The token to validate
   * @returns {boolean} True if format is valid
   */
  static isValidTokenFormat(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }

    const cleanToken = token.replace(/^Bearer\s+/, '');
    const parts = cleanToken.split('.');
    
    return parts.length === 3;
  }
}

module.exports = JWTUtils;