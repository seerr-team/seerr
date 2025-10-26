import CachedImage from '@app/components/Common/CachedImage';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import MediaSlider from '@app/components/MediaSlider';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { TvNetwork } from '@server/models/common';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import { useState } from 'react';
import useSWR from 'swr';

// Network ID to Watch Provider ID mapping
// Using TMDB watch providers to show "movies available on" rather than "movies made by"
// This provides better results and matches user expectations for streaming services
const NETWORK_TO_PROVIDER_MAP: Record<string, string> = {
    '213': '8',      // Netflix
    '49': '384',     // HBO Max
    '1024': '9',     // Amazon Prime Video
    '2552': '350',   // Apple TV+
    '2739': '337',   // Disney+
    '453': '15',     // Hulu
    '4330': '531',   // Paramount+
    '3353': '387',   // Peacock
    '67': '37',      // Showtime
    '318': '43',     // Starz
    '174': '526',    // AMC+
    '64': '520',     // Discovery+
    '88': '1074',    // FX (no provider, falls back to company)
    '2093': '2093',  // A&E (no provider, falls back to company)
    '4': '3166',     // BBC (no provider, falls back to company)
};

const messages = defineMessages('components.Discover.DiscoverNetworkEnhanced', {
    networkSeries: '{network} Series',
    trending: 'Trending on {network}',
    new: 'New on {network}',
    topRated: 'Top Rated on {network}',
    allShows: 'All {network} Shows',
    seriesSection: 'Series',
    moviesSection: 'Movies',
    trendingMovies: 'Trending Movies on {network}',
    newMovies: 'New Movies on {network}',
    topRatedMovies: 'Top Rated Movies on {network}',
    allMovies: 'All {network} Movies',
    drama: 'Drama',
    comedy: 'Comedy',
    action: 'Action & Adventure',
    scifi: 'Sci-Fi & Fantasy',
    crime: 'Crime',
    mystery: 'Mystery',
    showSeries: 'TV Series',
    showMovies: 'Movies',
});

