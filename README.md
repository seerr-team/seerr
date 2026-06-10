# Seerr Gelato Fork

> A Seerr fork that replaces Radarr/Sonarr with [Gelato](https://github.com/lostb1t/Gelato) — on-demand virtual media items in Jellyfin.

When a media request is approved, instead of dispatching to Radarr or Sonarr for downloading, this fork triggers Gelato (a Jellyfin plugin) to add the content directly as a virtual item in your Jellyfin library.

## How It Differs from Upstream Seerr

| Upstream Seerr | This Fork |
|---|---|
| Approving a request → sends to Radarr/Sonarr to download | Approving a request → triggers Gelato to add a virtual item in Jellyfin |
| Content stored on disk | Content streamed on-demand via Stremio |

Everything else — the request workflow, admin approval, permissions, notifications, Jellyfin integration — remains identical to upstream Seerr.

## How It Works

```
User requests media in Seerr
        ↓
Admin approves (or auto-approve)
        ↓
Seerr calls Jellyfin /Items?searchTerm=<imdbId>  ← Gelato SearchActionFilter caches metadata
        ↓
Seerr calls Jellyfin /Items/<guid>                ← Gelato InsertActionFilter creates virtual item
        ↓
Content appears in Jellyfin library, ready to stream
```

Gelato decorates Jellyfin's standard `/Items` API. No custom endpoints needed — the integration uses Jellyfin's native search and item retrieval, which Gelato intercepts via ASP.NET action filters.

## Prerequisites

- [Jellyfin](https://jellyfin.org) media server
- [Gelato plugin](https://github.com/lostb1t/Gelato) installed in Jellyfin
- Gelato configured with at least one movie and series library folder
- Stremio addons configured in Gelato (for content sources)

No Radarr, Sonarr, or download clients required.

## Quick Start

### Docker

```bash
docker run -d \
  --name seerr-gelato \
  -p 5055:5055 \
  -v /path/to/config:/app/config \
  irunmole/seerr-gelato:latest
```

### Setup

1. Open `http://localhost:5055`
2. Create an admin account
3. Go to Settings → Jellyfin → enter your Jellyfin URL and API key
4. Sync your Jellyfin libraries
5. You're ready — requests will now flow through Gelato

## Current Features

- Full Jellyfin integration with authentication, user import, and management
- Gelato-powered request fulfillment — no *arr stack needed
- Support for **PostgreSQL** and **SQLite** databases
- Supports movies, shows, and mixed libraries
- Jellyfin library scan to track available titles
- Customizable request system with individual season or movie requests
- Admin approval workflow with auto-approve option
- Granular permission system
- Various notification agents (Discord, Email, Slack, Telegram, Webhook, etc.)
- Mobile-friendly design
- Watchlist and blocklist support

## Docker Images

Pre-built multi-arch images (amd64, arm64) published on Docker Hub:

```
docker pull irunmole/seerr-gelato:latest
```

Built and pushed automatically on every push to the `gelato-integration` branch.

## Upstream

This is a fork of [Seerr](https://github.com/seerr-team/seerr). See the upstream repo for full documentation and contribution guides.
