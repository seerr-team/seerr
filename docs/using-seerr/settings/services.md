---
title: Services
description: Configure your default services.
sidebar_position: 4
---

# Services

:::info
**If you keep separate copies of non-4K and 4K content in your media libraries, you will need to set up multiple Radarr/Sonarr instances and link each of them to Seerr.**

Seerr checks these linked servers to determine whether or not media has already been requested or is available, so two servers of each type are required _if you keep separate non-4K and 4K copies of media._

**If you only maintain one copy of media, you can instead simply set up one server and set the "Quality Profile" setting on a per-request basis.**
:::

### Radarr/Sonarr Settings

:::warning
**Only v3 & V4 Radarr/Sonarr servers are supported!** If your Radarr/Sonarr server is still running v2, you will need to upgrade in order to add it to Seerr.
::::

#### Default Server

At least one server needs to be marked as "Default" in order for requests to be sent successfully to Radarr/Sonarr.

If you have separate 4K Radarr/Sonarr servers, you need to designate default 4K servers _in addition to_ default non-4K servers.

#### 4K Server

Only select this option if you have separate non-4K and 4K servers. If you only have a single Radarr/Sonarr server, do _not_ check this box!

#### Server Name

Enter a friendly name for the Radarr/Sonarr server.

#### Hostname or IP Address

If you have Seerr installed on the same network as Radarr/Sonarr, you can set this to the local IP address of your Radarr/Sonarr server. Otherwise, this should be set to a valid hostname (e.g., `radarr.myawesomeserver.com`).

#### Port

This value should be set to the port that your Radarr/Sonarr server listens on. By default, Radarr uses port `7878` and Sonarr uses port `8989`, but you may need to set this to `443` or some other value if your Radarr/Sonarr server is hosted on a VPS or cloud provider.

#### Use SSL

Enable this setting to connect to Radarr/Sonarr via HTTPS rather than HTTP. Note that self-signed certificates are _not_ supported.

#### API Key

Enter your Radarr/Sonarr API key here. Do _not_ share these key publicly, as they can be used to gain administrator access to your Radarr/Sonarr servers!

You can locate the required API keys in Radarr/Sonarr in **Settings &rarr; General &rarr; Security**.

#### URL Base

If you have configured a URL base for your Radarr/Sonarr server, you _must_ enter it here in order for Jellyeerr to connect to those services!

You can verify whether or not you have a URL base configured in your Radarr/Sonarr server at **Settings &rarr; General &rarr; Host**. (Note that a restart of your Radarr/Sonarr server is required if you modify this setting!)

#### Profiles, Root Folder, Minimum Availability

Select the default settings you would like to use for all new requests. Note that all of these options are required, and that requests will fail if any of these are not configured!

#### External URL (optional)

If the hostname or IP address you configured above is not accessible outside your network, you can set a different URL here. This "external" URL is used to add clickable links to your Radarr/Sonarr servers on media detail pages.

#### Enable Scan (optional)

Enable this setting if you would like to scan your Radarr/Sonarr server for existing media/request status. It is recommended that you enable this setting, so that users cannot submit requests for media which has already been requested or is already available.

#### Enable Automatic Search (optional)

Enable this setting to have Radarr/Sonarr to automatically search for media upon approval of a request.
