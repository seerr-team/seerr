---
title: "Seerr v3.1.0: Critical Security Release"
description: "Seerr v3.1.0 addresses three CVEs, including a high-priority vulnerability affecting Plex-configured instances. Upgrade immediately."
slug: seerr-3-1-0-security-release
authors: [seerr-team]
image: https://raw.githubusercontent.com/seerr-team/seerr/refs/heads/develop/gen-docs/static/img/logo_full.svg
hide_table_of_contents: false
---

We are releasing **Seerr v3.1.0**, a security-focused update that addresses three CVEs, including a high-priority vulnerability affecting instances configured with Plex Media Server. **We strongly recommend upgrading as soon as possible.**

This release also includes a number of bug fixes and marks the end of our post-merger feature freeze. New features will be resuming in future updates.

<!--truncate-->

## Security Vulnerabilities

This release patches three newly identified CVEs. If you are running a Plex-configured instance of Seerr, **one of these vulnerabilities is high priority and poses a significant risk**, please upgrade immediately.

### [CVE-2026-27707](https://github.com/seerr-team/seerr/security/advisories/GHSA-rc4w-7m3r-c2f7) — Unauthenticated Account Registration via Jellyfin Endpoint (High)

On instances configured to use Plex as the media server, an unauthenticated attacker could register an account by abusing the Jellyfin authentication endpoint. This could allow unauthorized users to gain access to your Seerr instance without valid Plex credentials.

### [CVE-2026-27793](https://github.com/seerr-team/seerr/security/advisories/GHSA-f7xw-jcqr-57hp) — Broken Object-Level Authorization in User Profile Endpoint (Medium)

A broken object-level authorization vulnerability in the user profile endpoint could allow an authenticated user to access another user's profile data, including third-party notification credentials such as webhook URLs, Telegram tokens, and similar sensitive configuration.

### [CVE-2026-27792](https://github.com/seerr-team/seerr/security/advisories/GHSA-gx3h-3jg5-q65f) — Missing Authentication on Push Subscription Endpoints (Medium)

The push subscription endpoints lacked proper authentication checks, allowing unauthenticated requests to interact with subscription management functionality.

---

Please review the full security advisories linked above for technical details, impact assessment, and mitigation steps.

## Bug Fixes

Alongside the security patches, this release ships a number of bug fixes:

- ***(helm)*** Add `"v"` as prefix for `appVersion` tag
- ***(jellyfin-scanner)*** Include unmatched seasons in processable seasons
- ***(link-account)*** Fix error-message override
- ***(plex-scanner)*** Add TVDb to TMDB fallback in Plex scanner
- ***(radarr)*** Trigger search for existing monitored movies without files
- ***(servarr)*** Increase default API timeout from 5000ms to 10000ms
- ***(sonarr)*** Use configured metadata provider for season filtering
- ***(watch-data)*** Use sentinel values to avoid invalid SQL syntax
- ***(watchlist-sync)*** Correct permission typo for TV auto requests
- Preserve blocklist on media deletion & optimise watchlist-sync

## New Contributors

Many thanks to those making their first contribution to Seerr in this release:

* [@caillou](https://github.com/caillou)
* [@Kenshin9977](https://github.com/Kenshin9977)
* [@MagicLegend](https://github.com/MagicLegend)
* [@wiiaam](https://github.com/wiiaam)
* [@mjonkus](https://github.com/mjonkus)
* [@nova-api](https://github.com/nova-api)
* [@mreid-tt](https://github.com/mreid-tt)
* [@DataBitz](https://github.com/DataBitz)
* [@Hyperion2220](https://github.com/Hyperion2220)
* [@blassley](https://github.com/blassley)
* [@JanKleine](https://github.com/JanKleine)
* [@koiralasandesh](https://github.com/koiralasandesh)

## What's Next

Now that the post-merger feature freeze has ended, the team is resuming active feature development. Stay tuned to our blog for upcoming releases and in-depth looks at what we're building next.

In the meantime, please upgrade to **v3.1.0** right away, especially if you are using a Plex Media Server configuration. See our [migration guide](https://docs.seerr.dev/migration-guide) if you need help upgrading from Overseerr/Jellyseerr.