const DiscoverNetworkEnhanced = () => {
    const router = useRouter();
    const intl = useIntl();
    const networkId = router.query.networkId as string;
    const [contentType, setContentType] = useState<'series' | 'movies'>('series');

    // Get the watch provider ID for movies (falls back to networkId if not mapped)
    const providerId = NETWORK_TO_PROVIDER_MAP[networkId] || networkId;
    const watchRegion = 'US'; // Default region, could be made configurable
    
    // Calculate date for "new releases" (last 180 days - ~6 months)
    const newReleasesDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: networkData, error } = useSWR<{
        network: TvNetwork;
        results: unknown[];
    }>(`/api/v1/discover/tv/network/${networkId}?page=1`);

    if (error) {
        return <Error statusCode={500} />;
    }

    const network = networkData?.network;
    const title = network?.name || intl.formatMessage(messages.networkSeries, { network: '...' });

    // Define common TV genres
    const tvGenres = [
        { id: '18', key: 'drama', message: messages.drama },
        { id: '35', key: 'comedy', message: messages.comedy },
        { id: '10759', key: 'action', message: messages.action },
        { id: '10765', key: 'scifi', message: messages.scifi },
        { id: '80', key: 'crime', message: messages.crime },
        { id: '9648', key: 'mystery', message: messages.mystery },
    ];

    // Define common movie genres (using movie genre IDs, not TV genre IDs)
    const movieGenres = [
        { id: '28', key: 'action', message: messages.action },
        { id: '35', key: 'comedy', message: messages.comedy },
        { id: '18', key: 'drama', message: messages.drama },
        { id: '80', key: 'crime', message: messages.crime },
        { id: '878', key: 'scifi', message: messages.scifi },
        { id: '53', key: 'thriller', message: messages.mystery },
        { id: '12', key: 'adventure', message: messages.action },
        { id: '10749', key: 'romance', message: messages.drama },
    ];

    return (
        <>
            <PageTitle title={title} />
            <div className="mt-1 mb-5">
                <Header>
                    {network?.logoPath ? (
                        <div className="relative mb-6 flex h-24 justify-center sm:h-32">
                            <CachedImage
                                type="tmdb"
                                src={`https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)${network.logoPath}`}
                                alt={network.name}
                                className="object-contain"
                                fill
                            />
                        </div>
                    ) : (
                        title
                    )}
                </Header>
            </div>

            {/* Content Type Toggle */}
            <div className="mb-6 flex justify-center">
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button
                        type="button"
                        onClick={() => setContentType('series')}
                        className={`px-4 py-2 text-sm font-medium rounded-l-md border transition duration-300 ${contentType === 'series'
                                ? 'bg-indigo-600 text-white border-indigo-600 z-10'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                            }`}
                    >
                        {intl.formatMessage(messages.showSeries)}
                    </button>
                    <button
                        type="button"
                        onClick={() => setContentType('movies')}
                        className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b transition duration-300 ${contentType === 'movies'
                                ? 'bg-indigo-600 text-white border-indigo-600 z-10'
                                : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                            }`}
                    >
                        {intl.formatMessage(messages.showMovies)}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {/* TV Series Content */}
                {contentType === 'series' && (
                    <>
                        {/* Trending Slider */}
                        <MediaSlider
                            sliderKey={`network-${networkId}-trending`}
                            title={intl.formatMessage(messages.trending, { network: network?.name || '' })}
                            url={`/api/v1/discover/tv/network/${networkId}/trending`}
                            linkUrl={`/discover/tv/network/${networkId}/trending`}
                            hideWhenEmpty
                        />

                        {/* New Releases Slider */}
                        <MediaSlider
                            sliderKey={`network-${networkId}-new`}
                            title={intl.formatMessage(messages.new, { network: network?.name || '' })}
                            url={`/api/v1/discover/tv/network/${networkId}/new`}
                            linkUrl={`/discover/tv/network/${networkId}/new`}
                            hideWhenEmpty
                        />

                        {/* Top Rated Slider */}
                        <MediaSlider
                            sliderKey={`network-${networkId}-top-rated`}
                            title={intl.formatMessage(messages.topRated, { network: network?.name || '' })}
                            url={`/api/v1/discover/tv/network/${networkId}/top-rated`}
                            linkUrl={`/discover/tv/network/${networkId}/top-rated`}
                            hideWhenEmpty
                        />

                        {/* Genre Sliders */}
                        {tvGenres.map((genre) => (
                            <MediaSlider
                                key={`network-${networkId}-tv-genre-${genre.id}`}
                                sliderKey={`network-${networkId}-tv-genre-${genre.id}`}
                                title={`${intl.formatMessage(genre.message)} - ${network?.name || ''}`}
                                url={`/api/v1/discover/tv/network/${networkId}/genre/${genre.id}`}
                                linkUrl={`/discover/tv/network/${networkId}/genre/${genre.id}`}
                                hideWhenEmpty
                            />
                        ))}

                        {/* All Shows Slider */}
                        <MediaSlider
                            sliderKey={`network-${networkId}-all`}
                            title={intl.formatMessage(messages.allShows, { network: network?.name || '' })}
                            url={`/api/v1/discover/tv/network/${networkId}`}
                            linkUrl={`/discover/tv?network=${networkId}`}
                        />
                    </>
                )}

                {/* Movies Content */}
                {contentType === 'movies' && (
                    <>
                        {/* Top Rated Movies Slider */}
                        <MediaSlider
                            sliderKey={`network-${networkId}-movies-top-rated`}
                            title={intl.formatMessage(messages.topRatedMovies, { network: network?.name || '' })}
                            url={`/api/v1/discover/movies?watchProviders=${providerId}&watchRegion=${watchRegion}&sortBy=vote_average.desc`}
                            linkUrl={`/discover/movies?watchProviders=${providerId}&watchRegion=${watchRegion}&sortBy=vote_average.desc`}
                        />

                        {/* Movie Genre Sliders */}
                        {movieGenres.map((genre) => (
                            <MediaSlider
                                key={`network-${networkId}-movie-genre-${genre.id}`}
                                sliderKey={`network-${networkId}-movie-genre-${genre.id}`}
                                title={`${intl.formatMessage(genre.message)} Movies - ${network?.name || ''}`}
                                url={`/api/v1/discover/movies?watchProviders=${providerId}&watchRegion=${watchRegion}&genre=${genre.id}&sortBy=popularity.desc`}
                                linkUrl={`/discover/movies?watchProviders=${providerId}&watchRegion=${watchRegion}&genre=${genre.id}&sortBy=popularity.desc`}
                            />
                        ))}

                        {/* All Movies Slider */}
                        <MediaSlider
                            sliderKey={`network-${networkId}-all-movies`}
                            title={intl.formatMessage(messages.allMovies, { network: network?.name || '' })}
                            url={`/api/v1/discover/movies?watchProviders=${providerId}&watchRegion=${watchRegion}&sortBy=popularity.desc`}
                            linkUrl={`/discover/movies?watchProviders=${providerId}&watchRegion=${watchRegion}&sortBy=popularity.desc`}
                        />
                    </>
                )}
            </div>
        </>
    );
};

export default DiscoverNetworkEnhanced;
