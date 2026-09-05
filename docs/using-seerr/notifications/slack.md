---
title: Slack
description: Configure Slack notifications.
sidebar_position: 9
---

# Slack

The Slack notification agent enables you to post notifications to a channel in a workspace you manage.

:::info
Users can opt-in to being mentioned in Slack notifications by configuring their [Slack member ID(s)](https://slack.com/help/articles/221769328-Locate-your-Slack-URL-or-ID) in their user settings.
:::

## Configuration

### Webhook URL

Simply [create a webhook](https://my.slack.com/services/new/incoming-webhook/) and enter the URL in this field.

### Enable Mentions

When enabled, users who have configured their Slack member ID(s) will be mentioned in notifications relevant to their requests.

Slack surfaces mentions in the Activity feed even for muted channels, so users can mute the notification channel in Slack and still catch updates to their own requests.

:::info
Please refer to the [Slack API documentation](https://api.slack.com/messaging/webhooks) for more details on configuring these notifications.
:::

### Notification Language

Sets the language for notifications sent to this Slack channel.
