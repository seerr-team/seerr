---
title: Telegram
description: Configure Telegram notifications.
sidebar_position: 10
---

# Telegram

:::info
Users can optionally configure personal notifications in their user settings.

User notifications are separate from system notifications, and the available notification types are dependent on user permissions.
:::

## Configuration

:::info
In order to configure Telegram notifications, you first need to [create a bot](https://telegram.me/BotFather).

Bots **cannot** initiate conversations with users, so users must have your bot added to a conversation in order to receive notifications.
:::

### Bot Username (optional)

If this value is configured, users will be able to click a link to start a chat with your bot and configure their own personal notifications.

The bot username should end with `_bot`, and the `@` prefix should be omitted.

### Bot Authentication Token

At the end of the bot creation process, [@BotFather](https://telegram.me/botfather) will provide an authentication token.

### Chat ID

To obtain your chat ID, simply create a new group chat, add [@get_id_bot](https://telegram.me/get_id_bot), and issue the `/my_id` command.

### Thread/Topic ID (optional)

If your group chat has topics enabled, you can specify the ID of a thread or topic here, and notifications will be sent to it instead of the main chat. Leave this field blank to send them to the chat itself.

### Send Silently (optional)

Optionally, notifications can be sent silently. Silent notifications send messages without notification sounds.

### Embed Poster (optional)

When enabled, the poster image of the requested movie or series is included in the notification message.

