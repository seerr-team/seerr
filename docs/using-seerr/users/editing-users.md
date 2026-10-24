---
title: Editing Users
description: Edit user settings and permissions.
sidebar_position: 3
---

# Editing Users

From the **User List**, you can click the **Edit** button to modify a particular user's settings.

You can also click the check boxes and click the **Bulk Edit** button to set user permissions for multiple users at once.

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

## Request Services

If any of your Radarr/Sonarr servers have a [Request Button Label](/using-seerr/settings/services#request-button-label-optional) configured, a **Request Services** section appears below the permissions list. It controls which per-service request buttons the user can see and use.

- With **no services selected** (the default), the user only sees the regular request button.
- Selecting individual services shows that service's request button to the user. When a user has been granted at least one service for a media type, the regular request button is **replaced** by their per-service buttons for that media type.
- **All Services** grants every configured service at once.

These grants are enforced server-side: requests targeting a service the user has not been granted are rejected. Users with the **Manage Requests** permission can always use every per-service button without explicit grants.

Grants are automatically removed when the corresponding server is deleted from **Settings &rarr; Services**.
