const { HTTP_STATUS, ERROR_CODES } = require('../utils');
const { AppError, isOperationalError, handleDatabaseError } = require('../utils/errors');

/**
 * Enhanced error logging
 */
const logError = (err, req) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    error: {
      name: err.name,
      message: err.message,
      statusCode: err.statusCode,
      errorCode: err.errorCode,
      isOperational: err.isOperational
    }
  };

  // Add user info if available
  if (req.user) {
    errorInfo.user = {
      id: req.user.id,
      email: req.user.email
    };
  }

  // Add request body for POST/PUT requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    const sanitizedBody = { ...req.body };
    // Remove sensitive fields
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.refreshToken;
    errorInfo.requestBody = sanitizedBody;
  }

  // Log based on error severity
  if (err.statusCode >= 500) {
    console.error('🚨 Server Error:', errorInfo);
    
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (e.g., Sentry, LogRocket)
    }
  } else if (err.statusCode >= 400) {
    console.warn('⚠️  Client Error:', errorInfo);
  } else {
    console.log('ℹ️  Info:', errorInfo);
  }

  // Always log stack trace in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', err.stack);
  }
};

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert database errors to application errors
  if (err.code && typeof err.code === 'string' && err.code.match(/^\d+$/)) {
    error = handleDatabaseError(err);
  }

  // Convert generic errors to AppError
  if (!(error instanceof AppError)) {
    // Handle specific Node.js/Express errors
    if (err.name === 'ValidationError') {
      error = new AppError(err.message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
    } else if (err.name === 'CastError') {
      error = new AppError('Invalid data format', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    } else if (err.type === 'entity.parse.failed') {
      error = new AppError('Invalid JSON format', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    } else if (err.type === 'entity.too.large') {
      error = new AppError('Request payload too large', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    } else if (err.name === 'MulterError') {
      error = new AppError('File upload error', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BAD_REQUEST);
    } else {
      // Generic server error
      error = new AppError(
        process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  // Log the error
  logError(error, req);

  // Prepare response
  const response = {
    success: false,
    error: {
      code: error.errorCode,
      message: error.message
    }
  };

  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    response.error.details = {
      name: error.name,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      stack: error.stack
    };

    // Add original error info if available
    if (error.originalError) {
      response.error.details.originalError = error.originalError;
    }

    // Add fields info for validation errors
    if (error.fields) {
      response.error.fields = error.fields;
    }
  }

  // Add retry-after header for rate limiting
  if (error.statusCode === 429 && error.retryAfter) {
    res.set('Retry-After', error.retryAfter);
  }

  // Send error response
  res.status(error.statusCode).json(response);
};

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const notFoundHandler = (req, res) => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: `Route ${req.method} ${req.url} not found`
    }
  });
};

/**
 * Async error wrapper to catch async errors in route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};