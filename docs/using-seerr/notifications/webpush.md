---
title: Web Push
description: Configure web push notifications for your users.
sidebar_position: 2
---

# Web Push

The web push notification agent enables you and your users to receive Seerr notifications in a supported browser. This offers a native notification experience without the need to install an app.

This notification agent does not require any configuration, but is not enabled by default in Seerr.

To set up web push notifications, simply enable the agent in **Settings → Notifications → Web Push**.

:::warning
Web push notifications require a secure connection to your Seerr instance. Refer to the [Reverse Proxy](/extending-seerr/reverse-proxy) documentation for more information.
:::

You and your users have the option to enable web push notifications by going to your **User Profile → Edit Settings → Notifications → Web Push → Enable web push**. Here you can also customize the notifications you'd like to receive.

:::info[Mobile Users]
For Web Push notifications to work on mobile you need to add Seerr to your home screen as progressive web app (PWA). 
:::

:::info[iOS Users]
On iOS you may need to enable the Safari notifications feature flag by going to **Settings → Safari → Advanced → Feature Flags** and enabling "Notifications".
:::
