# Mahoot - Time-Controlled Social Media Feed Generator

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

Mahoot is a BlueSky feed generator that implements client-side curation protocols to help users manage their social media consumption. It provides time-controlled social media experiences with fair followee exposure through "Mahoot Numbers."

## 🌟 Features

- **⏰ Daily Post Limits**: Set custom daily consumption limits (1-1000 posts)
- **🎯 Mahoot Numbers**: Guaranteed minimum posts per followee per day
- **📈 Followee Amplification**: Amp up important voices or amp down prolific posters
- **🎲 Random Subset Selection**: Prevents over-posting accounts from dominating feeds
- **⚙️ User Preferences**: Customizable settings with persistence
- **📊 Statistics & Insights**: Comprehensive usage analytics
- **🔍 Rich Metadata**: Enhanced feed information for client applications

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Yarn package manager
- BlueSky account

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/mahoot-feed-generator.git
   cd mahoot-feed-generator
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your BlueSky credentials and DID
   ```

4. **Build and start**:
   ```bash
   yarn build
   yarn start
   ```

5. **Publish to BlueSky**:
   ```bash
   yarn publishFeed
   ```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests
yarn test

# Run validation tests only
yarn test:validation

# Run integration tests only
yarn test:integration
```

## 🐳 Docker Deployment

### Quick Start with Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build and run manually
docker build -t mahoot-feed-generator .
docker run -d -p 3000:3000 --env-file .env mahoot-feed-generator
```

## 📖 How It Works

### Core Concepts

1. **Mahoot Numbers**: Each followee gets a guaranteed minimum number of posts per day
2. **Daily Limits**: Users set a maximum number of posts they want to consume daily
3. **Amplification**: Users can "amp up" important voices or "amp down" prolific posters
4. **Random Selection**: For over-posting accounts, posts are randomly selected to prevent domination

### Algorithm Flow

1. **User Authentication**: JWT-based authentication for personalized feeds
2. **Preference Loading**: Load user's daily limits and Mahoot numbers
3. **Followee Processing**: Process each followee based on their Mahoot number
4. **Post Selection**: Randomly select posts from over-posting accounts
5. **Limit Enforcement**: Ensure daily limits are respected
6. **Statistics Tracking**: Record viewing patterns for insights

### Database Schema

- **posts**: Indexed posts from the firehose
- **user_preferences**: User settings and limits
- **followee_relationships**: Custom Mahoot numbers per followee
- **post_statistics**: Post viewing history
- **daily_stats**: Daily usage statistics

## 🔧 Configuration

### Environment Variables

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
```

### API Endpoints

#### Feed Generation
- `GET /xrpc/app.bsky.feed.getFeedSkeleton` - Generate Mahoot feed
- `GET /xrpc/app.bsky.feed.describeFeedGenerator` - Feed metadata

#### User Preferences
- `GET /xrpc/com.mahoot.getPreferences` - Get user preferences
- `POST /xrpc/com.mahoot.putPreferences` - Update preferences
- `GET /xrpc/com.mahoot.getFeedConfig` - Get feed configuration

#### Followee Management
- `GET /xrpc/com.mahoot.getFollowees` - Get followee list
- `POST /xrpc/com.mahoot.updateFollowee` - Update followee Mahoot number
- `POST /xrpc/com.mahoot.removeFollowee` - Remove followee

#### Statistics
- `GET /xrpc/com.mahoot.getStats` - Get user statistics

## 📊 Usage Examples

### Setting Daily Limits

```bash
curl -X POST http://localhost:3000/xrpc/com.mahoot.putPreferences \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"daily_post_limit": 50}'
```

### Amplifying a Followee

```bash
curl -X POST http://localhost:3000/xrpc/com.mahoot.updateFollowee \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"followee_did": "did:plc:example", "mahoot_number": 10}'
```

### Getting Statistics

```bash
curl -X GET http://localhost:3000/xrpc/com.mahoot.getStats \
  -H "Authorization: Bearer YOUR_JWT"
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   BlueSky API   │    │  Firehose Feed  │    │   SQLite DB     │
│                 │    │                 │    │                 │
│ • Authentication│◄──►│ • Real-time     │◄──►│ • Posts         │
│ • Feed Requests │    │   indexing      │    │ • User Prefs    │
│ • Publishing    │    │ • Follow events │    │ • Statistics    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mahoot Feed Generator                        │
│                                                                 │
│ • User Authentication & Preferences                            │
│ • Mahoot Number Calculations                                   │
│ • Feed Generation Algorithm                                    │
│ • Statistics & Analytics                                       │
│ • API Endpoints                                                │
└─────────────────────────────────────────────────────────────────┘
```

## 🔍 Monitoring

### Health Checks

- `GET /health` - Basic health check
- `GET /ready` - Readiness check (database connectivity)

### Key Metrics

- Feed generation latency
- Database query performance
- User engagement rates
- Daily post consumption patterns

## 🛠️ Development

### Project Structure

```
src/
├── algos/           # Feed generation algorithms
├── auth.ts          # Authentication utilities
├── config.ts        # Configuration management
├── db/              # Database schema and migrations
├── index.ts         # Application entry point
├── lexicon/         # AT Protocol type definitions
├── methods/         # XRPC method handlers
├── server.ts        # Express server setup
├── statistics.ts    # Analytics and statistics
├── subscription.ts  # Firehose subscription
└── user-management.ts # User preference management
```

### Adding New Features

1. **Database Changes**: Add migrations in `src/db/migrations.ts`
2. **New Algorithms**: Create files in `src/algos/`
3. **API Endpoints**: Add methods in `src/methods/`
4. **Statistics**: Extend `src/statistics.ts`

## 🚀 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy Options

- **Railway**: Connect repository, set env vars, deploy
- **Render**: Create web service, connect repo, deploy
- **DigitalOcean**: App platform with automatic deployments

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the [AT Protocol](https://atproto.com/)
- Inspired by the original [Mahoot concept](Mahoot-Readme.txt)
- Uses the BlueSky feed generator starter kit as foundation

## 📞 Support

- Create an issue on GitHub
- Check the [deployment guide](DEPLOYMENT.md)
- Review the test suite for examples

---

**Mahoot** - Take control of your social media time! ⏰✨
