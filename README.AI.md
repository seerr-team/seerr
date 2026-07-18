# AI Recommendations Development Setup

This guide covers setting up the AI recommendations feature in a development environment.

## Quick Start

### 1. Start Development Environment

```bash
# Start Seerr with Ollama for local LLM testing
docker compose -f compose.ai.yaml -f compose.yaml up -d

# Or use with PostgreSQL for production-like testing
docker compose -f compose.ai.yaml -f compose.postgres.yaml -f compose.yaml up -d

# To use a cloud AI provider instead, edit compose.ai.yaml and comment out ollama service
```

### 2. Configure AI Provider

1. Open http://localhost:3000
2. Go to Settings → AI Settings
3. Configure your AI provider:

#### Option A: OpenAI (Requires API Key)
- **Provider Type**: OpenAI
- **Base URL**: `https://api.openai.com/v1`
- **Model**: `gpt-4o-mini`
- **API Key**: Your OpenAI API key

#### Option B: Ollama (Free, Local)
- **Provider Type**: Ollama
- **Base URL**: `http://ollama:11434/v1`
- **Model**: `mistral` (pull first: `docker compose exec ollama ollama pull mistral`)
- **API Key**: Leave empty

#### Option C: OpenRouter (Multi-provider)
- **Provider Type**: OpenRouter
- **Base URL**: `https://openrouter.ai/api/v1`
- **Model**: `meta-llama/llama-3-8b-instruct:free`
- **API Key**: Your OpenRouter API key

### 3. Test Connection

Click "Test Connection" to verify your AI provider is working.

### 4. Enable Features

- **Enable AI Features**: Toggle on
- **Enable Recommendations**: Toggle on (adds slider to Discover page)
- **Enable AI Search**: Toggle on (optional)

### 5. Manual Testing

#### Test Recommendations:
1. Go to Discover page
2. Look for "Recommended for You" slider
3. Click "Regenerate" button in AI Settings to force refresh

#### Test AI Search:
1. Go to Search page
2. Try natural language queries:
   - "90s psychological thrillers with twist endings"
   - "Feel-good anime with strong friendships"
   - "Dark sci-fi like Blade Runner"

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  ┌──────────────────┐      ┌─────────────────────┐     │
│  │ Discover Page     │      │ Settings AI         │     │
│  │ - AI Slider       │      │ - Provider Config    │     │
│  │ - Search Page     │      │ - Feature Toggles    │     │
│  └──────────────────┘      └─────────────────────┘     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (Express)                       │
│  ┌──────────────────┐      ┌─────────────────────┐     │
│  │ /api/v1/discover │      │ /api/v1/ai           │     │
│  │ - ai-recommend   │      │ - settings           │     │
│  │                  │      │ - search              │     │
│  │                  │      │ - feedback            │     │
│  └──────────────────┘      └─────────────────────┘     │
│                          │                             │
│                          ▼                             │
│  ┌───────────────────────────────────────────────┐    │
│  │          AI Recommendation Engine              │    │
│  │  - Taste Profile Generation                   │    │
│  │  - Recommendation Generation                  │    │
│  │  - Search Query Interpretation               │    │
│  │  - TMDb Integration                            │    │
│  └───────────────────────────────────────────────┘    │
│                          │                             │
│                          ▼                             │
│  ┌───────────────────────────────────────────────┐    │
│  │              LLM Client                        │    │
│  │  - OpenAI-compatible interface                │    │
│  │  - Multi-provider support                      │    │
│  │  - Structured output validation                │    │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Recommendation Generation:
```
User Request History + Watchlist + Library
    ↓
Score & Sample (top 40 items)
    ↓
Fetch TMDb Metadata
    ↓
LLM: Generate Taste Profile (keywords, genres, themes)
    ↓
LLM: Generate Recommendations (with rationales)
    ↓
Merge with TMDb Keyword Discovery
    ↓
Filter: Remove watched/requested/disliked
    ↓
Store in Database (ai_recommendations table)
    ↓
Return to Frontend
```

### AI Search:
```
Natural Language Query
    ↓
LLM: Interpret Query (→ TMDb filters + specific titles)
    ↓
Parallel Search:
  - TMDb Discover (with filters)
  - TMDb Search (specific titles)
    ↓
Merge Results
    ↓
Add AI Rationales (optional)
    ↓
Filter Existing Content
    ↓
Return to Frontend
```

