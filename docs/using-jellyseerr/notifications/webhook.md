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

### JSON Payload

Customize the JSON payload to suit your needs. Jellyseerr provides several [template variables](#template-variables) for use in the payload, which will be replaced with the relevant data when the notifications are triggered.

## Template Variables

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

| Variable                                 | Value                                                         |
| ---------------------------------------- | ------------------------------------------------------------- |
| `{{notifyuser_username}}`                | The target notification recipient's username                  |
| `{{notifyuser_email}}`                   | The target notification recipient's email address             |
| `{{notifyuser_avatar}}`                  | The target notification recipient's avatar URL                |
| `{{notifyuser_settings_discordId}}`      | The target notification recipient's Discord ID (if set)       |
| `{{notifyuser_settings_telegramChatId}}` | The target notification recipient's Telegram Chat ID (if set) |

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

### Special

The following variables must be used as a key in the JSON payload (e.g., `"{{extra}}": []`).

| Variable      | Value                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `{{media}}`   | The relevant media object                                                                                                      |
| `{{request}}` | The relevant request object                                                                                                    |
| `{{issue}}`   | The relevant issue object                                                                                                      |
| `{{comment}}` | The relevant issue comment object                                                                                              |
| `{{extra}}`   | The "extra" array of additional data for certain notifications (e.g., season/episode numbers for series-related notifications) |

#### Media

The `{{media}}` will be `null` if there is no relevant media object for the notification.

These following special variables are only included in media-related notifications, such as requests.

| Variable             | Value                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `{{media_type}}`     | The media type (`movie` or `tv`)                                                                               |
| `{{media_tmdbid}}`   | The media's TMDB ID                                                                                            |
| `{{media_tvdbid}}`   | The media's TheTVDB ID                                                                                         |
| `{{media_status}}`   | The media's availability status (`UNKNOWN`, `PENDING`, `PROCESSING`, `PARTIALLY_AVAILABLE`, or `AVAILABLE`)    |
| `{{media_status4k}}` | The media's 4K availability status (`UNKNOWN`, `PENDING`, `PROCESSING`, `PARTIALLY_AVAILABLE`, or `AVAILABLE`) |

#### Request

The `{{request}}` will be `null` if there is no relevant media object for the notification.

The following special variables are only included in request-related notifications.

| Variable                                  | Value                                           |
| ----------------------------------------- | ----------------------------------------------- |
| `{{request_id}}`                          | The request ID                                  |
| `{{requestedBy_username}}`                | The requesting user's username                  |
| `{{requestedBy_email}}`                   | The requesting user's email address             |
| `{{requestedBy_avatar}}`                  | The requesting user's avatar URL                |
| `{{requestedBy_settings_discordId}}`      | The requesting user's Discord ID (if set)       |
| `{{requestedBy_settings_telegramChatId}}` | The requesting user's Telegram Chat ID (if set) |

#### Issue

The `{{issue}}` will be `null` if there is no relevant media object for the notification.

The following special variables are only included in issue-related notifications.

| Variable                                 | Value                                           |
| ---------------------------------------- | ----------------------------------------------- |
| `{{issue_id}}`                           | The issue ID                                    |
| `{{reportedBy_username}}`                | The requesting user's username                  |
| `{{reportedBy_email}}`                   | The requesting user's email address             |
| `{{reportedBy_avatar}}`                  | The requesting user's avatar URL                |
| `{{reportedBy_settings_discordId}}`      | The requesting user's Discord ID (if set)       |
| `{{reportedBy_settings_telegramChatId}}` | The requesting user's Telegram Chat ID (if set) |

#### Comment

The `{{comment}}` will be `null` if there is no relevant media object for the notification.

The following special variables are only included in issue comment-related notifications.

| Variable                                  | Value                                           |
| ----------------------------------------- | ----------------------------------------------- |
| `{{comment_message}}`                     | The comment message                             |
| `{{commentedBy_username}}`                | The commenting user's username                  |
| `{{commentedBy_email}}`                   | The commenting user's email address             |
| `{{commentedBy_avatar}}`                  | The commenting user's avatar URL                |
| `{{commentedBy_settings_discordId}}`      | The commenting user's Discord ID (if set)       |
| `{{commentedBy_settings_telegramChatId}}` | The commenting user's Telegram Chat ID (if set) |
