---
title: Artwork Providers
description: Configure the artwork providers Seerr uses for music artists.
sidebar_position: 8
---

# Artwork Providers

Seerr fetches artist artwork from a third-party provider. The
**Settings → Metadata Providers** page exposes an **Artwork Providers
Configuration** section where administrators can tune the connection details
for each provider.

A **Test** button at the top and bottom of the page exercises every configured
artwork provider and updates the status badge (`TheAudioDB`). The badge shows
one of:

- **Operational** — the test request succeeded.
- **Not tested** — no test has been run yet in this session.
- **Failed** — the test request errored; a toast describes which provider
  failed so the issue can be fixed without scrolling back up.

## TheAudioDB

[TheAudioDB](https://www.theaudiodb.com) provides artist images (thumbnail and
background) keyed by MusicBrainz artist MBID. The public API requires a key,
and TheAudioDB publishes a free test key (`195003`) suitable for low-volume
use. Patrons of the project receive a personal key with higher limits.

:::warning
The default `195003` key is the **shared community test key** published by
TheAudioDB. It is rate-limited aggressively and may be revoked or throttled
without notice. For anything beyond casual personal use you should
[become a patron of TheAudioDB](https://www.patreon.com/theaudiodb) and
replace it with your own key.
:::

| Field                       | Default  | Description                                                                                                                                                                |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API key**                 | `195003` | Your TheAudioDB API key. Defaults to the public test key shared by the community; supply your own from [theaudiodb.com](https://www.theaudiodb.com) for production use and higher limits. |
| **Max requests per second** | `25`     | Outbound rate limit.                                                                                                                                                       |
| **Max concurrent requests** | `20`     | Cap on in-flight requests.                                                                                                                                                 |

Responses are cached for six hours.

## Saving and Testing

The **Save** button under "Artwork Providers Configuration" persists changes to
`config/settings.json`. The **Test** buttons at the top and bottom of the page
make a single request per provider:

- TheAudioDB is tested with a known artist MBID
  (`cc197bad-dc9c-440d-a5b5-d52ba2e14234` — Coldplay) using the currently
  configured API key.

If a test fails, a toast is shown for that provider and its status badge is
updated.
