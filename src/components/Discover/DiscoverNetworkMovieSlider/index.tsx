import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import CachedImage from '@app/components/Common/CachedImage';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MovieResult } from '@server/models/Search';
import type { TvNetwork } from '@server/models/common';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.DiscoverNetworkMovieSlider', {
    trending: 'Trending Movies on {network}',
    new: 'New Movies on {network}',
    topRated: 'Top Rated Movies on {network}',
    genreOn: '{genre} Movies on {network}',
});

interface DiscoverNetworkMovieSliderProps {
    sliderType: 'trending' | 'new' | 'top-rated' | 'genre';
}

const DiscoverNetworkMovieSlider = ({ sliderType }: DiscoverNetworkMovieSliderProps) => {
    const intl = useIntl();
    const router = useRouter();
    const networkId = router.query.networkId as string;
    const genreId = router.query.genreId as string;

    // Fetch network info
    const { data: networkData } = useSWR<{
        network: TvNetwork;
    }>(`/api/v1/discover/tv/network/${networkId}?page=1`);

    // Build the API endpoint based on slider type
    let apiEndpoint = `/api/v1/discover/movies/network/${networkId}`;
    if (sliderType === 'trending') {
        apiEndpoint += '/trending';
    } else if (sliderType === 'new') {
        apiEndpoint += '/new';
    } else if (sliderType === 'top-rated') {
        apiEndpoint += '/top-rated';
    } else if (sliderType === 'genre' && genreId) {
        apiEndpoint += `/genre/${genreId}`;
    }

    const {
        isLoadingInitialData,
        isEmpty,
        isLoadingMore,
        isReachingEnd,
        titles,
        fetchMore,
        error,
    } = useDiscover<MovieResult>(apiEndpoint);

    if (error) {
        return <Error statusCode={500} />;
    }

    const network = networkData?.network;

    // Generate title based on slider type
    let pageTitle = '';
    if (sliderType === 'trending') {
        pageTitle = intl.formatMessage(messages.trending, { network: network?.name || '...' });
    } else if (sliderType === 'new') {
        pageTitle = intl.formatMessage(messages.new, { network: network?.name || '...' });
    } else if (sliderType === 'top-rated') {
        pageTitle = intl.formatMessage(messages.topRated, { network: network?.name || '...' });
    } else if (sliderType === 'genre') {
        pageTitle = `Genre Movies on ${network?.name || '...'}`;
    }

    return (
        <>
            <PageTitle title={pageTitle} />
            <div className="mb-4">
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
                        pageTitle
                    )}
                </Header>
            </div>
            <ListView
                items={titles}
                isEmpty={isEmpty}
                isReachingEnd={isReachingEnd}
                isLoading={
                    isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
                }
                onScrollBottom={fetchMore}
            />
        </>
    );
};

export default DiscoverNetworkMovieSlider;
