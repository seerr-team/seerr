---
title: Metadata Providers
description: Configure the metadata providers Seerr uses for TV and anime.
sidebar_position: 8
---

# Metadata Providers

Seerr fetches descriptive metadata (titles, descriptions, posters, release dates,
external IDs, etc.) from a number of third-party providers. The
**Settings → Metadata Providers** page lets administrators pick which provider
is used for each media type.

A **Test** button at the top and bottom of the page exercises every configured
provider and updates the two status badges (`TheMovieDB`, `TheTVDB`). Each badge shows one of:

- **Operational** — the test request succeeded.
- **Not tested** — no test has been run yet in this session.
- **Failed** — the test request errored; a toast describes which provider(s)
  failed so the issue can be resolved without scrolling back up.

## Metadata Provider Selection

This section controls which provider is used for which media type.


### Series Metadata Provider

Choose between **TheMovieDB** and **TheTVDB** as the source of metadata for TV
series. TheMovieDB is the default and matches the source used for movies, which
keeps IDs and artwork consistent across the UI.


### Anime Metadata Provider

Choose between **TheMovieDB** and **TheTVDB** for anime entries.


## Saving and Testing

The **Save** buttons persist changes to `config/settings.json`. The **Test**
buttons make one request per provider:

*TMDB / TVDB are tested only when selected as the active provider for one of
the media types.*

If any test fails, an error is shown for that provider and its status badge is
updated.
