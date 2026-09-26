---
title: Overview
description: Learn about Seerr's Plex integration features
sidebar_position: 1
---

# Plex Features Overview

Seerr provides integration features that connect with your Plex media server to automate media management tasks.

## Available Features

- [Watchlist Auto Request](./watchlist-auto-request) - Automatically request media from your Plex Watchlist
- [Recently Added Processing](#recently-added-processing) - Process newly added Plex media from external tools
- More features coming soon!

## Prerequisites

:::info Authentication Required
To use any Plex integration features, you must have logged into Seerr at least once with your Plex account.
:::

**Requirements:**
- Plex account with access to the configured Plex server
- Seerr configured with Plex as the media server
- User authentication via Plex login
- Appropriate user permissions for specific features

## Getting Started

1. Authenticate at least once using your Plex credentials
2. Verify you have the necessary permissions for desired features
3. Follow individual feature guides for setup instructions

:::note Server Configuration
Plex server configuration is handled by your administrator. If you cannot log in with your Plex account, contact your administrator to verify the server setup.
:::

## Recently Added Processing

Seerr can process a recently added Plex item from an external tool such as Tautulli. Configure the tool to send a `POST` request to:

```text
https://seerr.example.com/api/v1/plex/recently-added
```

Include your Seerr API key as an HTTP header:

```text
X-Api-Key: YOUR_SEERR_API_KEY
```

The webhook body must be JSON and include the Plex rating key:

```json
{
  "ratingKey": "12345"
}
```

For Tautulli recently added notifications, configure a webhook notification using this custom JSON body:

```json
{
  "ratingKey": "{rating_key}"
}
```