## Database Schema

### ai_recommendation
- `id`: Primary key
- `userId`: User ID (NULL = global recommendations)
- `tmdbId`: TMDb ID
- `mediaType`: 'movie' | 'tv'
- `tvdbId`: TVDB ID (optional)
- `score`: AI confidence score (0-1)
- `rationale`: "Why you might like this"
- `metadata`: JSON (source, keywords, model, timestamps)
- `createdAt`/`updatedAt`: Timestamps

### user_feedback
- `id`: Primary key
- `userId`: User ID
- `tmdbId`: TMDb ID
- `mediaType`: 'movie' | 'tv'
- `feedbackType`: 'like' | 'dislike' | 'seen'
- `createdAt`: Timestamp

## API Endpoints

### Discover
- `GET /api/v1/discover/ai-recommendations` - Get personalized recommendations

### AI Settings
- `GET /api/v1/ai/settings` - Get AI settings
- `PUT /api/v1/ai/settings` - Update AI settings
- `POST /api/v1/ai/test` - Test AI provider connection

### AI Search
- `POST /api/v1/ai/search` - Natural language search

### Feedback
- `POST /api/v1/ai/feedback` - Submit user feedback
- `GET /api/v1/ai/feedback/stats` - Get feedback statistics
- `DELETE /api/v1/ai/feedback/:tmdbId` - Delete feedback

### Management
- `POST /api/v1/ai/regenerate` - Manually trigger regeneration

## Scheduled Jobs

### AI Recommendations Sync
- **Schedule**: Every 6 hours (`0 */6 * * *`)
- **Function**: Generates recommendations for all active users
- **Status**: Can be enabled/disabled in Settings

## Troubleshooting

### No recommendations appearing
1. Check AI provider is configured correctly
2. Verify test connection succeeds
3. Ensure recommendations are enabled in settings
4. Check logs: `docker-compose -f docker-compose.dev.yml logs -f seerr`

### "AI recommendations disabled" message
- Enable AI features in Settings → AI Settings
- Enable recommendations specifically

### Ollama connection fails
- Ensure Ollama container is running: `docker compose -f compose.ai.yaml -f compose.yaml ps`
- Pull model: `docker compose -f compose.ai.yaml -f compose.yaml exec ollama ollama pull mistral`
- Check connection: `curl http://localhost:11434/api/tags`

### OpenAI rate limits
- Reduce `maxResults` in settings
- Increase job interval (Settings → Jobs & Cache)
- Consider using Ollama (free, unlimited)

## Testing Checklist

### Manual Testing Steps:
- [ ] Configure AI provider successfully
- [ ] Test connection passes
- [ ] Enable AI recommendations
- [ ] AI slider appears on Discover page
- [ ] Click AI recommendations slider → results load
- [ ] Enable AI search
- [ ] Try natural language search → relevant results
- [ ] Submit feedback (like/dislike)
- [ ] Regenerate recommendations → new results appear
- [ ] Check job schedule in Settings → Jobs & Cache

### Performance Validation:
- [ ] Taste profile generation < 10 seconds
- [ ] Recommendation generation < 15 seconds
- [ ] AI search response < 8 seconds
- [ ] Database queries are optimized
- [ ] No memory leaks over multiple runs

## Cost Estimation

### OpenAI (gpt-4o-mini)
- Per user per cycle: ~$0.0004
- 10 users, 4x/day: ~$0.48/month
- 100 users, 4x/day: ~$4.80/month

### Ollama (Local)
- **Cost**: Free
- **Hardware**: 8GB VRAM GPU recommended
- **Models**: 4-8GB disk space per model

### Recommendations
- **Development**: Use Ollama (free)
- **Small deployments** (<100 users): OpenAI gpt-4o-mini
- **Large deployments** (100+ users): Ollama or monitor OpenAI costs

## Next Steps

1. **Start Dev Container**: `docker-compose -f docker-compose.dev.yml up -d`
2. **Configure AI Provider**: Settings → AI Settings
3. **Test Features**: Try recommendations and search
4. **Provide Feedback**: Report issues or suggestions
