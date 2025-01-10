import CoverArtArchive from '@server/api/coverartarchive';
import ListenBrainzAPI from '@server/api/listenbrainz';
import MusicBrainz from '@server/api/musicbrainz';
import TheMovieDb from '@server/api/themoviedb';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { Watchlist } from '@server/entity/Watchlist';
import logger from '@server/logger';
import { mapMusicDetails } from '@server/models/Music';
import { Router } from 'express';

const musicRoutes = Router();

musicRoutes.get('/:id', async (req, res, next) => {
  const musicbrainz = new MusicBrainz();
  const locale = req.locale || 'en';

  try {
    const [albumDetails, wikipediaExtract] = await Promise.all([
      musicbrainz.getAlbum({
        albumId: req.params.id,
      }),
      musicbrainz.getWikipediaExtract(req.params.id, locale),
    ]);

    const [media, onUserWatchlist] = await Promise.all([
      getRepository(Media)
        .findOne({
          where: {
            mbId: req.params.id,
            mediaType: MediaType.MUSIC,
          },
        })
        .then((media) => media ?? undefined),

      getRepository(Watchlist).exist({
        where: {
          mbId: req.params.id,
          requestedBy: {
            id: req.user?.id,
          },
        },
      }),
    ]);

    const mappedDetails = mapMusicDetails(albumDetails, media, onUserWatchlist);

    if (wikipediaExtract) {
      mappedDetails.artist.overview = wikipediaExtract;
    }

    return res.status(200).json(mappedDetails);
  } catch (e) {
    logger.error('Something went wrong retrieving album details', {
      label: 'Music API',
      errorMessage: e.message,
      mbId: req.params.id,
    });

    return next({
      status: 500,
      message: 'Unable to retrieve album details.',
    });
  }
});

musicRoutes.get('/:id/discography', async (req, res, next) => {
  const musicbrainz = new MusicBrainz();
  const coverArtArchive = new CoverArtArchive();

  try {
    const albumDetails = await musicbrainz.getAlbum({
      albumId: req.params.id,
    });

    if (!albumDetails.artists?.[0]?.id) {
      throw new Error('No artist found for album');
    }

    const page = Number(req.query.page) || 1;
    const pageSize = 20;

    const artistData = await musicbrainz.getArtist({
      artistId: albumDetails.artists[0].id,
    });

    const albums =
      artistData.Albums?.map((album) => ({
        id: album.Id.toLowerCase(),
        title: album.Title,
        type: album.Type,
        mediaType: 'album',
      })) ?? [];

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedAlbums = albums.slice(start, end);

    const albumDetailsPromises = paginatedAlbums.map(async (album) => {
      try {
        const details = await musicbrainz.getAlbum({
          albumId: album.id,
        });

        let images = details.images;

        // Try to get cover art if no images found
        if (!images || images.length === 0) {
          try {
            const coverArtData = await coverArtArchive.getCoverArt(album.id);
            if (coverArtData.images?.length > 0) {
              images = coverArtData.images.map((img) => ({
                CoverType: img.front ? 'Cover' : 'Poster',
                Url: img.image,
              }));
            }
          } catch (coverArtError) {
            // Fallback silently
          }
        }

        return {
          ...album,
          images,
          releasedate: details.releasedate,
        };
      } catch (e) {
        return album;
      }
    });

    const albumsWithDetails = await Promise.all(albumDetailsPromises);

    const media = await Media.getRelatedMedia(
      req.user,
      albumsWithDetails.map((album) => album.id)
    );

    const resultsWithMedia = albumsWithDetails.map((album) => ({
      ...album,
      mediaInfo: media?.find((med) => med.mbId === album.id),
    }));

    return res.status(200).json({
      page,
      totalPages: Math.ceil(albums.length / pageSize),
      totalResults: albums.length,
      results: resultsWithMedia,
    });
  } catch (e) {
    logger.error('Something went wrong retrieving artist discography', {
      label: 'Music API',
      errorMessage: e.message,
      albumId: req.params.id,
    });

    return next({
      status: 500,
      message: 'Unable to retrieve artist discography.',
    });
  }
});

musicRoutes.get('/:id/similar', async (req, res, next) => {
  const musicbrainz = new MusicBrainz();
  const listenbrainz = new ListenBrainzAPI();
  const tmdb = new TheMovieDb();

  try {
    const albumDetails = await musicbrainz.getAlbum({
      albumId: req.params.id,
    });

    if (!albumDetails.artists?.[0]?.id) {
      throw new Error('No artist found for album');
    }

    const page = Number(req.query.page) || 1;
    const pageSize = 20;

    const similarArtists = await listenbrainz.getSimilarArtists(
      albumDetails.artists[0].id
    );

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedArtists = similarArtists.slice(start, end);

    const artistDetailsPromises = paginatedArtists.map(async (artist) => {
      try {
        let tmdbId = null;
        if (artist.type === 'Person') {
          const searchResults = await tmdb.searchPerson({
            query: artist.name,
            page: 1,
          });

          const match = searchResults.results.find(
            (result) => result.name.toLowerCase() === artist.name.toLowerCase()
          );
          if (match) {
            tmdbId = match.id;
          }
        }

        const details = await musicbrainz.getArtist({
          artistId: artist.artist_mbid,
        });

        return {
          id: tmdbId || artist.artist_mbid,
          mediaType: 'artist' as const,
          artistname: artist.name,
          type: artist.type || 'Person',
          overview: artist.comment,
          score: artist.score,
          images: details.images || [],
          artistimage: details.images?.find((img) => img.CoverType === 'Poster')
            ?.Url,
        };
      } catch (e) {
        return null;
      }
    });

    const artistDetails = (await Promise.all(artistDetailsPromises)).filter(
      (artist): artist is NonNullable<typeof artist> => artist !== null
    );

    return res.status(200).json({
      page,
      totalPages: Math.ceil(similarArtists.length / pageSize),
      totalResults: similarArtists.length,
      results: artistDetails,
    });
  } catch (e) {
    logger.error('Something went wrong retrieving similar artists', {
      label: 'Music API',
      errorMessage: e.message,
      albumId: req.params.id,
    });

    return next({
      status: 500,
      message: 'Unable to retrieve similar artists.',
    });
  }
});

export default musicRoutes;
