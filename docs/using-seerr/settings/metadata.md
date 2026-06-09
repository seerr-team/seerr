---
title: Metadata Providers
description: Configure the metadata providers Seerr uses for TV, anime, and music.
sidebar_position: 8
---

# Metadata Providers

Seerr fetches descriptive metadata (titles, descriptions, posters, release dates,
external IDs, etc.) from a number of third-party providers. The
**Settings → Metadata Providers** page lets administrators pick which provider
is used for each media type and configure the connection details for the
music-specific providers.

A **Test** button at the top and bottom of the page exercises every configured
provider and updates the three status badges (`TheMovieDB`, `TheTVDB`,
`ListenBrainz`). Each badge shows one of:

- **Operational** — the test request succeeded.
- **Not tested** — no test has been run yet in this session.
- **Failed** — the test request errored; a toast describes which provider(s)
  failed so the issue can be resolved without scrolling back up.

## Metadata Provider Selection

This section controls which provider is used for non-music media.

### Series Metadata Provider

Choose between **TheMovieDB** and **TheTVDB** as the source of metadata for TV
series. TheMovieDB is the default and matches the source used for movies, which
keeps IDs and artwork consistent across the UI. TheTVDB tends to have richer
episode-level data for long-running shows.

### Anime Metadata Provider

Choose between **TheMovieDB** and **TheTVDB** for anime entries. Many users
prefer **TheTVDB** here because its anime catalogue is typically more complete
and uses release-aligned numbering.

Selection changes are persisted with the **Save** button at the bottom of the
page.

## Metadata Provider Configuration

This section configures the music metadata providers. The provider is public
and can be used anonymously; a token is only required for authenticated or
rate-limited endpoints.

### ListenBrainz

[ListenBrainz](https://listenbrainz.org) is used for community-driven data such
as fresh releases, sitewide popularity charts, and detailed
album/artist pages. The service exposes two distinct hosts — a public REST API
for data and a web frontend for browser-facing pages — so both are
configurable independently.

| Field                     | Default                        | Description                                                                                                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API base URL**          | `https://api.listenbrainz.org` | The base URL of the ListenBrainz REST API. All JSON data — album/artist metadata lookups, `/stats/sitewide/...`, `/explore/fresh-releases`, etc. — is fetched from here. You can pass either a host-only URL or one that already includes the API version (`/1`); Seerr appends `/1` automatically when it is missing. |
| **Web base URL**          | `https://listenbrainz.org`     | The base URL of the ListenBrainz website. Used only for building outbound links to album (`/album/<mbid>`) and artist (`/artist/<mbid>`) pages shown in the UI. No JSON endpoints are called against this host. Trailing slashes are stripped automatically.                                                            |
| **User token (optional)** | _empty_                        | A ListenBrainz user token. Only needed for authenticated endpoints; the discovery features Seerr uses today work fine without one.                                                                                                                                                                                       |

#### Self-hosted mirrors

ListenBrainz can be pointed at a self-hosted mirror by replacing the
**API base URL** / **Web base URL** values with your mirror's hostname.
The same normalization rules apply (the `/<digits>` suffix is optional).

## Saving and Testing

The **Save** buttons persist changes to `config/settings.json`. The **Test**
buttons make one request per provider:

- TMDB / TVDB are tested only when selected as the active provider for one of
  the media types.
- ListenBrainz is tested with a single-day `fresh-releases` request.

If any test fails, a toast is shown for that provider and its status badge is
updated; the other providers' results are independent.
