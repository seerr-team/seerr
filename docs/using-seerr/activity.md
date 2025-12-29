# Dashboard

Seerr includes a **Dashboard** page (`/dashboard`) that shows:

- Media server status (Plex only)
- Now playing sessions (via Tautulli, if configured)
- Recent activity trends and popular titles (via Tautulli, if configured)
- Optional announcements and viewer feedback (configurable by admins)

## Requirements

- Seerr configured to use **Plex**
- A working **Tautulli** instance (optional but recommended)

Tautulli can be configured in **Settings → Plex → Tautulli Settings**.

## Enabling the feature

The Dashboard is disabled by default. Enable it in **Settings → Dashboard**.

## Optional banner image

You can set a custom hero banner image in **Settings → Dashboard**.

Supported values:

- A path under `public/` (example: `/activity-banner.jpg`)
- An `http(s)` URL

## Announcements

Admins can configure up to 3 announcements displayed near the top of the dashboard in **Settings → Dashboard**.

## Viewer feedback

If enabled, the dashboard includes a feedback form for users.

- Feedback can be reviewed by admins in **Settings → Dashboard**
- Feedback is stored in the config directory as `dashboard-feedback.json`
- Optionally, feedback can also be forwarded to an HTTP(S) webhook configured in **Settings → Dashboard**
