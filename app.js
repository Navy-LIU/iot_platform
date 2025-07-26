const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const dbConnection = require('./db/connection');
const { errorHandler, notFoundHandler } = require('./middleware');

// Create Express application
const app = express();

// Trust proxy for deployment platforms like Zeabur
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: config.cors.origin === '*' ? true : config.cors.origin,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (development only)
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint (before authentication)
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbConnection.healthCheck();
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
      version: process.env.npm_package_version || '1.0.0',
      database: dbHealth
    };

    // Return 503 if database is unhealthy
    if (dbHealth.status !== 'healthy') {
      healthStatus.status = 'unhealthy';
      return res.status(503).json(healthStatus);
    }

    res.json(healthStatus);
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      database: {
        status: 'unhealthy',
        message: 'Database health check failed'
      }
    });
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const systemRoutes = require('./routes/system');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/system', systemRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Zeabur Server Demo API',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: {
        auth: '/api/auth',
        user: '/api/user',
        status: '/api/status'
      }
    }
  });
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const dbHealth = await dbConnection.healthCheck();
    
    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.env.npm_package_version || '1.0.0'
        },
        database: dbHealth
      }
    });
  } catch (error) {
    console.error('Status check failed:', error);
    
    res.status(503).json({
      success: false,
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Status check failed'
    });
  }
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Database connection and server startup
const startServer = async () => {
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    await dbConnection.connect();
    console.log('✅ Database connected successfully');

    // Start server
    const port = config.port;
    const server = app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
      console.log(`📍 Environment: ${config.nodeEnv}`);
      console.log(`🌐 Health check: http://localhost:${port}/health`);
      console.log(`📊 API status: http://localhost:${port}/api/status`);
      
      if (config.nodeEnv === 'development') {
        console.log(`🏠 Local URL: http://localhost:${port}`);
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\n📡 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        console.log('🔌 HTTP server closed');
        
        try {
          await dbConnection.disconnect();
          console.log('🗄️  Database disconnected');
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if this file is run directly
if (require.main === module) {
  startServer();
}

// Export app for testing
module.exports = { app, startServer };