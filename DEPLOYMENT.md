# Deployment Guide

This guide explains how to deploy the Zeabur Server Demo application to various platforms.

## Zeabur Deployment (Recommended)

### Prerequisites
- Git repository with your code
- Zeabur account

### Steps

1. **Push your code to a Git repository** (GitHub, GitLab, etc.)

2. **Connect to Zeabur**
   - Log in to [Zeabur](https://zeabur.com)
   - Create a new project
   - Connect your Git repository

3. **Add PostgreSQL Service**
   - In your Zeabur project, add a PostgreSQL service
   - Note the connection string provided

4. **Configure Environment Variables**
   Set the following environment variables in Zeabur:

   **Required:**
   - `DATABASE_URL` - PostgreSQL connection string (from Zeabur PostgreSQL service)
   - `NODE_ENV` - Set to `production`

   **Optional:**
   - `PORT` - Port number (default: 3000)
   - `CORS_ORIGIN` - Allowed CORS origins (default: *)

5. **Deploy**
   - Zeabur will automatically detect the Node.js application
   - The deployment will use the `npm start` command
   - Health checks will be performed on `/health` endpoint

### Zeabur Configuration

The `zeabur.json` file contains the deployment configuration:

```json
{
  "name": "zeabur-server-demo",
  "type": "nodejs",
  "buildCommand": "npm install",
  "startCommand": "npm start",
  "healthCheck": {
    "path": "/health",
    "port": 3000
  }
}
```

## Docker Deployment

### Local Development with Docker

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - API: http://localhost:3000
   - Database: localhost:5432

### Production Docker Deployment

1. **Build the Docker image:**
   ```bash
   docker build -t zeabur-server-demo .
   ```

2. **Run with environment variables:**
   ```bash
   docker run -p 3000:3000 \
     -e DATABASE_URL="your-postgresql-url" \
     -e JWT_SECRET="your-jwt-secret" \
     -e NODE_ENV="production" \
     zeabur-server-demo
   ```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origins | `*` |


## Database Setup

The application will automatically create the required database tables on startup. The database schema is defined in `db/init.sql`.

### Manual Database Setup

If you need to set up the database manually:

1. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

2. **Seed test data (optional):**
   ```bash
   npm run db:seed
   ```

## Health Checks

The application provides several health check endpoints:

- `/health` - Basic health check
- `/api/system/health` - Detailed health check with system metrics
- `/api/system/status` - System status and metrics
- `/api/system/ping` - Simple connectivity test

## Security Considerations

### Production Security Checklist

- [ ] Set a strong, unique `JWT_SECRET`
- [ ] Use HTTPS in production
- [ ] Configure `CORS_ORIGIN` to specific domains
- [ ] Set `NODE_ENV=production`
- [ ] Use a secure PostgreSQL connection
- [ ] Regularly update dependencies
- [ ] Monitor application logs
- [ ] Set up proper backup for database

### JWT Secret Generation

Generate a secure JWT secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Using OpenSSL
openssl rand -hex 64
```

## Monitoring

### Available Endpoints

- **Health Check:** `GET /health`
- **System Status:** `GET /api/system/status`
- **Detailed Metrics:** `GET /api/system/metrics` (requires authentication)
- **API Info:** `GET /api/system/info`

### Logs

The application logs important events:
- User registration and login
- Authentication failures
- Database connection issues
- System errors

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` format
   - Ensure PostgreSQL service is running
   - Verify network connectivity
   - The app will start even if database connection fails (degraded mode)

2. **Port Already in Use**
   - Change `PORT` environment variable
   - Check for other running services

3. **CORS Issues**
   - Configure `CORS_ORIGIN` properly
   - Check request headers

4. **Application Won't Start**
   - Check logs for specific error messages
   - Verify all required environment variables are set
   - Ensure Node.js version is 18 or higher

### Debug Mode

Run in development mode for detailed logs:

```bash
NODE_ENV=development npm run dev
```

## Performance Optimization

### Production Recommendations

1. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start app.js --name "zeabur-server-demo"
   ```

2. **Enable compression:**
   The application includes compression middleware for better performance.

3. **Database Connection Pooling:**
   The application uses connection pooling with configurable limits.

4. **Caching:**
   Consider adding Redis for session storage and caching in high-traffic scenarios.

## Support

For issues and questions:
- Check the application logs
- Use the health check endpoints
- Review this deployment guide
- Check the API documentation at `/api/system/info`