---
title: General
description: Configure global and default settings for Jellyseerr.
sidebar_position: 1
---

# General

## API Key

This is your Jellyseerr API key, which can be used to integrate Jellyseerr with third-party applications. Do **not** share this key publicly, as it can be used to gain administrator access!

If you need to generate a new API key for any reason, simply click the button to the right of the text box.

If you want to set the API key, rather than letting it be randomly generated, you can use the API_KEY environment variable. Whatever that variable is set to will be your API key.

## Application Title

If you aren't a huge fan of the name "Jellyseerr" and would like to display something different to your users, you can customize the application title!

## Application URL

Set this to the externally-accessible URL of your Jellyseerr instance.

You must configure this setting in order to enable password reset and generation emails.

## Enable Proxy Support

If you have Jellyseerr behind a reverse proxy, enable this setting to allow Jellyseerr to correctly register client IP addresses. For details, please see the [Express Documentation](https://expressjs.com/en/guide/behind-proxies.html).

This setting is **disabled** by default.

## Enable CSRF Protection

:::warning
**This is an advanced setting.** Please only enable this setting if you are familiar with CSRF protection and how it works.
:::

CSRF stands for [cross-site request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery). When this setting is enabled, all external API access that alters Jellyseerr application data is blocked.

If you do not use Jellyseerr integrations with third-party applications to add/modify/delete requests or users, you can consider enabling this setting to protect against malicious attacks.

One caveat, however, is that HTTPS is required, meaning that once this setting is enabled, you will no longer be able to access your Jellyseerr instance over _HTTP_ (including using an IP address and port number).

If you enable this setting and find yourself unable to access Jellyseerr, you can disable the setting by modifying `settings.json` in `/app/config`.

This setting is **disabled** by default.

## Enable Image Caching

When enabled, Jellseerr will proxy and cache images from pre-configured sources (such as TMDB). This can use a significant amount of disk space.

Images are saved in the `config/cache/images` and stale images are cleared out every 24 hours.

You should enable this if you are having issues with loading images directly from TMDB in your browser.

## Display Language

Set the default display language for Jellyseerr. Users can override this setting in their user settings.

## Discover Region, Discover Language & Streaming Region

These settings filter content shown on the "Discover" home page based on regional availability and original language, respectively. The Streaming Region filters the available streaming providers on the media page. Users can override these global settings by configuring these same options in their user settings.

## Blacklist Region and Blacklist Language

These settings control the region and language used specifically for blacklist content scanning. The "Process Blacklisted Tags" job uses these settings to determine which content to scan for blacklisting, independent of the general discover settings.

- **Blacklist Region**: The region used for blacklist content scanning. Leave empty to scan all regions.
- **Blacklist Language**: The language used for blacklist content scanning. Leave empty to scan all languages.

These settings are separate from the general "Discover Region" and "Discover Language" settings, allowing you to blacklist content from specific regions/languages regardless of what users see in their discover pages.

## Blacklist Content with Tags and Limit Content Blacklisted per Tag

These settings blacklist any TV shows or movies that have one of the entered tags. The "Process Blacklisted Tags" job adds entries to the blacklist based on the configured blacklisted tags. If a blacklisted tag is removed, any media blacklisted under that tag will be removed from the blacklist when the "Process Blacklisted Tags" job runs.

The limit setting determines how many pages per tag the job will process, with each page containing 20 entries. The job cycles through all 16 available discovery sort options, querying the defined number of pages to blacklist media that is most likely to appear at the top of each sort. Higher limits will create a more accurate blacklist, but will require more storage.

Blacklisted tags are disabled until at least one tag is entered. These settings cannot be overridden in user settings.

## Hide Available Media

When enabled, media which is already available will not appear on the "Discover" home page, or in the "Recommended" or "Similar" categories or other links on media detail pages.

Available media will still appear in search results, however, so it is possible to locate and view hidden items by searching for them by title.

This setting is **disabled** by default.

## Hide Blacklisted Items

When enabled, media that has been blacklisted will not appear on the "Discover" home page, for all administrators. This can be useful to hide content that you don't want to see, such as content with specific tags or content that has been manually blacklisted when you have the "Manage Blacklist" permission.

This setting is **disabled** by default.

## Allow Partial Series Requests

When enabled, users will be able to submit requests for specific seasons of TV series. If disabled, users will only be able to submit requests for all unavailable seasons.

This setting is **enabled** by default.
