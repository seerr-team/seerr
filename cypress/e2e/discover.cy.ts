const clickFirstTitleCardInSlider = (sliderTitle: string): void => {
  cy.contains('.slider-header', sliderTitle)
    .next('[data-testid=media-slider]')
    .find('[data-testid=title-card]')
    .first()
    .trigger('mouseover')
    .find('[data-testid=title-card-title]')
    .invoke('text')
    .then((text) => {
      cy.contains('.slider-header', sliderTitle)
        .next('[data-testid=media-slider]')
        .find('[data-testid=title-card]')
        .first()
        .click();
      cy.get('[data-testid=media-title]').should('contain', text);
    });
};

const seasonalAnimeResponse = {
  page: 1,
  totalPages: 1,
  totalResults: 1,
  results: [
    {
      id: 123,
      ratingKey: 'seasonal-anime-123',
      tmdbId: 123,
      mediaType: 'tv',
      title: 'Seasonal Test Anime',
    },
  ],
};

const seasonalAnimeDetails = {
  id: 123,
  name: 'Seasonal Test Anime',
  overview: 'A seasonal anime used by the Discover frontend test.',
  posterPath: null,
  voteAverage: 8,
  firstAirDate: '2026-01-01',
  mediaInfo: { watchlists: [] },
};

describe('Discover', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('loads a trending item', () => {
    cy.intercept('/api/v1/discover/trending*').as('getTrending');
    cy.visit('/');
    cy.wait('@getTrending');
    clickFirstTitleCardInSlider('Trending');
  });

  it('loads popular movies', () => {
    cy.intercept('/api/v1/discover/movies*').as('getPopularMovies');
    cy.visit('/');
    cy.wait('@getPopularMovies');
    clickFirstTitleCardInSlider('Popular Movies');
  });

  it('loads upcoming movies', () => {
    cy.intercept('/api/v1/discover/movies?page=1&primaryReleaseDateGte*').as(
      'getUpcomingMovies'
    );
    cy.visit('/');
    cy.wait('@getUpcomingMovies');
    clickFirstTitleCardInSlider('Upcoming Movies');
  });

  it('loads popular series', () => {
    cy.intercept('/api/v1/discover/tv*').as('getPopularTv');
    cy.visit('/');
    cy.wait('@getPopularTv');
    clickFirstTitleCardInSlider('Popular Series');
  });

  it('loads upcoming series', () => {
    cy.intercept('/api/v1/discover/tv?page=1&firstAirDateGte=*').as(
      'getUpcomingSeries'
    );
    cy.visit('/');
    cy.wait('@getUpcomingSeries');
    clickFirstTitleCardInSlider('Upcoming Series');
  });

  it('displays error for media with invalid TMDB ID', () => {
    cy.intercept('GET', '/api/v1/media?*', {
      pageInfo: { pages: 1, pageSize: 20, results: 1, page: 1 },
      results: [
        {
          downloadStatus: [],
          downloadStatus4k: [],
          id: 1922,
          mediaType: 'movie',
          tmdbId: 998814,
          tvdbId: null,
          imdbId: null,
          status: 5,
          status4k: 1,
          createdAt: '2022-08-18T18:11:13.000Z',
          updatedAt: '2022-08-18T19:56:41.000Z',
          lastSeasonChange: '2022-08-18T19:56:41.000Z',
          mediaAddedAt: '2022-08-18T19:56:41.000Z',
          serviceId: null,
          serviceId4k: null,
          externalServiceId: null,
          externalServiceId4k: null,
          externalServiceSlug: null,
          externalServiceSlug4k: null,
          ratingKey: null,
          ratingKey4k: null,
          seasons: [],
        },
      ],
    }).as('getMedia');

    cy.visit('/');
    cy.wait('@getMedia');
    cy.contains('.slider-header', 'Recently Added')
      .next('[data-testid=media-slider]')
      .find('[data-testid=title-card]')
      .first()
      .find('[data-testid=title-card-title]')
      .contains('Movie Not Found');
  });

  it('displays error for request with invalid TMDB ID', () => {
    cy.intercept('GET', '/api/v1/request?*', {
      pageInfo: { pages: 1, pageSize: 10, results: 1, page: 1 },
      results: [
        {
          id: 582,
          status: 1,
          createdAt: '2022-08-18T18:11:13.000Z',
          updatedAt: '2022-08-18T18:11:13.000Z',
          type: 'movie',
          is4k: false,
          serverId: null,
          profileId: null,
          rootFolder: null,
          languageProfileId: null,
          tags: null,
          media: {
            downloadStatus: [],
            downloadStatus4k: [],
            id: 1922,
            mediaType: 'movie',
            tmdbId: 998814,
            tvdbId: null,
            imdbId: null,
            status: 2,
            status4k: 1,
            createdAt: '2022-08-18T18:11:13.000Z',
            updatedAt: '2022-08-18T18:11:13.000Z',
            lastSeasonChange: '2022-08-18T18:11:13.000Z',
            mediaAddedAt: null,
            serviceId: null,
            serviceId4k: null,
            externalServiceId: null,
            externalServiceId4k: null,
            externalServiceSlug: null,
            externalServiceSlug4k: null,
            ratingKey: null,
            ratingKey4k: null,
          },
          seasons: [],
          modifiedBy: null,
          requestedBy: {
            permissions: 4194336,
            id: 18,
            email: 'friend@seerr.dev',
            plexUsername: null,
            username: '',
            recoveryLinkExpirationDate: null,
            userType: 2,
            avatar:
              'https://gravatar.com/avatar/c77fdc27cab83732b8623d2ea873d330?default=mm&size=200',
            movieQuotaLimit: null,
            movieQuotaDays: null,
            tvQuotaLimit: null,
            tvQuotaDays: null,
            createdAt: '2022-08-17T04:55:28.000Z',
            updatedAt: '2022-08-17T04:55:28.000Z',
            requestCount: 1,
            displayName: 'friend@seerr.dev',
          },
          seasonCount: 0,
        },
      ],
    }).as('getRequests');

    cy.visit('/');
    cy.wait('@getRequests');
    cy.contains('.slider-header', 'Recent Requests')
      .next('[data-testid=media-slider]')
      .find('[data-testid=request-card]')
      .first()
      .find('[data-testid=request-card-title]')
      .contains('Movie Not Found');
  });

  it('loads plex watchlist', () => {
    cy.intercept('/api/v1/discover/watchlist', {
      fixture: 'watchlist.json',
    }).as('getWatchlist');
    // Wait for one of the watchlist movies to resolve
    cy.intercept('/api/v1/movie/361743').as('getTmdbMovie');

    cy.visit('/');

    cy.wait('@getWatchlist');

    const sliderHeader = cy.contains('.slider-header', 'Watchlist');

    sliderHeader.scrollIntoView();

    cy.wait('@getTmdbMovie');
    // Wait a little longer to make sure the movie component reloaded
    cy.wait(500);

    sliderHeader
      .next('[data-testid=media-slider]')
      .find('[data-testid=title-card]')
      .first()
      .trigger('mouseover')
      .find('[data-testid=title-card-title]')
      .invoke('text')
      .then((text) => {
        cy.contains('.slider-header', 'Watchlist')
          .next('[data-testid=media-slider]')
          .find('[data-testid=title-card]')
          .first()
          .click();
        cy.get('[data-testid=media-title]').should('contain', text);
      });
  });

  it('does not treat seasonal anime as watchlisted', () => {
    const localUserType = 2;

    cy.intercept('GET', '/api/v1/auth/me', (request) => {
      request.continue((response) => {
        response.body.userType = localUserType;
      });
    });
    cy.intercept('GET', '/api/v1/discover/anime*').as('getAnimeDiscover');
    cy.intercept('GET', '/api/v1/discover/seasonal-anime*', {
      body: seasonalAnimeResponse,
    }).as('getSeasonalAnime');
    cy.intercept('GET', '/api/v1/tv/123', {
      body: seasonalAnimeDetails,
    }).as('getSeasonalAnimeDetails');
    cy.intercept('POST', '/api/v1/watchlist', {
      statusCode: 201,
      body: {},
    }).as('addSeasonalAnimeToWatchlist');
    cy.intercept('DELETE', '/api/v1/watchlist/123?mediaType=tv').as(
      'deleteSeasonalAnimeFromWatchlist'
    );

    cy.visit('/discover/anime?seasonal=true');
    cy.wait('@getSeasonalAnime');
    cy.get('@getSeasonalAnime.all').should('have.length', 1);
    cy.get('@getAnimeDiscover.all').should('have.length', 0);
    cy.get('[data-testid=title-card]')
      .should('have.length', 1)
      .first()
      .scrollIntoView()
      .trigger('mouseover');
    cy.wait('@getSeasonalAnimeDetails');
    cy.get('[data-testid=title-card]').first().trigger('mouseover');
    cy.get('[data-testid=title-card]').first().find('button').first().click();

    cy.wait('@addSeasonalAnimeToWatchlist');
    cy.get('@deleteSeasonalAnimeFromWatchlist.all').should('have.length', 0);
  });

  it('allows retrying a failed seasonal anime request', () => {
    let allowSeasonalAnimeRequest = false;

    cy.intercept('GET', '/api/v1/discover/seasonal-anime*', (request) => {
      if (!allowSeasonalAnimeRequest) {
        request.reply({
          statusCode: 500,
          body: { message: 'Seasonal anime unavailable' },
        });
      } else {
        request.reply({ body: seasonalAnimeResponse });
      }
    }).as('getSeasonalAnime');
    cy.intercept('GET', '/api/v1/tv/123', {
      body: seasonalAnimeDetails,
    }).as('getSeasonalAnimeDetails');

    cy.visit('/discover/anime?seasonal=true');
    cy.wait('@getSeasonalAnime');
    cy.get('[data-testid=discover-anime-error]')
      .should('be.visible')
      .then(() => {
        allowSeasonalAnimeRequest = true;
      });
    cy.get('[data-testid=discover-anime-retry]').click();
    cy.wait('@getSeasonalAnime');
    cy.wait('@getSeasonalAnimeDetails');
    cy.get('[data-testid=title-card]').should('exist');
  });
});
