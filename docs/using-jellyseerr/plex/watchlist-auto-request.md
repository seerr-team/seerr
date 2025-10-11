---
title: Watchlist Auto Request
description: Learn how to use the Plex Watchlist Auto Request feature
sidebar_position: 1
---

# Watchlist Auto Request

The Plex Watchlist Auto Request feature allows Jellyseerr to automatically create requests for media items you add to your Plex Watchlist. Simply add content to your Plex Watchlist, and Jellyseerr will automatically request it for you.

:::info
This feature is only available for Plex users. Local users cannot use the Watchlist Auto Request feature.
:::

## Prerequisites

- You must have logged into Jellyseerr at least once with your Plex account
- Your administrator must have granted you the necessary permissions
- Your Plex account must have access to the Plex server configured in Jellyseerr

## Permission System

The Watchlist Auto Request feature uses a two-tier permission system:

### Administrator Permissions (Required)
Your administrator must grant you these permissions in your user profile:
- **Auto-Request** (master permission)
- **Auto-Request Movies** (for movie auto-requests)
- **Auto-Request Series** (for TV series auto-requests)

### User Activation (Required)
You must enable the feature in your own profile settings:
- **Auto-Request Movies** toggle
- **Auto-Request Series** toggle

:::warning Two-Step Process
Both administrator permissions AND user activation are required. Having permissions doesn't automatically enable the feature - you must also activate it in your profile.
:::

## How to Enable

### Step 1: Check Your Permissions
Contact your administrator to verify you have been granted:
- `Auto-Request` permission
- `Auto-Request Movies` and/or `Auto-Request Series` permissions

### Step 2: Activate the Feature
1. Go to your user profile settings
2. Navigate to the "General" section
3. Find the "Auto-Request" options
4. Enable the toggles for:
   - **Auto-Request Movies** - to automatically request movies from your watchlist
   - **Auto-Request Series** - to automatically request TV series from your watchlist

### Step 3: Start Using
- Add movies and TV shows to your Plex Watchlist
- Jellyseerr will automatically create requests for new items
- You'll receive notifications when items are auto-requested

## How It Works

Once properly configured, Jellyseerr will:

1. Periodically checks your Plex Watchlist for new items
2. Verify if the content already exists in your media libraries
3. Automatically submits requests for new items that aren't already available
4. Only requests content types you have permissions for
5. Notifiy you when auto-requests are created

:::info Content Limitations
Auto-request only works for standard quality content. 4K content must be requested manually if you have 4K permissions.
:::

## For Administrators

### Granting Permissions
1. Navigate to **Users** > **[Select User]** > **Permissions**
2. Enable the required permissions:
   - **Auto-Request** (master toggle)
   - **Auto-Request Movies** (for movie auto-requests)
   - **Auto-Request Series** (for TV series auto-requests)
3. Optionally enable **Auto-Approve** permissions for automatic approval

### Default Permissions
- Go to **Settings** > **Users** > **Default Permissions**
- Configure auto-request permissions for new users
- This sets the default permissions but users still need to activate the feature individually

## Limitations

- Local users cannot use this feature
- 4K content requires manual requests
- Users must have logged into Jellyseerr with their Plex account
- Respects user request limits and quotas
- Won't request content already in your libraries
