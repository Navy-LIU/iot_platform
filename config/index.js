require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/zeabur_demo'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  }
};

module.exports = config;