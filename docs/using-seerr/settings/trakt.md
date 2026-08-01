---
title: Trakt
description: Connect Trakt accounts and see who has watched what.
sidebar_position: 8
---

# Trakt

The **Trakt** tab under **Settings** lets each user in your household link their own Trakt account. Once linked, movie and series pages show who has already watched a title.

Trakt is optional. Until an administrator configures an application here, nothing related to Trakt appears anywhere in the interface.

## Creating a Trakt application

You need a Trakt API application before anything can be linked.

1. Sign in at [trakt.tv](https://trakt.tv) and go to [your API applications](https://trakt.tv/oauth/applications).
2. Create a new application and give it any name you like.
3. Add your Seerr callback URL to the **Redirect URI** field. Seerr shows the exact value to use in the Trakt settings tab, and it always ends in `/api/v1/auth/trakt/callback`.
4. Save the application, then copy the **Client ID** and **Client Secret**.

The redirect URI must match exactly, including the path. If it does not, Trakt accepts the sign-in but rejects the final step and the connection fails.

## Configuring the application

Enter the Client ID and Client Secret in the **Trakt application** section and save.

- **Client ID**: from your Trakt application.
- **Client Secret**: from your Trakt application. Leave the field blank when saving later changes to keep the stored secret.
- **Callback URL**: read-only. Copy this into your Trakt application's Redirect URI field.

The callback URL is derived from the **Application URL** in [General settings](./general.md). If that setting is empty, Seerr cannot build a callback URL and says so here. Set it before configuring Trakt.

:::warning
Changing the Client ID invalidates every existing connection. Seerr asks you to confirm, and all users have to reconnect afterwards. Changing only the secret leaves connections intact.
:::

## Linking accounts

Each user links their own account from their profile under **Linked Accounts**, next to Plex and Jellyfin. Administrators can also link, reconnect, or unlink on behalf of any user from the **Household connections** list in this tab.

A connection shows one of two states:

- **Connected**: working normally.
- **Reconnect required**: Trakt access has been lost, usually because the token was revoked or the application's Client ID changed. Use **Reconnect** to restore it.

**Unlink** removes the connection from Seerr and revokes the token at Trakt. If Trakt cannot be reached, the local connection is still removed and Seerr warns you to revoke it manually from the Trakt website.

## Watch status

With at least one account linked, media pages gain a **Trakt Watch Status** panel listing each household member who has a connection, whether they watched the title, and when.

On series pages you also get:

- A **Watched** badge on each season showing how many household members have finished it. Hovering lists their names.
- A checkmark next to each episode someone has watched, with a count when more than one person has seen it. Hovering lists their names.

A season counts as watched only when every aired episode has been watched.

Watch status is cached briefly, so a title watched moments ago may take a few minutes to appear. Reconnecting or unlinking clears the cache for that user immediately.

## Privacy

Users only see watch status for accounts they are allowed to see. Access and refresh tokens are stored for API access and are never returned by the API or shown in the interface. Watch status shows display names only, never email addresses.
