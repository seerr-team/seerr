---
title: Artwork Providers
description: Configure the artwork providers Seerr uses for music releases.
sidebar_position: 8
---

# Artwork Providers

Seerr fetches release artwork from a third-party provider. The
**Settings → Metadata Providers** page exposes an **Artwork Providers
Configuration** section where administrators can tune the connection details
for each provider.

A **Test** button at the top and bottom of the page exercises every configured
artwork provider and updates the status badge (`Cover Art Archive`). The badge
shows one of:

- **Operational** — the test request succeeded.
- **Not tested** — no test has been run yet in this session.
- **Failed** — the test request errored; a toast describes which provider
  failed so the issue can be fixed without scrolling back up.

## Cover Art Archive

The [Cover Art Archive](https://coverartarchive.org) is operated by the
MetaBrainz Foundation and serves cover artwork keyed by MusicBrainz release and
release-group MBIDs. The service is hosted exclusively at
`https://coverartarchive.org`; there are no self-hosted mirrors, so no base URL
is configurable.

| Field                       | Default | Description                                                                                                                                                          |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Max requests per second** | `50`    | Outbound rate limit. Cover Art Archive itself does not publish a hard limit; the default leaves plenty of headroom for normal browsing. Lower it if you are being throttled. |
| **Max concurrent requests** | `20`    | Cap on in-flight requests. Pair with the RPS limit to smooth bursts.                                                                                                 |

Responses are cached for six hours so repeat lookups for the same release group
do not hit the upstream.

## Saving and Testing

The **Save** button under "Artwork Providers Configuration" persists changes to
`config/settings.json`. The **Test** buttons at the top and bottom of the page
make a single request per provider:

- Cover Art Archive is tested with a known release-group MBID
  (`f5093c06-23e3-404f-aeaa-40f72885ee3a` — Pink Floyd, _The Dark Side of the
  Moon_).

If a test fails, a toast is shown for that provider and its status badge is
updated.
