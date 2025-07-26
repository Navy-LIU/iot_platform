const JWTUtils = require('../../utils/jwt');
const jwt = require('jsonwebtoken');

describe('JWT Utils', () => {
  const mockUser = {
    id: 1,
    email: 'test@example.com'
  };

  const mockPayload = {
    userId: 1,
    email: 'test@example.com',
    type: 'auth'
  };

  describe('Token Generation', () => {
    test('should generate a valid JWT token', () => {
      const token = JWTUtils.generateToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('should generate auth token for user', () => {
      const token = JWTUtils.generateAuthToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token contains correct payload
      const decoded = JWTUtils.verifyToken(token);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('auth');
    });

    test('should generate refresh token for user', () => {
      const token = JWTUtils.generateRefreshToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token contains correct payload
      const decoded = JWTUtils.verifyToken(token);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('refresh');
    });

    test('should generate token pair', () => {
      const tokens = JWTUtils.generateTokenPair(mockUser);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');

      // Verify both tokens are valid
      const accessDecoded = JWTUtils.verifyToken(tokens.accessToken);
      const refreshDecoded = JWTUtils.verifyToken(tokens.refreshToken);

      expect(accessDecoded.type).toBe('auth');
      expect(refreshDecoded.type).toBe('refresh');
    });

    test('should throw error for invalid payload', () => {
      expect(() => {
        JWTUtils.generateToken(null);
      }).toThrow('Payload must be a valid object');

      expect(() => {
        JWTUtils.generateToken('invalid');
      }).toThrow('Payload must be a valid object');

      expect(() => {
        JWTUtils.generateToken({});
      }).toThrow('Payload must contain userId');
    });

    test('should throw error for invalid user object', () => {
      expect(() => {
        JWTUtils.generateAuthToken(null);
      }).toThrow('User must have id and email properties');

      expect(() => {
        JWTUtils.generateAuthToken({ id: 1 });
      }).toThrow('User must have id and email properties');

      expect(() => {
        JWTUtils.generateAuthToken({ email: 'test@example.com' });
      }).toThrow('User must have id and email properties');
    });
  });

  describe('Token Verification', () => {
    let validToken;

    beforeEach(() => {
      validToken = JWTUtils.generateAuthToken(mockUser);
    });

    test('should verify valid token', () => {
      const decoded = JWTUtils.verifyToken(validToken);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    test('should verify token with Bearer prefix', () => {
      const tokenWithBearer = `Bearer ${validToken}`;
      const decoded = JWTUtils.verifyToken(tokenWithBearer);

      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(mockUser.id);
    });

    test('should throw error for invalid token', () => {
      expect(() => {
        JWTUtils.verifyToken('invalid.token.here');
      }).toThrow('Invalid token');
    });

    test('should throw error for expired token', () => {
      // Generate token that expires immediately
      const expiredToken = JWTUtils.generateToken(mockPayload, { expiresIn: '0s' });
      
      // Wait a bit to ensure expiration
      setTimeout(() => {
        expect(() => {
          JWTUtils.verifyToken(expiredToken);
        }).toThrow('Token has expired');
      }, 100);
    });

    test('should throw error for null or empty token', () => {
      expect(() => {
        JWTUtils.verifyToken(null);
      }).toThrow('Token must be a valid string');

      expect(() => {
        JWTUtils.verifyToken('');
      }).toThrow('Token must be a valid string');
    });
  });

  describe('Token Decoding', () => {
    let validToken;

    beforeEach(() => {
      validToken = JWTUtils.generateAuthToken(mockUser);
    });

    test('should decode token without verification', () => {
      const decoded = JWTUtils.decodeToken(validToken);

      expect(decoded).toBeDefined();
      expect(decoded.header).toBeDefined();
      expect(decoded.payload).toBeDefined();
      expect(decoded.signature).toBeDefined();
      expect(decoded.payload.userId).toBe(mockUser.id);
    });

    test('should decode token with Bearer prefix', () => {
      const tokenWithBearer = `Bearer ${validToken}`;
      const decoded = JWTUtils.decodeToken(tokenWithBearer);

      expect(decoded.payload.userId).toBe(mockUser.id);
    });

    test('should throw error for invalid token format', () => {
      expect(() => {
        JWTUtils.decodeToken('invalid-token');
      }).toThrow('Token decode failed');
    });
  });

  describe('Token Expiration', () => {
    test('should check if token is expired', () => {
      const validToken = JWTUtils.generateAuthToken(mockUser);
      const expiredToken = JWTUtils.generateToken(mockPayload, { expiresIn: '0s' });

      expect(JWTUtils.isTokenExpired(validToken)).toBe(false);
      
      // Wait a bit for expiration
      setTimeout(() => {
        expect(JWTUtils.isTokenExpired(expiredToken)).toBe(true);
      }, 100);
    });

    test('should return true for invalid tokens', () => {
      expect(JWTUtils.isTokenExpired('invalid-token')).toBe(true);
      expect(JWTUtils.isTokenExpired(null)).toBe(true);
    });

    test('should get token expiration date', () => {
      const token = JWTUtils.generateAuthToken(mockUser);
      const expiration = JWTUtils.getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
    });

    test('should return null for invalid token expiration', () => {
      expect(JWTUtils.getTokenExpiration('invalid-token')).toBeNull();
      expect(JWTUtils.getTokenExpiration(null)).toBeNull();
    });

    test('should get remaining time until expiration', () => {
      const token = JWTUtils.generateAuthToken(mockUser);
      const remainingTime = JWTUtils.getTokenRemainingTime(token);

      expect(remainingTime).toBeGreaterThan(0);
      expect(remainingTime).toBeLessThanOrEqual(24 * 60 * 60); // Should be less than 24 hours
    });

    test('should return 0 for expired or invalid tokens', () => {
      expect(JWTUtils.getTokenRemainingTime('invalid-token')).toBe(0);
      expect(JWTUtils.getTokenRemainingTime(null)).toBe(0);
    });
  });

  describe('User Extraction', () => {
    test('should extract user from valid token', () => {
      const token = JWTUtils.generateAuthToken(mockUser);
      const user = JWTUtils.getUserFromToken(token);

      expect(user).toBeDefined();
      expect(user.userId).toBe(mockUser.id);
      expect(user.email).toBe(mockUser.email);
      expect(user.type).toBe('auth');
      expect(user.iat).toBeDefined();
      expect(user.exp).toBeDefined();
    });

    test('should return null for invalid token', () => {
      const user = JWTUtils.getUserFromToken('invalid-token');
      expect(user).toBeNull();
    });
  });

  describe('Token Refresh', () => {
    test('should refresh access token using refresh token', () => {
      const refreshToken = JWTUtils.generateRefreshToken(mockUser);
      const newAccessToken = JWTUtils.refreshAccessToken(refreshToken);

      expect(newAccessToken).toBeDefined();
      expect(typeof newAccessToken).toBe('string');

      // Verify new token is valid
      const decoded = JWTUtils.verifyToken(newAccessToken);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.type).toBe('auth');
    });

    test('should throw error when using auth token as refresh token', () => {
      const authToken = JWTUtils.generateAuthToken(mockUser);

      expect(() => {
        JWTUtils.refreshAccessToken(authToken);
      }).toThrow('Invalid refresh token type');
    });

    test('should throw error for invalid refresh token', () => {
      expect(() => {
        JWTUtils.refreshAccessToken('invalid-token');
      }).toThrow('Token refresh failed');
    });
  });

  describe('Token Format Validation', () => {
    test('should validate correct token format', () => {
      const token = JWTUtils.generateAuthToken(mockUser);
      
      expect(JWTUtils.isValidTokenFormat(token)).toBe(true);
      expect(JWTUtils.isValidTokenFormat(`Bearer ${token}`)).toBe(true);
    });

    test('should reject invalid token formats', () => {
      expect(JWTUtils.isValidTokenFormat('invalid-token')).toBe(false);
      expect(JWTUtils.isValidTokenFormat('part1.part2')).toBe(false);
      expect(JWTUtils.isValidTokenFormat('part1.part2.part3.part4')).toBe(false);
      expect(JWTUtils.isValidTokenFormat(null)).toBe(false);
      expect(JWTUtils.isValidTokenFormat('')).toBe(false);
      expect(JWTUtils.isValidTokenFormat(123)).toBe(false);
    });
  });

  describe('Custom Options', () => {
    test('should generate token with custom expiration', () => {
      const token = JWTUtils.generateToken(mockPayload, { expiresIn: '1h' });
      const decoded = JWTUtils.decodeToken(token);
      
      // Check that expiration is approximately 1 hour from now
      const expectedExp = Math.floor(Date.now() / 1000) + (60 * 60);
      const actualExp = decoded.payload.exp;
      
      expect(Math.abs(actualExp - expectedExp)).toBeLessThan(10); // Within 10 seconds
    });

    test('should verify token with custom options', () => {
      const token = JWTUtils.generateToken(mockPayload);
      
      // Should work with default options
      expect(() => {
        JWTUtils.verifyToken(token);
      }).not.toThrow();

      // Should work with custom options that match
      expect(() => {
        JWTUtils.verifyToken(token, { 
          issuer: 'zeabur-server-demo',
          audience: 'zeabur-server-demo-users'
        });
      }).not.toThrow();
    });
  });
});