# Mahoot Feed Generator - Deployment Guide

## Overview

Mahoot is a time-controlled social media feed generator for BlueSky that implements client-side curation protocols. It helps users manage their social media consumption by setting daily post limits and ensuring fair exposure for all followees through "Mahoot Numbers."

## Features

- **Daily Post Limits**: Set custom daily consumption limits (1-1000 posts)
- **Mahoot Numbers**: Guaranteed minimum posts per followee per day
- **Followee Amplification**: Amp up important voices or amp down prolific posters
- **Random Subset Selection**: Prevents over-posting accounts from dominating feeds
- **User Preferences**: Customizable settings with persistence
- **Statistics & Insights**: Comprehensive usage analytics
- **Rich Metadata**: Enhanced feed information for client applications

## Prerequisites

- Node.js 18+ 
- Yarn package manager
- BlueSky account for publishing the feed
- Server with persistent storage (for SQLite database)

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/mahoot-feed-generator.git
   cd mahoot-feed-generator
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Build the project**:
   ```bash
   yarn build
   ```

## Configuration

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables**:
   ```env
   # BlueSky Configuration
   BLUESKY_IDENTIFIER=your-username.bsky.social
   BLUESKY_PASSWORD=your-app-password
   
   # Feed Generator Configuration
   SERVICE_DID=did:web:your-domain.com
   PUBLISHER_DID=did:plc:your-did
   
   # Database Configuration
   SQLITE_LOCATION=./data/mahoot.db
   
   # Server Configuration
   PORT=3000
   HOST=0.0.0.0
   
   # Firehose Configuration
   SUBSCRIPTION_ENDPOINT=wss://bsky.social/xrpc/com.atproto.sync.subscribeRepos
   SUBSCRIPTION_RECONNECT_DELAY=3000
   ```

3. **Set up your DID**:
   - Create a DID using [did.actor](https://did.actor) or similar service
   - Update `SERVICE_DID` and `PUBLISHER_DID` in your `.env` file

## Database Setup

The system uses SQLite with automatic migrations:

1. **Create data directory**:
   ```bash
   mkdir -p data
   ```

2. **Run migrations** (automatic on startup):
   ```bash
   yarn start
   ```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests
yarn test

# Run validation tests only
yarn test:validation

# Run integration tests only
yarn test:integration
```

## Deployment

### Local Development

```bash
# Start development server
yarn dev

# Start production server
yarn start
```

### Production Deployment

1. **Build the application**:
   ```bash
   yarn build
   ```

2. **Start the server**:
   ```bash
   yarn start
   ```

3. **Publish the feed to BlueSky**:
   ```bash
   yarn publishFeed
   ```

### Docker Deployment

1. **Build Docker image**:
   ```bash
   docker build -t mahoot-feed-generator .
   ```

2. **Run container**:
   ```bash
   docker run -d \
     --name mahoot-feed \
     -p 3000:3000 \
     -v $(pwd)/data:/app/data \
     --env-file .env \
     mahoot-feed-generator
   ```

### Cloud Deployment

#### Railway

1. **Connect your repository** to Railway
2. **Set environment variables** in Railway dashboard
3. **Deploy automatically** on git push

#### Render

1. **Create a new Web Service**
2. **Connect your repository**
3. **Set build command**: `yarn build`
4. **Set start command**: `yarn start`
5. **Add environment variables**

#### DigitalOcean App Platform

1. **Create a new app**
2. **Connect your repository**
3. **Configure build settings**:
   - Build Command: `yarn build`
   - Run Command: `yarn start`
4. **Set environment variables**

## API Endpoints

### Feed Generation
- `GET /xrpc/app.bsky.feed.getFeedSkeleton` - Generate Mahoot feed
- `GET /xrpc/app.bsky.feed.describeFeedGenerator` - Feed metadata

### User Preferences
- `GET /xrpc/com.mahoot.getPreferences` - Get user preferences
- `POST /xrpc/com.mahoot.putPreferences` - Update preferences
- `GET /xrpc/com.mahoot.getFeedConfig` - Get feed configuration

### Followee Management
- `GET /xrpc/com.mahoot.getFollowees` - Get followee list
- `POST /xrpc/com.mahoot.updateFollowee` - Update followee Mahoot number
- `POST /xrpc/com.mahoot.removeFollowee` - Remove followee

### Statistics
- `GET /xrpc/com.mahoot.getStats` - Get user statistics

## Monitoring

### Health Checks

The server provides health check endpoints:

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (database connectivity)

### Logs

Monitor application logs for:
- Feed generation performance
- Database operations
- Error rates
- User activity patterns

### Metrics

Key metrics to monitor:
- Feed generation latency
- Database query performance
- User engagement rates
- Daily post consumption patterns

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Ensure SQLite file is writable
   - Check disk space
   - Verify file permissions

2. **Feed Generation Failures**:
   - Check BlueSky API connectivity
   - Verify user authentication
   - Review error logs

3. **Performance Issues**:
   - Monitor database size
   - Check server resources
   - Review query performance

### Debug Mode

Enable debug logging:

```bash
DEBUG=mahoot:* yarn start
```

### Database Maintenance

Clean up old data:

```bash
# The system automatically cleans up old statistics
# Manual cleanup can be done via SQLite CLI
sqlite3 data/mahoot.db "DELETE FROM post_statistics WHERE viewed_at < datetime('now', '-60 days');"
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Database Security**: Restrict access to SQLite file
3. **API Rate Limiting**: Implement rate limiting for production
4. **Input Validation**: All user inputs are validated
5. **Authentication**: JWT-based authentication for user-specific features

## Backup Strategy

1. **Database Backups**:
   ```bash
   # Create backup
   cp data/mahoot.db data/mahoot-backup-$(date +%Y%m%d).db
   
   # Restore from backup
   cp data/mahoot-backup-20231201.db data/mahoot.db
   ```

2. **Configuration Backups**: Backup `.env` and configuration files

## Scaling Considerations

1. **Database**: Consider PostgreSQL for high-traffic deployments
2. **Caching**: Implement Redis for frequently accessed data
3. **Load Balancing**: Use multiple instances behind a load balancer
4. **CDN**: Serve static assets via CDN

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the test suite for examples

## License

MIT License - see LICENSE file for details.
