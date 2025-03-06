import MusicBrainz from '@server/api/musicbrainz';
import TheAudioDb from '@server/api/theaudiodb';
import TheMovieDb from '@server/api/themoviedb';
import TmdbPersonMapper from '@server/api/themoviedb/personMapper';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import MetadataAlbum from '@server/entity/MetadataAlbum';
import MetadataArtist from '@server/entity/MetadataArtist';
import {
  findSearchProvider,
  type CombinedSearchResponse,
} from '@server/lib/search';
import logger from '@server/logger';
import { mapSearchResults } from '@server/models/Search';
import { Router } from 'express';
import { In } from 'typeorm';

const searchRoutes = Router();

const ITEMS_PER_PAGE = 20;
searchRoutes.get('/', async (req, res, next) => {
  const queryString = req.query.query as string;
  const page = Number(req.query.page) || 1;
  const language = (req.query.language as string) ?? req.locale;

  try {
    const searchProvider = findSearchProvider(queryString.toLowerCase());
    let results: CombinedSearchResponse;

    if (searchProvider) {
      const [id] = queryString
        .toLowerCase()
        .match(searchProvider.pattern) as RegExpMatchArray;
      results = await searchProvider.search({
        id,
        language,
        query: queryString,
      });
    } else {
      const tmdb = new TheMovieDb();
      const musicbrainz = new MusicBrainz();
      const theAudioDb = TheAudioDb.getInstance();
      const personMapper = TmdbPersonMapper.getInstance();

      const [tmdbResults, albumResults, artistResults] = await Promise.all([
        tmdb.searchMulti({
          query: queryString,
          page,
          language,
        }),
        musicbrainz.searchAlbum({
          query: queryString,
          limit: ITEMS_PER_PAGE,
        }),
        musicbrainz.searchArtist({
          query: queryString,
          limit: ITEMS_PER_PAGE,
        }),
      ]);

      const personIds = tmdbResults.results
        .filter(
          (result) => result.media_type === 'person' && !result.profile_path
        )
        .map((p) => p.id.toString());

      const albumIds = albumResults.map((album) => album.id);
      const artistIds = artistResults.map((artist) => artist.id);
      const tmdbPersonIds = tmdbResults.results
        .filter((result) => result.media_type === 'person')
        .map((person) => person.id.toString());

      const [artistMetadata, albumMetadata, artistsMetadata, existingMappings] =
        await Promise.all([
          personIds.length > 0
            ? getRepository(MetadataArtist).find({
                where: { tmdbPersonId: In(personIds) },
                cache: true,
                select: ['tmdbPersonId', 'tadbThumb', 'tadbCover'],
              })
            : [],
          albumIds.length > 0
            ? getRepository(MetadataAlbum).find({
                where: { mbAlbumId: In(albumIds) },
                cache: true,
                select: ['mbAlbumId', 'caaUrl'],
              })
            : [],
          artistIds.length > 0
            ? getRepository(MetadataArtist).find({
                where: { mbArtistId: In(artistIds) },
                cache: true,
                select: [
                  'mbArtistId',
                  'tmdbPersonId',
                  'tadbThumb',
                  'tadbCover',
                ],
              })
            : [],
          tmdbPersonIds.length > 0
            ? getRepository(MetadataArtist).find({
                where: { tmdbPersonId: In(tmdbPersonIds) },
                cache: true,
                select: ['mbArtistId', 'tmdbPersonId'],
              })
            : [],
        ]);

      const artistMetadataMap = new Map(
        artistMetadata.map((m) => [m.tmdbPersonId, m])
      );

      const albumMetadataMap = new Map(
        albumMetadata.map((m) => [m.mbAlbumId, m])
      );

      const artistsMetadataMap = new Map(
        artistsMetadata.map((m) => [m.mbArtistId, m])
      );

      const existingMappingsMap = new Map(
        existingMappings.map((m) => [m.mbArtistId, m.tmdbPersonId])
      );

      const personsWithoutImages = tmdbResults.results.filter(
        (result) => result.media_type === 'person' && !result.profile_path
      );

      personsWithoutImages.forEach((person) => {
        const metadata = artistMetadataMap.get(person.id.toString());
        if (metadata?.tadbThumb) {
          Object.assign(person, {
            profile_path: metadata.tadbThumb,
            artist_backdrop: metadata.tadbCover,
          });
        }
      });

      const artistsNeedingMapping = artistResults
        .filter(
          (artist) =>
            artist.type === 'Person' &&
            !artistsMetadataMap.get(artist.id)?.tmdbPersonId
        )
        .map((artist) => ({
          artistId: artist.id,
          artistName: artist.name,
        }));

      const artistsNeedingImages = artistIds.filter((id) => {
        const metadata = artistsMetadataMap.get(id);
        return !metadata?.tadbThumb && !metadata?.tadbCover;
      });

      type PersonMappingResult = Record<
        string,
        { personId: number | null; profilePath: string | null }
      >;
      type ArtistImageResult = Record<
        string,
        { artistThumb: string | null; artistBackground: string | null }
      >;

      const [personMappingResults, artistImageResults] = await Promise.all([
        artistsNeedingMapping.length > 0
          ? personMapper.batchGetMappings(artistsNeedingMapping)
          : ({} as PersonMappingResult),
        artistsNeedingImages.length > 0
          ? theAudioDb.batchGetArtistImages(artistsNeedingImages)
          : ({} as ArtistImageResult),
      ]);

      let updatedArtistsMetadataMap = artistsMetadataMap;
      if (
        (artistsNeedingMapping.length > 0 || artistsNeedingImages.length > 0) &&
        artistIds.length > 0
      ) {
        const updatedArtistsMetadata = await getRepository(MetadataArtist).find(
          {
            where: { mbArtistId: In(artistIds) },
            cache: true,
            select: ['mbArtistId', 'tmdbPersonId', 'tadbThumb', 'tadbCover'],
          }
        );

        updatedArtistsMetadataMap = new Map(
          updatedArtistsMetadata.map((m) => [m.mbArtistId, m])
        );
      }

      const albumsWithArt = albumResults.map((album) => {
        const metadata = albumMetadataMap.get(album.id);

        return {
          ...album,
          media_type: 'album' as const,
          posterPath: metadata?.caaUrl ?? undefined,
          needsCoverArt: !metadata?.caaUrl,
          score: album.score || 0,
        };
      });

      const artistsWithArt = artistResults
        .map((artist) => {
          const metadata = updatedArtistsMetadataMap.get(artist.id);
          const personMapping = personMappingResults[artist.id];
          const hasTmdbPersonId =
            metadata?.tmdbPersonId || personMapping?.personId !== null;

          if (artist.type === 'Person' && hasTmdbPersonId) {
            return null;
          }

          const artistThumb =
            metadata?.tadbThumb ||
            (artistImageResults[artist.id]?.artistThumb ?? null);

          const artistBackdrop =
            metadata?.tadbCover ||
            (artistImageResults[artist.id]?.artistBackground ?? null);

          return {
            ...artist,
            media_type: 'artist' as const,
            artistThumb,
            artistBackdrop,
            score: artist.score || 0,
          };
        })
        .filter(
          (artist): artist is NonNullable<typeof artist> => artist !== null
        );

      const filteredArtists = artistsWithArt.filter((artist) => {
        const tmdbPersonId = existingMappingsMap.get(artist.id);
        return !tmdbPersonId || !tmdbPersonIds.includes(tmdbPersonId);
      });

      const musicResults = [...albumsWithArt, ...filteredArtists].sort(
        (a, b) => (b.score || 0) - (a.score || 0)
      );

      const totalItems = tmdbResults.total_results + musicResults.length;
      const totalPages = Math.max(
        tmdbResults.total_pages,
        Math.ceil(totalItems / ITEMS_PER_PAGE)
      );

      const combinedResults =
        page === 1
          ? [...tmdbResults.results, ...musicResults]
          : tmdbResults.results;

      results = {
        page: tmdbResults.page,
        total_pages: totalPages,
        total_results: totalItems,
        results: combinedResults,
      };
    }

    const movieTvIds = results.results
      .filter(
        (result) => result.media_type === 'movie' || result.media_type === 'tv'
      )
      .map((result) => Number(result.id));

    const musicIds = results.results
      .filter(
        (result) =>
          result.media_type === 'album' || result.media_type === 'artist'
      )
      .map((result) => result.id.toString());

    const [movieTvMedia, musicMedia] = await Promise.all([
      movieTvIds.length > 0 ? Media.getRelatedMedia(req.user, movieTvIds) : [],
      musicIds.length > 0 ? Media.getRelatedMedia(req.user, musicIds) : [],
    ]);

    const media = [...movieTvMedia, ...musicMedia];

    const mappedResults = await mapSearchResults(results.results, media);

    return res.status(200).json({
      page: results.page,
      totalPages: results.total_pages,
      totalResults: results.total_results,
      results: mappedResults,
    });
  } catch (e) {
    logger.debug('Something went wrong retrieving search results', {
      label: 'API',
      errorMessage: e instanceof Error ? e.message : 'Unknown error',
      query: queryString,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve search results.',
    });
  }
});

searchRoutes.get('/keyword', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const results = await tmdb.searchKeyword({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.debug('Something went wrong retrieving keyword search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve keyword search results.',
    });
  }
});

searchRoutes.get('/company', async (req, res, next) => {
  const tmdb = new TheMovieDb();

  try {
    const results = await tmdb.searchCompany({
      query: req.query.query as string,
      page: Number(req.query.page),
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.debug('Something went wrong retrieving company search results', {
      label: 'API',
      errorMessage: e.message,
      query: req.query.query,
    });
    return next({
      status: 500,
      message: 'Unable to retrieve company search results.',
    });
  }
});

export default searchRoutes;
