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
  const personMapper = TmdbPersonMapper.getInstance();
  const theAudioDb = TheAudioDb.getInstance();

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
    ] = await Promise.all([
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

    const trackArtistsToMap = albumDetails.mediums
      .flatMap((medium) => medium.tracks)
      .flatMap((track) =>
        track.artists
          .filter((artist) => artist.artist_mbid)
          .filter(
            (artist) =>
              !trackArtistMetadata.some(
                (m) => m.mbArtistId === artist.artist_mbid && m.tmdbPersonId
              )
          )
          .map((artist) => ({
            artistId: artist.artist_mbid,
            artistName: artist.artist_credit_name,
          }))
      );

    const [artistImages, personMappingResult, updatedArtistMetadata] =
      await Promise.all([
        artistId && !metadataArtist?.tadbThumb && !metadataArtist?.tadbCover
          ? theAudioDb.getArtistImages(artistId)
          : Promise.resolve(null),
        artistId && isPerson && !metadataArtist?.tmdbPersonId
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
          : Promise.resolve(trackArtistMetadata),
      ]);

    const updatedMetadataArtist =
      personMappingResult && artistId
        ? await getRepository(MetadataArtist).findOne({
            where: { mbArtistId: artistId },
          })
        : metadataArtist;

    const mappedDetails = mapMusicDetails(albumDetails, media, onUserWatchlist);
    const finalTrackArtistMetadata =
      updatedArtistMetadata || trackArtistMetadata;

    return res.status(200).json({
      ...mappedDetails,
      posterPath: metadataAlbum?.caaUrl ?? null,
      needsCoverArt: !metadataAlbum?.caaUrl,
      artistWikipedia,
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
    const personMapper = TmdbPersonMapper.getInstance();
    const theAudioDb = TheAudioDb.getInstance();
    const metadataAlbumRepository = getRepository(MetadataAlbum);
    const metadataArtistRepository = getRepository(MetadataArtist);

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

    const [artistDetails, cachedTheAudioDb, metadataArtist] = await Promise.all(
      [
        listenbrainzApi.getArtist(artistData.artist_mbid),
        theAudioDb.getArtistImagesFromCache(artistData.artist_mbid),
        metadataArtistRepository.findOne({
          where: { mbArtistId: artistData.artist_mbid },
        }),
      ]
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
    const similarArtistIds =
      artistDetails.similarArtists?.artists?.map((a) => a.artist_mbid) ?? [];

    const [relatedMedia, albumMetadata, similarArtistMetadata] =
      await Promise.all([
        Media.getRelatedMedia(req.user, releaseGroupIds),
        metadataAlbumRepository.find({
          where: { mbAlbumId: In(releaseGroupIds) },
        }),
        similarArtistIds.length > 0
          ? metadataArtistRepository.find({
              where: { mbArtistId: In(similarArtistIds) },
            })
          : Promise.resolve([]),
      ]);

    const albumMetadataMap = new Map(
      albumMetadata.map((metadata) => [metadata.mbAlbumId, metadata])
    );

    const similarArtistMetadataMap = new Map(
      similarArtistMetadata.map((metadata) => [metadata.mbArtistId, metadata])
    );

    const artistsNeedingImages = similarArtistIds.filter((id) => {
      const metadata = similarArtistMetadataMap.get(id);
      return !metadata?.tadbThumb && !metadata?.tadbCover;
    });

    const personArtists =
      artistDetails.similarArtists?.artists
        ?.filter((artist) => artist.type === 'Person')
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

    const [artistImageResults, updatedArtistMetadata, artistImagesResult] =
      await Promise.all([
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
        !cachedTheAudioDb &&
        !metadataArtist?.tadbThumb &&
        !metadataArtist?.tadbCover
          ? theAudioDb.getArtistImages(artistData.artist_mbid)
          : Promise.resolve(null),
      ]);

    const relatedMediaMap = new Map(
      relatedMedia.map((media) => [media.mbId, media])
    );

    const finalArtistMetadataMap = new Map(
      (updatedArtistMetadata || similarArtistMetadata).map((metadata) => [
        metadata.mbArtistId,
        metadata,
      ])
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

    const transformedSimilarArtists =
      artistDetails.similarArtists?.artists?.map((artist) => {
        const metadata = finalArtistMetadataMap.get(artist.artist_mbid);
        const artistImageResult =
          artistImageResults[
            artist.artist_mbid as keyof typeof artistImageResults
          ];

        const artistThumb =
          metadata?.tadbThumb || (artistImageResult?.artistThumb ?? null);

        const artistBackground =
          metadata?.tadbCover || (artistImageResult?.artistBackground ?? null);

        return {
          ...artist,
          artistThumb: metadata?.tmdbThumb ?? artistThumb,
          artistBackground: artistBackground,
          tmdbPersonId: metadata?.tmdbPersonId
            ? Number(metadata.tmdbPersonId)
            : null,
        };
      }) ?? [];

    return res.status(200).json({
      artist: {
        ...artistDetails,
        artistThumb:
          cachedTheAudioDb?.artistThumb ??
          metadataArtist?.tadbThumb ??
          artistImagesResult?.artistThumb ??
          null,
        artistBackdrop:
          cachedTheAudioDb?.artistBackground ??
          metadataArtist?.tadbCover ??
          artistImagesResult?.artistBackground ??
          null,
        similarArtists: {
          ...artistDetails.similarArtists,
          artists: transformedSimilarArtists,
        },
        releaseGroups: transformedReleaseGroups,
        pagination: {
          page,
          pageSize,
          totalItems: totalReleaseGroups,
          totalPages: Math.ceil(totalReleaseGroups / pageSize),
        },
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

export default musicRoutes;
