import CoverArtArchive from '@server/api/coverartarchive';
import MusicBrainz from '@server/api/musicbrainz';
import Media from '@server/entity/Media';
import logger from '@server/logger';
import { mapArtistDetails } from '@server/models/Artist';
import { Router } from 'express';

const groupRoutes = Router();

groupRoutes.get('/:id', async (req, res, next) => {
  const musicbrainz = new MusicBrainz();
  const locale = req.locale || 'en';

  try {
    const [artistDetails, wikipediaExtract] = await Promise.all([
      musicbrainz.getArtist({
        artistId: req.params.id,
      }),
      musicbrainz.getWikipediaExtract(req.params.id, locale, 'artist'),
    ]);

    const mappedDetails = await mapArtistDetails(artistDetails);

    if (wikipediaExtract) {
      mappedDetails.overview = wikipediaExtract;
    }

    return res.status(200).json(mappedDetails);
  } catch (e) {
    logger.error('Something went wrong retrieving artist details', {
      label: 'Group API',
      errorMessage: e.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve artist details.',
    });
  }
});

groupRoutes.get('/:id/discography', async (req, res, next) => {
  const musicbrainz = new MusicBrainz();
  const coverArtArchive = new CoverArtArchive();

  try {
    const type = req.query.type as string;
    const page = Number(req.query.page) || 1;
    const pageSize = 20;

    const artistDetails = await musicbrainz.getArtist({
      artistId: req.params.id,
    });

    const mappedDetails = await mapArtistDetails(artistDetails);

    if (!mappedDetails.Albums?.length) {
      return res.status(200).json({
        page: 1,
        pageInfo: {
          total: 0,
          totalPages: 0,
        },
        results: [],
      });
    }

    let filteredAlbums = mappedDetails.Albums;
    if (type) {
      if (type === 'Other') {
        filteredAlbums = mappedDetails.Albums.filter(
          (album) => !['Album', 'Single', 'EP'].includes(album.type)
        );
      } else {
        filteredAlbums = mappedDetails.Albums.filter(
          (album) => album.type === type
        );
      }
    }

    const albumsWithDetails = await Promise.all(
      filteredAlbums.map(async (album) => {
        try {
          const albumDetails = await musicbrainz.getAlbum({
            albumId: album.id,
          });

          let images = albumDetails.images;

          if (!images?.length) {
            try {
              const coverArtData = await coverArtArchive.getCoverArt(album.id);
              if (coverArtData.images?.length) {
                images = coverArtData.images.map((img) => ({
                  CoverType: img.front ? 'Cover' : 'Poster',
                  Url: img.image,
                }));
              }
            } catch (e) {
              // Handle cover art errors silently
            }
          }

          return {
            ...album,
            images: images || [],
            releasedate: albumDetails.releasedate || '',
          };
        } catch (e) {
          return {
            ...album,
            images: [],
            releasedate: '',
          };
        }
      })
    );

    const sortedAlbums = albumsWithDetails.sort((a, b) => {
      if (!a.releasedate && !b.releasedate) return 0;
      if (!a.releasedate) return 1;
      if (!b.releasedate) return -1;
      return (
        new Date(b.releasedate).getTime() - new Date(a.releasedate).getTime()
      );
    });

    const totalResults = sortedAlbums.length;
    const totalPages = Math.ceil(totalResults / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedAlbums = sortedAlbums.slice(start, end);

    const media = await Media.getRelatedMedia(
      req.user,
      paginatedAlbums.map((album) => album.id)
    );

    const results = paginatedAlbums.map((album) => ({
      ...album,
      mediaInfo: media?.find((med) => med.mbId === album.id),
    }));

    return res.status(200).json({
      page,
      pageInfo: {
        total: totalResults,
        totalPages,
      },
      results,
    });
  } catch (e) {
    logger.error('Something went wrong retrieving artist discography', {
      label: 'Group API',
      errorMessage: e.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve artist discography.',
    });
  }
});

export default groupRoutes;
