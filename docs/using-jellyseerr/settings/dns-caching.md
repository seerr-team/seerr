---
title: DNS Caching
description: Configure DNS caching settings.
sidebar_position: 7
---

# DNS Caching

Jellyseerr uses DNS caching to improve performance and reduce the number of DNS lookups required for external API calls. This can help speed up response times and reduce load on DNS servers, when something like a Pi-hole is used as a DNS resolver.

## Configuration

You can enable the DNS caching settings in the Network tab of the Jellyseerr settings. The default values follow the standard DNS caching behavior.

- **Force Minimum TTL**: Set a minimum time-to-live (TTL) in seconds for DNS cache entries. This ensures that frequently accessed DNS records are cached for a longer period, reducing the need for repeated lookups. Default is 0.
- **Force Maximum TTL**: Set a maximum time-to-live (TTL) in seconds for DNS cache entries. This prevents infrequently accessed DNS records from being cached indefinitely, allowing for more up-to-date information to be retrieved. Default is -1 (unlimited).
