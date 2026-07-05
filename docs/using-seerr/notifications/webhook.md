---
title: Webhook
description: Configure webhook notifications.
sidebar_position: 4
---

# Webhook

The webhook notification agent enables you to send a custom JSON payload to any endpoint for specific notification events.

## Configuration

### Webhook URL

The URL you would like to post notifications to. Your JSON will be sent as the body of the request.

### Authorization Header (optional)

:::info
This is typically not needed. Please refer to your webhook provider's documentation for details.
:::

This value will be sent as an `Authorization` HTTP header.

### Custom Headers (optional)

You can add additional custom HTTP headers to be sent with each webhook request. This is useful for API keys, custom authentication schemes, or any other headers your webhook endpoint requires.

- Click "Add Header" to add a new header
- Enter the header name and value

:::warning
You cannot configure both the **Authorization Header** field and a custom `Authorization` header in Custom Headers at the same time. You must choose one method.
:::

### JSON Payload

Customize the JSON payload to suit your needs. The payload is a [Liquid](https://liquidjs.com/) template that is rendered when a notification is triggered and then sent as the request body. Seerr exposes a set of [template variables](#template-variables), plus the full `media`, `request`, `issue`, and `comment` objects, for use in [conditionals and filters](#template-syntax).

The template only needs to _render_ to valid JSON — it does not need to be valid JSON itself (for example, optional sections can be wrapped in `{% if %}` blocks). Use the **Test** button to confirm your template renders correctly; template errors are also written to the server logs.

## Template Syntax

Payloads and webhook URLs are rendered with [LiquidJS](https://liquidjs.com/), so in addition to simple `{{ variable }}` substitution you can use Liquid tags and filters.

### Conditionals

Render a section only when the relevant object is present, falling back to `null` otherwise:

```liquid
"media": {% if media %}{ "tmdbId": "{{ media_tmdbid }}" }{% else %}null{% endif %}
```

You can also branch on a value:

```liquid
{% if media_status == "AVAILABLE" %}...{% else %}...{% endif %}
```

### Filters

- **`json`** — `{{ subject | json }}`: serializes a value as JSON, quoting and escaping strings so characters like `"` or newlines can't break the payload. Circular-safe.
- **`default`** — `{{ notifyuser_username | default: "Unknown User" }}`: falls back to a value when the input is nil or empty.
- **`upcase` / `downcase`** — `{{ media_type | upcase }}`: changes case.
- **`capitalize`** — `{{ notifyuser_username | capitalize }}`: capitalizes the first character.
- **`truncate`** — `{{ subject | truncate: 50 }}`: shortens a string.
- **`url_encode`** — `{{ subject | url_encode }}`: percent-encodes a value for use in a URL.

See the [LiquidJS filter reference](https://liquidjs.com/filters/overview.html) for the full list.

:::info
Free-text values (titles, overviews, usernames, comments) should be emitted through the `json` filter so quotes and newlines can't produce invalid JSON, e.g. `"subject": {{ subject | json }}`.
:::

:::warning
Webhook URL values are rendered raw. When substituting a value into a URL, use the `url_encode` filter (e.g. `...?user={{ notifyuser_username | url_encode }}`) so characters like `&`, `?`, or spaces don't break the URL.
:::

### Advanced object access

In addition to the flat variables documented below, the full `media`, `request`, `issue`, and `comment` objects are available for conditionals and advanced templates (for example `{% if issue %}` or `{{ request.id }}`). These map to the [`NotificationPayload` interface](https://github.com/seerr-team/seerr/blob/develop/server/lib/notifications/agents/agent.ts).

## Template Variables

:::warning Deprecated
The flat template variables listed below (e.g. `{{ media_tmdbid }}`, `{{ notifyuser_username }}`) are deprecated and will be replaced in a future release. They continue to work for now, and a migration will be provided to convert existing templates automatically.
:::

### General

| Variable                | Value                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `{{notification_type}}` | The type of notification (e.g. `MEDIA_PENDING` or `ISSUE_COMMENT`)                                                                  |
| `{{event}}`             | A friendly description of the notification event                                                                                    |
| `{{subject}}`           | The notification subject (typically the media title)                                                                                |
| `{{message}}`           | The notification message body (the media overview/synopsis for request notifications; the issue description for issue notificatons) |
| `{{image}}`             | The notification image (typically the media poster)                                                                                 |

### Notify User

These variables are for the target recipient of the notification.

| Variable                                 | Value                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| `{{notifyuser_username}}`                | The target notification recipient's username                                                 |
| `{{notifyuser_email}}`                   | The target notification recipient's email address                                            |
| `{{notifyuser_avatar}}`                  | The target notification recipient's avatar URL                                               |
| `{{notifyuser_settings_discordIds}}`     | The target notification recipient's Discord ID(s) as a JSON array (if set)                   |
| `{{notifyuser_settings_telegramChatId}}` | The target notification recipient's Telegram Chat ID (if set)                                |

:::info
The `notifyuser` variables are not defined for the following request notification types, as they are intended for application administrators rather than end users:

- Request Pending Approval
- Request Automatically Approved
- Request Processing Failed

On the other hand, the `notifyuser` variables _will_ be replaced with the requesting user's information for the below notification types:

- Request Approved
- Request Declined
- Request Available

If you would like to use the requesting user's information in your webhook, please instead include the relevant variables from the [Request](#request) section below.
:::

### Objects

The following values are the full objects for each notification. They are `null` when not relevant to the notification, and are primarily useful in conditionals (e.g. `{% if media %}`) or for accessing fields not covered by the flat variables below. Serialize an object into the payload with the `json` filter, e.g. `"extra": {{ extra | json }}`.

| Variable    | Value                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `media`     | The relevant media object                                                                                                      |
| `request`   | The relevant request object                                                                                                    |
| `issue`     | The relevant issue object                                                                                                      |
| `comment`   | The relevant issue comment object                                                                                              |
| `extra`     | The "extra" array of additional data for certain notifications (e.g., season/episode numbers for series-related notifications) |

#### Media

`media` will be `null` if there is no relevant media object for the notification.

These following special variables are only included in media-related notifications, such as requests.

| Variable                    | Value                                                                                                          |
| ----------------------------| -------------------------------------------------------------------------------------------------------------- |
| `{{media_type}}`            | The media type (`movie` or `tv`)                                                                               |
| `{{media_imdbid}}`          | The media's IMDb ID                                                                                            |
| `{{media_tmdbid}}`          | The media's TMDB ID                                                                                            |
| `{{media_tvdbid}}`          | The media's TheTVDB ID                                                                                         |
| `{{media_status}}`          | The media's availability status (`UNKNOWN`, `PENDING`, `PROCESSING`, `PARTIALLY_AVAILABLE`, or `AVAILABLE`)    |
| `{{media_status4k}}`        | The media's 4K availability status (`UNKNOWN`, `PENDING`, `PROCESSING`, `PARTIALLY_AVAILABLE`, or `AVAILABLE`) |
| `{{media_jellyfinMediaId}}` | The media's Jellyfin Media ID                                                                                  |
| `{{media_plexRatingKey}}`   | The media's Plex ratingKey, if available (for standard library match)                                          |
| `{{media_plexRatingKey4k}}` | The media's Plex ratingKey for 4K match, if available                                                          |

#### Request

`request` will be `null` if there is no relevant request object for the notification.

The following special variables are only included in request-related notifications.

| Variable                                  | Value                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `{{request_id}}`                          | The request ID                                                                 |
| `{{requestedBy_username}}`                | The requesting user's username                                                 |
| `{{requestedBy_email}}`                   | The requesting user's email address                                            |
| `{{requestedBy_avatar}}`                  | The requesting user's avatar URL                                               |
| `{{requestedBy_jellyfinUserId}}`          | The requesting user's Jellyfin User ID                                         |
| `{{requestedBy_settings_discordIds}}`     | The requesting user's Discord ID(s) as a JSON array (if set)                   |
| `{{requestedBy_settings_telegramChatId}}` | The requesting user's Telegram Chat ID (if set)                                |

#### Issue

`issue` will be `null` if there is no relevant issue object for the notification.

The following special variables are only included in issue-related notifications.

| Variable                                 | Value                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `{{issue_id}}`                           | The issue ID                                                                   |
| `{{reportedBy_username}}`                | The requesting user's username                                                 |
| `{{reportedBy_email}}`                   | The requesting user's email address                                            |
| `{{reportedBy_avatar}}`                  | The requesting user's avatar URL                                               |
| `{{reportedBy_settings_discordIds}}`     | The reporting user's Discord ID(s) as a JSON array (if set)                    |
| `{{reportedBy_settings_telegramChatId}}` | The requesting user's Telegram Chat ID (if set)                                |

#### Comment

`comment` will be `null` if there is no relevant comment object for the notification.

The following special variables are only included in issue comment-related notifications.

| Variable                                  | Value                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `{{comment_message}}`                     | The comment message                                                            |
| `{{commentedBy_username}}`                | The commenting user's username                                                 |
| `{{commentedBy_email}}`                   | The commenting user's email address                                            |
| `{{commentedBy_avatar}}`                  | The commenting user's avatar URL                                               |
| `{{commentedBy_settings_discordIds}}`     | The commenting user's Discord ID(s) as a JSON array (if set)                   |
| `{{commentedBy_settings_telegramChatId}}` | The commenting user's Telegram Chat ID (if set)                                |
