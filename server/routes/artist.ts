import ListenBrainzAPI from '@server/api/listenbrainz';
import type { LbReleaseGroupExtended } from '@server/api/listenbrainz/interfaces';
import MusicBrainz from '@server/api/musicbrainz';
import TheAudioDb from '@server/api/theaudiodb';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import MetadataArtist from '@server/entity/MetadataArtist';
import logger from '@server/logger';
import { Router } from 'express';
import { In } from 'typeorm';

const artistRoutes = Router();

artistRoutes.get('/:id', async (req, res, next) => {
  const listenbrainz = new ListenBrainzAPI();
  const musicbrainz = new MusicBrainz();
  const theAudioDb = TheAudioDb.getInstance();

  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const initialItemsPerType = 20;
  const albumType = req.query.albumType as string | undefined;

  try {
    const [artistData, metadataArtist] = await Promise.all([
      listenbrainz.getArtist(req.params.id),
      getRepository(MetadataArtist).findOne({
        where: { mbArtistId: req.params.id },
        select: ['mbArtistId', 'tadbThumb', 'tadbCover', 'tmdbThumb'],
      }),
    ]);

    if (!artistData) {
      throw new Error('Artist not found');
    }

    const groupedReleaseGroups = artistData.releaseGroups.reduce((acc, rg) => {
      const type = rg.secondary_types?.length
        ? rg.secondary_types[0]
        : rg.type || 'Other';

      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(rg);
      return acc;
    }, {} as Record<string, typeof artistData.releaseGroups>);

    Object.keys(groupedReleaseGroups).forEach((type) => {
      groupedReleaseGroups[type].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });
    });

    let releaseGroupsToProcess: LbReleaseGroupExtended[];
    let totalCount;
    let totalPages;

    if (albumType) {
      const filteredReleaseGroups = groupedReleaseGroups[albumType] || [];
      totalCount = filteredReleaseGroups.length;
      totalPages = Math.ceil(totalCount / pageSize);

      releaseGroupsToProcess = filteredReleaseGroups.slice(
        (page - 1) * pageSize,
        page * pageSize
      );
    } else {
      releaseGroupsToProcess = [];
      Object.entries(groupedReleaseGroups).forEach(([, releases]) => {
        releaseGroupsToProcess.push(...releases.slice(0, initialItemsPerType));
      });

      totalCount = Object.values(groupedReleaseGroups).reduce(
        (sum, releases) => sum + releases.length,
        0
      );
      totalPages = 1;
    }

    const mbIds = releaseGroupsToProcess.map((rg) => rg.mbid);

    const [artistWikipedia, artistImages, relatedMedia, albumMetadata] =
      await Promise.all([
        musicbrainz
          .getArtistWikipediaExtract({
            artistMbid: req.params.id,
            language: req.locale,
          })
          .catch(() => null),
        !metadataArtist?.tadbThumb && !metadataArtist?.tadbCover
          ? theAudioDb.getArtistImages(req.params.id)
          : theAudioDb.getArtistImagesFromCache(req.params.id),
        Media.getRelatedMedia(req.user, mbIds),
        getRepository(MetadataAlbum).find({
          where: { mbAlbumId: In(mbIds) },
          cache: true,
        }),
      ]);

    const metadataMap = new Map(
      albumMetadata.map((metadata) => [metadata.mbAlbumId, metadata])
    );

    const mediaMap = new Map(relatedMedia.map((media) => [media.mbId, media]));

    const mappedReleaseGroups = releaseGroupsToProcess.map((releaseGroup) => {
      const metadata = metadataMap.get(releaseGroup.mbid);
      const coverArtUrl = metadata?.caaUrl || null;

      return {
        id: releaseGroup.mbid,
        mediaType: 'album',
        title: releaseGroup.name,
        'first-release-date': releaseGroup.date,
        'artist-credit': [{ name: releaseGroup.artist_credit_name }],
        'primary-type': releaseGroup.type || 'Other',
        secondary_types: releaseGroup.secondary_types || [],
        total_listen_count: releaseGroup.total_listen_count || 0,
        posterPath: coverArtUrl,
        needsCoverArt: !coverArtUrl,
        mediaInfo: mediaMap.get(releaseGroup.mbid),
      };
    });

    const typeCounts = Object.fromEntries(
      Object.entries(groupedReleaseGroups).map(([type, releases]) => [
        type,
        releases.length,
      ])
    );

    return res.status(200).json({
      ...artistData,
      wikipedia: artistWikipedia,
      artistThumb:
        metadataArtist?.tmdbThumb ??
        metadataArtist?.tadbThumb ??
        artistImages?.artistThumb ??
        null,
      artistBackdrop:
        metadataArtist?.tadbCover ?? artistImages?.artistBackground ?? null,
      releaseGroups: mappedReleaseGroups,
      pagination: {
        page,
        pageSize,
        totalItems: totalCount,
        totalPages,
        albumType,
      },
      typeCounts,
    });
  } catch (e) {
    logger.error('Something went wrong retrieving artist details', {
      label: 'Artist API',
      errorMessage: e.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve artist.',
    });
  }
});

export default artistRoutes;
