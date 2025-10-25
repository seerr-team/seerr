import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import CachedImage from '@app/components/Common/CachedImage';
import useDiscover from '@app/hooks/useDiscover';
import Error from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import type { MovieResult } from '@server/models/Search';
import type { ProductionCompany } from '@server/models/common';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.DiscoverStudioSlider', {
    trending: 'Trending from {studio}',
    new: 'New from {studio}',
    topRated: 'Top Rated from {studio}',
    genreFrom: '{genre} from {studio}',
});

interface DiscoverStudioSliderProps {
    sliderType: 'trending' | 'new' | 'top-rated' | 'genre';
}

const DiscoverStudioSlider = ({ sliderType }: DiscoverStudioSliderProps) => {
    const intl = useIntl();
    const router = useRouter();
    const studioId = router.query.studioId as string;
    const genreId = router.query.genreId as string;

    // Fetch studio info
    const { data: studioData } = useSWR<{
        studio: ProductionCompany;
    }>(`/api/v1/discover/movies/studio/${studioId}?page=1`);

    // Build the API endpoint based on slider type
    let apiEndpoint = `/api/v1/discover/movies/studio/${studioId}`;
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

    const studio = studioData?.studio;

    // Generate title based on slider type
    let pageTitle = '';
    if (sliderType === 'trending') {
        pageTitle = intl.formatMessage(messages.trending, { studio: studio?.name || '...' });
    } else if (sliderType === 'new') {
        pageTitle = intl.formatMessage(messages.new, { studio: studio?.name || '...' });
    } else if (sliderType === 'top-rated') {
        pageTitle = intl.formatMessage(messages.topRated, { studio: studio?.name || '...' });
    } else if (sliderType === 'genre') {
        // You can enhance this to fetch genre name if needed
        pageTitle = `Genre from ${studio?.name || '...'}`;
    }

    return (
        <>
            <PageTitle title={pageTitle} />
            <div className="mb-4">
                <Header>
                    {studio?.logoPath ? (
                        <div className="relative mb-6 flex h-24 justify-center sm:h-32">
                            <CachedImage
                                type="tmdb"
                                src={`https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)${studio.logoPath}`}
                                alt={studio.name}
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

export default DiscoverStudioSlider;
