---
title: Services
description: Configure your default services.
sidebar_position: 4
---

# Services

:::info
**If you keep separate copies of non-4K and 4K movies/series in your media libraries, you will need to set up multiple Radarr/Sonarr instances and link each of them to Seerr.**

Seerr checks these linked servers to determine whether or not media has already been requested or is available, so two servers of each type are required _if you keep separate non-4K and 4K copies of movies/series._

**If you only maintain one copy of media, you can instead simply set up one server and set the "Quality Profile" setting on a per-request basis.**

Lidarr does not use Seerr's 4K split workflow. Configure one or more Lidarr servers based on your music library setup.
:::

### Radarr/Sonarr/Lidarr Settings

:::warning
**Only v3 & V4 Radarr/Sonarr servers are supported!** If your Radarr/Sonarr server is still running v2, you will need to upgrade in order to add it to Seerr.
:::

#### Default Server

At least one server needs to be marked as "Default" in order for requests to be sent successfully to Radarr/Sonarr/Lidarr.

If you have separate 4K Radarr/Sonarr servers, you need to designate default 4K servers _in addition to_ default non-4K servers.

#### 4K Server

Only select this option if you have separate non-4K and 4K servers. If you only have a single Radarr/Sonarr server, do _not_ check this box.

This option is only applicable to Radarr/Sonarr.

#### Server Name

Enter a friendly name for the Radarr/Sonarr/Lidarr server.

#### Hostname or IP Address

If you have Seerr installed on the same network as Radarr/Sonarr/Lidarr, you can set this to the local IP address of your server. Otherwise, this should be set to a valid hostname (e.g., `radarr.myawesomeserver.com`).

#### Port

This value should be set to the port that your Radarr/Sonarr/Lidarr server listens on. By default, Radarr uses port `7878`, Sonarr uses port `8989`, and Lidarr uses port `8686`, but you may need to set this to `443` or some other value if your server is hosted on a VPS or cloud provider.

#### Use SSL

Enable this setting to connect to Radarr/Sonarr/Lidarr via HTTPS rather than HTTP. Self-signed certificates are not trusted by default, but you can configure Seerr to accept them. See [Self-Signed Certificates](/using-seerr/advanced/self-signed-certificates) for details.

#### API Key

Enter your Radarr/Sonarr/Lidarr API key here. Do _not_ share these keys publicly, as they can be used to gain administrator access to your servers.

You can locate the required API keys in Radarr/Sonarr/Lidarr in **Settings &rarr; General &rarr; Security**.

#### URL Base

If you have configured a URL base for your Radarr/Sonarr/Lidarr server, you _must_ enter it here in order for Seerr to connect to those services.

You can verify whether or not you have a URL base configured in your Radarr/Sonarr/Lidarr server at **Settings &rarr; General &rarr; Host**. (Note that a restart of your server is required if you modify this setting.)

#### Profiles and Root Folder

Select the default settings you would like to use for all new requests.

For Radarr/Sonarr, ensure the required quality profile and root folder are set.

For Lidarr, ensure quality profile, metadata profile, and root folder are set.

#### External URL (optional)

If the hostname or IP address you configured above is not accessible outside your network, you can set a different URL here. This "external" URL is used to add clickable links to your Radarr/Sonarr/Lidarr servers on media detail pages.

#### Enable Scan (optional)

Enable this setting if you would like to scan your Radarr/Sonarr/Lidarr server for existing media/request status. It is recommended that you enable this setting, so that users cannot submit requests for media which has already been requested or is already available.

#### Enable Automatic Search (optional)

Enable this setting to have Radarr/Sonarr/Lidarr automatically search for media upon approval of a request.
