# Zeabur Server Demo

A complete demo server application for deployment on Zeabur platform with PostgreSQL database and comprehensive email authentication system.

## 🚀 Features

- **Authentication System**: User registration and login with password validation
- **User Management**: Profile management, password changes, account deletion
- **Security**: Rate limiting, password strength validation, input validation
- **Database Integration**: PostgreSQL with connection pooling and health monitoring
- **System Monitoring**: Health checks, metrics, and system status endpoints
- **Error Handling**: Comprehensive error handling with structured responses
- **Testing**: Full test coverage including unit, integration, and end-to-end tests
- **Deployment Ready**: Configured for Zeabur, Docker, and other platforms

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: Session-based authentication
- **Password Encryption**: bcrypt
- **Database Client**: pg (node-postgres)
- **Testing**: Jest + Supertest
- **Security**: Helmet, CORS, Rate limiting
- **Environment Config**: dotenv

## 📋 API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - User registration with validation
- `POST /login` - User login with rate limiting
- `POST /logout` - User logout
- `POST /check-password-strength` - Check password strength
- `GET /login-info` - Get login requirements and security info

### User Management (`/api/user`)
- `GET /profile/:id` - Get user profile by ID
- `PUT /profile/:id` - Update user profile by ID
- `GET /:id` - Get user by ID
- `DELETE /profile/:id` - Delete user account by ID
- `POST /change-password/:id` - Change password by ID
- `GET /stats/:id` - Get user statistics by ID

### System Monitoring (`/api/system`)
- `GET /health` - Detailed health check with system metrics
- `GET /status` - System status and basic metrics
- `GET /info` - API documentation and information
- `GET /metrics` - Detailed system metrics
- `GET /ping` - Simple connectivity test

### General
- `GET /` - API information and endpoint listing
- `GET /health` - Basic health check
- `GET /api/status` - System operational status

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone and install:**
   ```bash
   git clone <your-repo>
   cd zeabur-server-demo
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and JWT secret
   ```

3. **Database setup:**
   ```bash
   npm run db:migrate
   npm run db:seed  # Optional: add test data
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Verify installation:**
   ```bash
   npm run verify
   ```

## 🔧 Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (default: development)
- `CORS_ORIGIN` - CORS allowed origins (default: *)


## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Verify application integrity
npm run verify
```

## 🚀 Deployment

### Zeabur (Recommended)

1. **Prepare for deployment:**
   ```bash
   npm run deploy:check
   ```

2. **Push to Git repository**

3. **Deploy on Zeabur:**
   - Connect your repository to Zeabur
   - Add PostgreSQL service
   - Set environment variables:
     - `DATABASE_URL` (from PostgreSQL service) hkg1.clusters.zeabur.com:32127/zeabur
     - `JWT_SECRET` (secure random string)
     - `NODE_ENV=production`
4. **Zeabur will automatically:**
   - Detect Node.js application
   - Run `npm install`
   - Start with `npm start`
   - Monitor health at `/health`

### Docker

```bash
# Build and run locally
docker-compose up --build

# Build for production
npm run deploy:docker
npm run deploy:docker-run
```

### Manual Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 📊 Monitoring

- **Health Check**: `GET /health` - Database connectivity and system status
- **System Metrics**: `GET /api/system/metrics` - Detailed performance metrics
- **API Documentation**: `GET /api/system/info` - Complete API reference

## 🔒 Security Features

- **Password Security**: bcrypt hashing with strength validation
- **Rate Limiting**: Protection against brute force attacks
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses without information leakage
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js security headers

## 🛠 Development

### Available Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with auto-reload
npm run server     # Alternative start command
npm test           # Run test suite
npm run verify     # Verify application integrity
npm run check-env  # Check environment configuration
npm run db:migrate # Run database migrations
npm run db:seed    # Seed database with test data
npm run db:setup   # Run migrations and seed data
npm run health     # Check application health
```

### Project Structure

```
├── app.js                 # Main application file
├── config/               # Configuration files
├── db/                   # Database files
│   ├── connection.js     # Database connection
│   ├── init.sql         # Database schema
│   ├── migrate.js       # Migration tool
│   └── seeds.js         # Seed data
├── middleware/           # Express middleware
├── models/              # Data models
├── routes/              # API routes
├── utils/               # Utility functions
├── tests/               # Test files
├── scripts/             # Utility scripts
└── DEPLOYMENT.md        # Deployment guide
```

## 📈 Performance

- **Connection Pooling**: Efficient database connection management
- **Compression**: Response compression for better performance
- **Health Monitoring**: Real-time system health and metrics
- **Error Tracking**: Comprehensive error logging and handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Verify integrity: `npm run verify`
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check `/api/system/info` for API documentation
- Use `/health` endpoint for system diagnostics
- Review logs for debugging information
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help

---

**Ready to deploy?** Run `npm run deploy:check` to verify everything is configured correctly!