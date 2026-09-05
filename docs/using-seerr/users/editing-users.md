---
title: Editing Users
description: Edit user settings and permissions.
sidebar_position: 3
---

# Editing Users

From the **User List**, you can click the **Edit** button to modify a particular user's settings.

You can also click the check boxes and click the **Bulk Edit** button to set user permissions or parental controls for multiple users at once.

## General

### Display Name

You can optionally set a "friendly name" for any user. This name will be used in lieu of their media server (Jellyfin/Emby/Plex) username (for users imported from the media server) or their email address (for manually-created local users).

### Email

:::note
This field is read-only for users imported from Plex.
:::
You can optionally set a proper email address for any user. This email address will be used for notifications, local sign-in and password resets.

By default, users imported from Jellyfin/Emby will use their media server username as their email address.

:::warning
You cannot leave this field blank.
:::

### Display Language

Users can override the [global display language](/using-seerr/settings/general#display-language) to use Seerr in their preferred language.

### Discover Region & Discover Language

Users can override the [global filter settings](/using-seerr/settings/general#discover-region-discover-language--streaming-region) to suit their own preferences.

### Movie Request Limit & Series Request Limit

You can override the default settings and assign different request limits for specific users by checking the **Enable Override** box and selecting the desired request limit and time period.

Unless an override is configured, users are granted the global request limits.

Note that users with the **Manage Users** permission are exempt from request limits, since that permission also grants the ability to submit requests on behalf of other users.

Users are also unable to modify their own request limits.

## Password

All "local users" are assigned passwords upon creation, but users imported from Plex can also optionally configure passwords to enable sign-in using their email address.

Passwords must be a minimum of 8 characters long.

## Notifications

Users can configure their personal notification settings here. Please see [Notifications](/using-seerr/notifications/) for details on configuring and enabling notifications.

## Permissions

Users cannot modify their own permissions. Users with the **Manage Users** permission can manage permissions of other users, except those of users with the **Admin** permission.

## Parental Controls

Users with the **Manage Users** permission can set content rating limits for other users. Rating limits use the US rating systems: MPAA ratings for movies and the TV Parental Guidelines for series.

When a limit is set, content above it is hidden from Discover, search, and recommendations for that user, its detail pages are blocked, and requests for it are rejected. **Block Unrated Content** additionally hides titles that have no US rating.

:::note
Setting a series rating limit hides shows that have no US TV rating. Most popular shows are rated, but much of the wider catalog is not.
:::

Parental controls cannot be set for the server owner or for users with the **Manage Users** permission, and users cannot see or change their own limits.
