import ListenBrainzAPI from '@server/api/listenbrainz';
import TheAudioDb from '@server/api/theaudiodb';
import TheMovieDb from '@server/api/themoviedb';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import MetadataArtist from '@server/entity/MetadataArtist';
import logger from '@server/logger';
import {
  mapCastCredits,
  mapCrewCredits,
  mapPersonDetails,
} from '@server/models/Person';
import { Router } from 'express';
import { In } from 'typeorm';

const personRoutes = Router();

personRoutes.get('/:id', async (req, res, next) => {
  const tmdb = new TheMovieDb();
  const listenbrainz = new ListenBrainzAPI();
  const theAudioDb = TheAudioDb.getInstance();

  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const initialItemsPerType = 20;
  const albumType = req.query.albumType as string | undefined;

  try {
    const [person, existingMetadata] = await Promise.all([
      tmdb.getPerson({
        personId: Number(req.params.id),
        language: (req.query.language as string) ?? req.locale,
      }),
      getRepository(MetadataArtist).findOne({
        where: { tmdbPersonId: req.params.id },
        select: ['mbArtistId', 'tmdbThumb', 'tadbThumb', 'tadbCover'],
      }),
    ]);

    let artistData = null;

    if (existingMetadata?.mbArtistId) {
      artistData = await listenbrainz.getArtist(existingMetadata.mbArtistId);

      if (artistData?.releaseGroups) {
        const groupedReleaseGroups = artistData.releaseGroups.reduce(
          (acc, rg) => {
            const type = rg.secondary_types?.length
              ? rg.secondary_types[0]
              : rg.type || 'Other';

            if (!acc[type]) {
              acc[type] = [];
            }
            acc[type].push(rg);
            return acc;
          },
          {} as Record<string, typeof artistData.releaseGroups>
        );

        Object.keys(groupedReleaseGroups).forEach((type) => {
          groupedReleaseGroups[type].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
          });
        });

        let releaseGroupsToProcess: typeof artistData.releaseGroups = [];
        let totalCount: number;
        let totalPages: number;

        if (albumType) {
          const filteredReleaseGroups = groupedReleaseGroups[albumType] || [];
          totalCount = filteredReleaseGroups.length;
          totalPages = Math.ceil(totalCount / pageSize);

          releaseGroupsToProcess = filteredReleaseGroups.slice(
            (page - 1) * pageSize,
            page * pageSize
          );
        } else {
          Object.entries(groupedReleaseGroups).forEach(([, releases]) => {
            releaseGroupsToProcess.push(
              ...releases.slice(0, initialItemsPerType)
            );
          });

          totalCount = Object.values(groupedReleaseGroups).reduce(
            (sum, releases) => sum + releases.length,
            0
          );
          totalPages = 1;
        }

        const allReleaseGroupIds = releaseGroupsToProcess.map((rg) => rg.mbid);

        const [artistImagesPromise, relatedMedia, albumMetadata] =
          await Promise.all([
            !existingMetadata.tadbThumb && !existingMetadata.tadbCover
              ? theAudioDb.getArtistImages(existingMetadata.mbArtistId)
              : Promise.resolve(null),
            Media.getRelatedMedia(req.user, allReleaseGroupIds),
            getRepository(MetadataAlbum).find({
              where: { mbAlbumId: In(allReleaseGroupIds) },
              select: ['mbAlbumId', 'caaUrl'],
              cache: true,
            }),
          ]);

        if (artistImagesPromise) {
          existingMetadata.tadbThumb = artistImagesPromise.artistThumb;
          existingMetadata.tadbCover = artistImagesPromise.artistBackground;
        }

        const mediaMap = new Map(
          relatedMedia.map((media) => [media.mbId, media])
        );

        const metadataMap = new Map(
          albumMetadata.map((metadata) => [metadata.mbAlbumId, metadata])
        );

        const transformedReleaseGroups = releaseGroupsToProcess.map(
          (releaseGroup) => {
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
          }
        );

        const typeCounts = Object.fromEntries(
          Object.entries(groupedReleaseGroups).map(([type, releases]) => [
            type,
            releases.length,
          ])
        );

        artistData = {
          ...artistData,
          releaseGroups: transformedReleaseGroups,
          typeCounts,
          pagination: {
            page,
            pageSize,
            totalItems: totalCount,
            totalPages,
            albumType,
          },
        };
      }
    }

    const mappedDetails = {
      ...mapPersonDetails(person),
      artist:
        artistData && existingMetadata?.mbArtistId
          ? {
              mbid: existingMetadata.mbArtistId,
              profilePath: person.profile_path
                ? `https://image.tmdb.org/t/p/w500${person.profile_path}`
                : existingMetadata.tadbThumb ?? null,
              artistThumb: existingMetadata.tadbThumb ?? null,
              artistBackdrop: existingMetadata.tadbCover ?? null,
              ...artistData,
            }
          : null,
    };

    return res.status(200).json(mappedDetails);
  } catch (e) {
    logger.debug('Something went wrong retrieving person', {
      label: 'API',
      errorMessage: e.message,
      personId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve person.',
    });
  }
});

personRoutes.get('/:id/combined_credits', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const combinedCredits = await tmdb.getPersonCombinedCredits({
      personId: Number(req.params.id),
      language: (req.query.language as string) ?? req.locale,
    });

    const castMedia = await Media.getRelatedMedia(
      req.user,
      combinedCredits.cast.map((result) => result.id)
    );

    const crewMedia = await Media.getRelatedMedia(
      req.user,
      combinedCredits.crew.map((result) => result.id)
    );

    return res.status(200).json({
      cast: combinedCredits.cast
        .map((result) =>
          mapCastCredits(
            result,
            castMedia.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === result.media_type
            )
          )
        )
        .filter((item) => !item.adult),
      crew: combinedCredits.crew
        .map((result) =>
          mapCrewCredits(
            result,
            crewMedia.find(
              (med) =>
                med.tmdbId === result.id && med.mediaType === result.media_type
            )
          )
        )
        .filter((item) => !item.adult),
      id: combinedCredits.id,
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving combined credits', {
      label: 'API',
      errorMessage: e.message,
      personId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve combined credits.',
    });
  }
});

export default personRoutes;
