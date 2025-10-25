import CachedImage from '@app/components/Common/CachedImage';
import Header from '@app/components/Common/Header';
import PageTitle from '@app/components/Common/PageTitle';
import MediaSlider from '@app/components/MediaSlider';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { TvNetwork } from '@server/models/common';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

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
});

const DiscoverNetworkEnhanced = () => {
    const router = useRouter();
    const intl = useIntl();
    const networkId = router.query.networkId as string;

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

    // Define common movie genres
    const movieGenres = [
        { id: '28', key: 'action', message: messages.action },
        { id: '35', key: 'comedy', message: messages.comedy },
        { id: '18', key: 'drama', message: messages.drama },
        { id: '80', key: 'crime', message: messages.crime },
        { id: '878', key: 'scifi', message: messages.scifi },
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

            <div className="space-y-6">
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

                {/* Movies Section */}
                <div className="mt-12 mb-6">
                    <h2 className="text-2xl font-bold">{intl.formatMessage(messages.moviesSection)}</h2>
                </div>

                {/* Trending Movies Slider */}
                <MediaSlider
                    sliderKey={`network-${networkId}-movies-trending`}
                    title={intl.formatMessage(messages.trendingMovies, { network: network?.name || '' })}
                    url={`/api/v1/discover/movies/network/${networkId}/trending`}
                    linkUrl={`/discover/movies/network/${networkId}/trending`}
                />

                {/* New Movies Slider */}
                <MediaSlider
                    sliderKey={`network-${networkId}-movies-new`}
                    title={intl.formatMessage(messages.newMovies, { network: network?.name || '' })}
                    url={`/api/v1/discover/movies/network/${networkId}/new`}
                    linkUrl={`/discover/movies/network/${networkId}/new`}
                />

                {/* Top Rated Movies Slider */}
                <MediaSlider
                    sliderKey={`network-${networkId}-movies-top-rated`}
                    title={intl.formatMessage(messages.topRatedMovies, { network: network?.name || '' })}
                    url={`/api/v1/discover/movies/network/${networkId}/top-rated`}
                    linkUrl={`/discover/movies/network/${networkId}/top-rated`}
                    hideWhenEmpty
                />

                {/* Movie Genre Sliders */}
                {movieGenres.map((genre) => (
                    <MediaSlider
                        key={`network-${networkId}-movie-genre-${genre.id}`}
                        sliderKey={`network-${networkId}-movie-genre-${genre.id}`}
                        title={`${intl.formatMessage(genre.message)} Movies - ${network?.name || ''}`}
                        url={`/api/v1/discover/movies/network/${networkId}/genre/${genre.id}`}
                        linkUrl={`/discover/movies/network/${networkId}/genre/${genre.id}`}
                        hideWhenEmpty
                    />
                ))}

                {/* All Movies Slider */}
                <MediaSlider
                    sliderKey={`network-${networkId}-all-movies`}
                    title={intl.formatMessage(messages.allMovies, { network: network?.name || '' })}
                    url={`/api/v1/discover/movies/network/${networkId}`}
                    linkUrl={`/discover/movies?studio=${networkId}`}
                    hideWhenEmpty
                />
            </div>
        </>
    );
};

export default DiscoverNetworkEnhanced;
