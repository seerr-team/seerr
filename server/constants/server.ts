export enum MediaServerType {
  PLEX = 1,
  JELLYFIN,
  EMBY,
  NOT_CONFIGURED,
}

export enum ServerType {
  JELLYFIN = 'Jellyfin',
  EMBY = 'Emby',
  PLEX = 'Plex',
}

export enum TagRequestsFormat {
  USERID = 'userid',
  USERID_USERNAME = 'userid-username',
  USERNAME = 'username',
}
