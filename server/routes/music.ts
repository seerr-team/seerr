import ListenBrainzAPI from '@server/api/listenbrainz';
import MusicBrainz from '@server/api/musicbrainz';
import TheAudioDb from '@server/api/theaudiodb';
import TmdbPersonMapper from '@server/api/themoviedb/personMapper';
import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import MetadataArtist from '@server/entity/MetadataArtist';
import { Watchlist } from '@server/entity/Watchlist';
import logger from '@server/logger';
import { mapMusicDetails } from '@server/models/Music';
import { Router } from 'express';
import { In } from 'typeorm';

const musicRoutes = Router();

musicRoutes.get('/:id', async (req, res, next) => {
  const listenbrainz = new ListenBrainzAPI();
  const musicbrainz = new MusicBrainz();
  const personMapper = new TmdbPersonMapper();
  const theAudioDb = new TheAudioDb();

  try {
    const [albumDetails, media, onUserWatchlist] = await Promise.all([
      listenbrainz.getAlbum(req.params.id),
      getRepository(Media)
        .createQueryBuilder('media')
        .leftJoinAndSelect('media.requests', 'requests')
        .leftJoinAndSelect('requests.requestedBy', 'requestedBy')
        .leftJoinAndSelect('requests.modifiedBy', 'modifiedBy')
        .where({
          mbId: req.params.id,
          mediaType: MediaType.MUSIC,
        })
        .getOne()
        .then((media) => media ?? undefined),
      getRepository(Watchlist).exist({
        where: {
          mbId: req.params.id,
          requestedBy: { id: req.user?.id },
        },
      }),
    ]);

    const artistId =
      albumDetails.release_group_metadata?.artist?.artists[0]?.artist_mbid;
    const isPerson =
      albumDetails.release_group_metadata?.artist?.artists[0]?.type ===
      'Person';
    const trackArtistIds = albumDetails.mediums
      .flatMap((medium) => medium.tracks)
      .flatMap((track) => track.artists)
      .filter((artist) => artist.artist_mbid)
      .map((artist) => artist.artist_mbid);

    const [
      metadataAlbum,
      metadataArtist,
      trackArtistMetadata,
      artistWikipedia,
    ] = await Promise.allSettled([
      getRepository(MetadataAlbum).findOne({
        where: { mbAlbumId: req.params.id },
      }),
      artistId
        ? getRepository(MetadataArtist).findOne({
            where: { mbArtistId: artistId },
          })
        : Promise.resolve(undefined),
      getRepository(MetadataArtist).find({
        where: { mbArtistId: In(trackArtistIds) },
      }),
      artistId && isPerson
        ? musicbrainz
            .getArtistWikipediaExtract({
              artistMbid: artistId,
              language: req.locale,
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const resolvedMetadataAlbum =
      metadataAlbum.status === 'fulfilled' ? metadataAlbum.value : null;
    const resolvedMetadataArtist =
      metadataArtist.status === 'fulfilled' ? metadataArtist.value : undefined;
    const resolvedTrackArtistMetadata =
      trackArtistMetadata.status === 'fulfilled'
        ? trackArtistMetadata.value
        : [];
    const resolvedArtistWikipedia =
      artistWikipedia.status === 'fulfilled' ? artistWikipedia.value : null;

    const trackArtistsToMap = albumDetails.mediums
      .flatMap((medium) => medium.tracks)
      .flatMap((track) =>
        track.artists
          .filter((artist) => artist.artist_mbid)
          .filter(
            (artist) =>
              !resolvedTrackArtistMetadata.some(
                (m) => m.mbArtistId === artist.artist_mbid && m.tmdbPersonId
              )
          )
          .map((artist) => ({
            artistId: artist.artist_mbid,
            artistName: artist.artist_credit_name,
          }))
      );

    const responses = await Promise.allSettled([
      artistId &&
      !resolvedMetadataArtist?.tadbThumb &&
      !resolvedMetadataArtist?.tadbCover
        ? theAudioDb.getArtistImages(artistId)
        : Promise.resolve(null),
      artistId && isPerson && !resolvedMetadataArtist?.tmdbPersonId
        ? personMapper
            .getMapping(
              artistId,
              albumDetails.release_group_metadata.artist.artists[0].name
            )
            .catch(() => null)
        : Promise.resolve(null),
      trackArtistsToMap.length > 0
        ? personMapper.batchGetMappings(trackArtistsToMap).then(() =>
            getRepository(MetadataArtist).find({
              where: { mbArtistId: In(trackArtistIds) },
            })
          )
        : Promise.resolve(resolvedTrackArtistMetadata),
    ]);

    const artistImages =
      responses[0].status === 'fulfilled' ? responses[0].value : null;
    const personMappingResult =
      responses[1].status === 'fulfilled' ? responses[1].value : null;
    const updatedArtistMetadata =
      responses[2].status === 'fulfilled'
        ? responses[2].value
        : resolvedTrackArtistMetadata;

    const updatedMetadataArtist =
      personMappingResult && artistId
        ? await getRepository(MetadataArtist).findOne({
            where: { mbArtistId: artistId },
          })
        : resolvedMetadataArtist;

    const mappedDetails = mapMusicDetails(albumDetails, media, onUserWatchlist);
    const finalTrackArtistMetadata =
      updatedArtistMetadata || resolvedTrackArtistMetadata;

    return res.status(200).json({
      ...mappedDetails,
      posterPath: resolvedMetadataAlbum?.caaUrl ?? null,
      needsCoverArt: !resolvedMetadataAlbum?.caaUrl,
      artistWikipedia: resolvedArtistWikipedia,
      artistThumb:
        updatedMetadataArtist?.tmdbThumb ??
        updatedMetadataArtist?.tadbThumb ??
        artistImages?.artistThumb ??
        null,
      artistBackdrop:
        updatedMetadataArtist?.tadbCover ??
        artistImages?.artistBackground ??
        null,
      tmdbPersonId: updatedMetadataArtist?.tmdbPersonId
        ? Number(updatedMetadataArtist.tmdbPersonId)
        : null,
      tracks: mappedDetails.tracks.map((track) => ({
        ...track,
        artists: track.artists.map((artist) => {
          const metadata = finalTrackArtistMetadata.find(
            (m) => m.mbArtistId === artist.mbid
          );
          return {
            ...artist,
            tmdbMapping: metadata?.tmdbPersonId
              ? {
                  personId: Number(metadata.tmdbPersonId),
                  profilePath: metadata.tmdbThumb,
                }
              : null,
          };
        }),
      })),
    });
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

musicRoutes.get('/:id/artist', async (req, res, next) => {
  try {
    const listenbrainzApi = new ListenBrainzAPI();
    const theAudioDb = new TheAudioDb();
    const metadataArtistRepository = getRepository(MetadataArtist);

    const albumData = await listenbrainzApi.getAlbum(req.params.id);
    const artistData = albumData?.release_group_metadata?.artist?.artists?.[0];
    const artistType = artistData?.type;

    if (!artistData?.artist_mbid || artistType === 'Other') {
      return res.status(404).json({
        status: 404,
        message: 'Artist details not available for this type',
      });
    }

    const responses = await Promise.allSettled([
      listenbrainzApi.getArtist(artistData.artist_mbid),
      theAudioDb.getArtistImagesFromCache(artistData.artist_mbid),
      metadataArtistRepository.findOne({
        where: { mbArtistId: artistData.artist_mbid },
      }),
    ]);

    const artistDetails =
      responses[0].status === 'fulfilled' ? responses[0].value : null;
    const cachedTheAudioDb =
      responses[1].status === 'fulfilled' ? responses[1].value : null;
    const metadataArtist =
      responses[2].status === 'fulfilled' ? responses[2].value : null;

    if (!artistDetails) {
      return res.status(404).json({ status: 404, message: 'Artist not found' });
    }

    const [artistImagesResult] = await Promise.allSettled([
      !cachedTheAudioDb &&
      !metadataArtist?.tadbThumb &&
      !metadataArtist?.tadbCover
        ? theAudioDb.getArtistImages(artistData.artist_mbid)
        : Promise.resolve(null),
    ]);

    const artistImages =
      artistImagesResult.status === 'fulfilled'
        ? artistImagesResult.value
        : null;

    return res.status(200).json({
      artist: {
        ...artistDetails,
        artistThumb:
          cachedTheAudioDb?.artistThumb ??
          metadataArtist?.tadbThumb ??
          artistImages?.artistThumb ??
          null,
        artistBackdrop:
          cachedTheAudioDb?.artistBackground ??
          metadataArtist?.tadbCover ??
          artistImages?.artistBackground ??
          null,
      },
    });
  } catch (error) {
    logger.error('Something went wrong retrieving artist details', {
      label: 'Music API',
      errorMessage: error.message,
      artistId: req.params.id,
    });
    return next({ status: 500, message: 'Unable to retrieve artist details.' });
  }
});

musicRoutes.get('/:id/artist-discography', async (req, res, next) => {
  try {
    const listenbrainzApi = new ListenBrainzAPI();
    const metadataAlbumRepository = getRepository(MetadataAlbum);

    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const isSlider = req.query.slider === 'true';

    const albumData = await listenbrainzApi.getAlbum(req.params.id);
    const artistData = albumData?.release_group_metadata?.artist?.artists?.[0];
    const artistType = artistData?.type;

    if (!artistData?.artist_mbid || artistType === 'Other') {
      return res.status(404).json({
        status: 404,
        message: 'Artist details not available for this type',
      });
    }

    const artistDetails = await listenbrainzApi.getArtist(
      artistData.artist_mbid
    );

    if (!artistDetails) {
      return res.status(404).json({ status: 404, message: 'Artist not found' });
    }

    const totalReleaseGroups = artistDetails.releaseGroups.length;
    const paginatedReleaseGroups =
      isSlider || page === 1
        ? artistDetails.releaseGroups.slice(0, pageSize)
        : artistDetails.releaseGroups.slice(
            (page - 1) * pageSize,
            page * pageSize
          );

    const releaseGroupIds = paginatedReleaseGroups.map((rg) => rg.mbid);

    const mediaResponses = await Promise.allSettled([
      Media.getRelatedMedia(req.user, releaseGroupIds),
      metadataAlbumRepository.find({
        where: { mbAlbumId: In(releaseGroupIds) },
      }),
    ]);

    const relatedMedia =
      mediaResponses[0].status === 'fulfilled' ? mediaResponses[0].value : [];
    const albumMetadata =
      mediaResponses[1].status === 'fulfilled' ? mediaResponses[1].value : [];

    const albumMetadataMap = new Map(
      albumMetadata.map((metadata) => [metadata.mbAlbumId, metadata])
    );

    const relatedMediaMap = new Map(
      relatedMedia.map((media) => [media.mbId, media])
    );

    const transformedReleaseGroups = paginatedReleaseGroups.map(
      (releaseGroup) => {
        const metadata = albumMetadataMap.get(releaseGroup.mbid);
        return {
          id: releaseGroup.mbid,
          mediaType: 'album',
          title: releaseGroup.name,
          'first-release-date': releaseGroup.date,
          'artist-credit': [{ name: releaseGroup.artist_credit_name }],
          'primary-type': releaseGroup.type || 'Other',
          posterPath: metadata?.caaUrl ?? null,
          needsCoverArt: !metadata?.caaUrl,
          mediaInfo: relatedMediaMap.get(releaseGroup.mbid),
        };
      }
    );

    return res.status(200).json({
      page,
      totalPages: Math.ceil(totalReleaseGroups / pageSize),
      totalResults: totalReleaseGroups,
      results: transformedReleaseGroups,
    });
  } catch (error) {
    logger.error('Something went wrong retrieving artist discography', {
      label: 'Music API',
      errorMessage: error.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve artist discography.',
    });
  }
});

musicRoutes.get('/:id/artist-similar', async (req, res, next) => {
  try {
    const listenbrainzApi = new ListenBrainzAPI();
    const personMapper = new TmdbPersonMapper();
    const theAudioDb = new TheAudioDb();
    const metadataArtistRepository = getRepository(MetadataArtist);

    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

    const albumData = await listenbrainzApi.getAlbum(req.params.id);
    const artistData = albumData?.release_group_metadata?.artist?.artists?.[0];
    const artistType = artistData?.type;

    if (!artistData?.artist_mbid || artistType === 'Other') {
      return res.status(404).json({
        status: 404,
        message: 'Artist details not available for this type',
      });
    }

    const artistDetails = await listenbrainzApi.getArtist(
      artistData.artist_mbid
    );

    if (!artistDetails) {
      return res.status(404).json({ status: 404, message: 'Artist not found' });
    }

    const allSimilarArtists =
      artistDetails.similarArtists?.artists?.sort(
        (a, b) => b.score - a.score
      ) ?? [];

    const totalResults = allSimilarArtists.length;
    const totalPages = Math.ceil(totalResults / pageSize);

    const paginatedSimilarArtists = allSimilarArtists.slice(
      (page - 1) * pageSize,
      page * pageSize
    );

    const similarArtistIds = paginatedSimilarArtists.map((a) => a.artist_mbid);

    if (similarArtistIds.length === 0) {
      return res.status(200).json({
        page,
        totalPages,
        totalResults,
        results: [],
      });
    }

    const [similarArtistMetadataResult] = await Promise.allSettled([
      metadataArtistRepository.find({
        where: { mbArtistId: In(similarArtistIds) },
      }),
    ]);

    const similarArtistMetadata =
      similarArtistMetadataResult.status === 'fulfilled'
        ? similarArtistMetadataResult.value
        : [];

    const similarArtistMetadataMap = new Map(
      similarArtistMetadata.map((metadata) => [metadata.mbArtistId, metadata])
    );

    const artistsNeedingImages = similarArtistIds.filter((id) => {
      const metadata = similarArtistMetadataMap.get(id);
      return !metadata?.tadbThumb && !metadata?.tadbCover;
    });

    const personArtists =
      paginatedSimilarArtists
        .filter((artist) => artist.type === 'Person')
        .filter((artist) => {
          const metadata = similarArtistMetadataMap.get(artist.artist_mbid);
          return !metadata?.tmdbPersonId;
        })
        .map((artist) => ({
          artistId: artist.artist_mbid,
          artistName: artist.name,
        })) ?? [];

    type ArtistImageResults = Record<
      string,
      { artistThumb: string | null; artistBackground: string | null }
    >;

    const artistResponses = await Promise.allSettled([
      artistsNeedingImages.length > 0
        ? theAudioDb.batchGetArtistImages(artistsNeedingImages)
        : ({} as ArtistImageResults),
      personArtists.length > 0
        ? personMapper.batchGetMappings(personArtists).then(() =>
            metadataArtistRepository.find({
              where: { mbArtistId: In(similarArtistIds) },
            })
          )
        : Promise.resolve(similarArtistMetadata),
    ]);

    const artistImageResults =
      artistResponses[0].status === 'fulfilled' ? artistResponses[0].value : {};
    const updatedArtistMetadata =
      artistResponses[1].status === 'fulfilled'
        ? artistResponses[1].value
        : similarArtistMetadata;

    const finalArtistMetadataMap = new Map(
      (updatedArtistMetadata || similarArtistMetadata).map((metadata) => [
        metadata.mbArtistId,
        metadata,
      ])
    );

    const transformedSimilarArtists = paginatedSimilarArtists.map((artist) => {
      const metadata = finalArtistMetadataMap.get(artist.artist_mbid);
      const artistImageResult =
        artistImageResults[
          artist.artist_mbid as keyof typeof artistImageResults
        ];

      const artistThumb =
        metadata?.tadbThumb || (artistImageResult?.artistThumb ?? null);

      return {
        id: artist.artist_mbid,
        mediaType: 'artist',
        name: artist.name,
        type: artist.type as 'Group' | 'Person',
        artistThumb: metadata?.tmdbThumb ?? artistThumb,
        score: artist.score,
        tmdbPersonId: metadata?.tmdbPersonId
          ? Number(metadata.tmdbPersonId)
          : null,
        'sort-name': artist.name,
      };
    });

    return res.status(200).json({
      page,
      totalPages,
      totalResults,
      results: transformedSimilarArtists,
    });
  } catch (error) {
    logger.error('Something went wrong retrieving similar artists', {
      label: 'Music API',
      errorMessage: error.message,
      artistId: req.params.id,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve similar artists.',
    });
  }
});

export default musicRoutes;
