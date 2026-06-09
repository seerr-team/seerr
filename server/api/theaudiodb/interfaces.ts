interface TadbArtist {
  strArtistThumb: string | null;
  strArtistFanart: string | null;
}

export interface TadbArtistResponse {
  artists?: TadbArtist[];
}
