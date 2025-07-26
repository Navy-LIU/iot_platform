const express = require('express');
const os = require('os');
const { User } = require('../models');
const { createError } = require('../utils');
const { asyncHandler, auth } = require('../middleware');
const dbConnection = require('../db/connection');
const config = require('../config');

const router = express.Router();

/**
 * @route   GET /api/system/health
 * @desc    Detailed health check endpoint
 * @access  Public
 */
router.get('/health', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Database health check
    const dbHealth = await dbConnection.healthCheck();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem()
    };

    // CPU information
    const cpuInfo = os.cpus();
    const loadAverage = os.loadavg();

    // System information
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      nodeVersion: process.version,
      uptime: {
        process: process.uptime(),
        system: os.uptime()
      }
    };

    const responseTime = Date.now() - startTime;
    
    const healthStatus = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      services: {
        database: dbHealth,
        api: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
          }
        }
      },
      system: {
        ...systemInfo,
        memory: {
          total: `${Math.round(systemMemory.total / 1024 / 1024 / 1024)}GB`,
          free: `${Math.round(systemMemory.free / 1024 / 1024 / 1024)}GB`,
          used: `${Math.round(systemMemory.used / 1024 / 1024 / 1024)}GB`,
          usage: `${Math.round((systemMemory.used / systemMemory.total) * 100)}%`
        },
        cpu: {
          count: cpuInfo.length,
          model: cpuInfo[0]?.model || 'Unknown',
          loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
        }
      }
    };

    // Return appropriate status code
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
}));

/**
 * @route   GET /api/system/status
 * @desc    System status with basic metrics
 * @access  Public
 */
router.get('/status', asyncHandler(async (req, res) => {
  try {
    const dbHealth = await dbConnection.healthCheck();
    const memoryUsage = process.memoryUsage();
    
    // Get user count (basic metric)
    let userCount = 0;
    try {
      userCount = await User.count();
    } catch (error) {
      console.warn('Could not get user count:', error.message);
    }

    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      services: {
        api: {
          status: 'healthy',
          uptime: Math.floor(process.uptime()),
          memory: {
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
          }
        },
        database: {
          status: dbHealth.status,
          message: dbHealth.message,
          connections: dbHealth.data?.totalConnections || 0
        }
      },
      metrics: {
        totalUsers: userCount,
        uptime: Math.floor(process.uptime()),
        memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024)
      }
    });
  } catch (error) {
    console.error('Status check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Status check failed',
      message: error.message
    });
  }
}));

/**
 * @route   GET /api/system/info
 * @desc    System information and API documentation
 * @access  Public
 */
router.get('/info', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    message: 'Zeabur Server Demo API Information',
    data: {
      api: {
        name: 'Zeabur Server Demo',
        version: process.env.npm_package_version || '1.0.0',
        description: 'A demo server application for deployment on Zeabur with PostgreSQL and email authentication',
        environment: config.nodeEnv,
        nodeVersion: process.version,
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      endpoints: {
        authentication: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          refresh: 'POST /api/auth/refresh',
          logout: 'POST /api/auth/logout',
          me: 'GET /api/auth/me',
          validate: 'POST /api/auth/validate',
          passwordStrength: 'POST /api/auth/check-password-strength',
          loginInfo: 'GET /api/auth/login-info'
        },
        user: {
          profile: 'GET /api/user/profile',
          updateProfile: 'PUT /api/user/profile',
          getUserById: 'GET /api/user/:id',
          deleteAccount: 'DELETE /api/user/profile',
          changePassword: 'POST /api/user/change-password',
          stats: 'GET /api/user/stats'
        },
        system: {
          health: 'GET /api/system/health',
          status: 'GET /api/system/status',
          info: 'GET /api/system/info',
          metrics: 'GET /api/system/metrics'
        }
      },
      features: [
        'JWT-based authentication',
        'User registration and login',
        'Password strength validation',
        'Rate limiting protection',
        'Comprehensive error handling',
        'Database health monitoring',
        'System metrics and monitoring'
      ],
      security: {
        authentication: 'JWT tokens',
        passwordHashing: 'bcrypt',
        rateLimiting: 'In-memory store',
        inputValidation: 'Comprehensive validation',
        errorHandling: 'Structured error responses'
      }
    }
  });
}));

/**
 * @route   GET /api/system/metrics
 * @desc    System metrics for monitoring
 * @access  Private (requires authentication)
 */
router.get('/metrics', auth.authenticateToken, asyncHandler(async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const systemMemory = {
      total: os.totalmem(),
      free: os.freemem()
    };

    // Database metrics
    const dbHealth = await dbConnection.healthCheck();
    
    // User metrics
    const userCount = await User.count();
    
    // Calculate some basic metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: {
        process: process.uptime(),
        system: os.uptime()
      },
      memory: {
        process: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        },
        system: {
          total: systemMemory.total,
          free: systemMemory.free,
          used: systemMemory.total - systemMemory.free,
          usagePercent: Math.round(((systemMemory.total - systemMemory.free) / systemMemory.total) * 100)
        }
      },
      cpu: {
        loadAverage: os.loadavg(),
        cpuCount: os.cpus().length
      },
      database: {
        status: dbHealth.status,
        connections: dbHealth.data?.totalConnections || 0,
        idleConnections: dbHealth.data?.idleConnections || 0,
        waitingConnections: dbHealth.data?.waitingConnections || 0
      },
      application: {
        totalUsers: userCount,
        environment: config.nodeEnv,
        nodeVersion: process.version,
        version: process.env.npm_package_version || '1.0.0'
      }
    };

    res.json({
      success: true,
      message: 'System metrics retrieved successfully',
      data: metrics
    });
  } catch (error) {
    console.error('Metrics collection failed:', error);
    throw createError.internalError('Failed to collect system metrics');
  }
}));

/**
 * @route   GET /api/system/ping
 * @desc    Simple ping endpoint for basic connectivity test
 * @access  Public
 */
router.get('/ping', asyncHandler(async (req, res) => {
  const timestamp = new Date().toISOString();
  
  res.json({
    success: true,
    message: 'pong',
    timestamp: timestamp,
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
}));

module.exports = router;