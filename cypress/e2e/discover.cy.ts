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

const discoverPage = (page: number, count: number, totalPages: number) => ({
  page,
  totalPages,
  totalResults: totalPages * 20,
  results: Array.from({ length: count }, (_, i) => ({
    id: page * 100 + i,
    mediaType: 'movie',
    title: `Movie ${page}-${i}`,
  })),
});

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

  it('keeps paging past a short page', () => {
    cy.intercept('/api/v1/discover/movies?page=1*', discoverPage(1, 20, 4));
    cy.intercept('/api/v1/discover/movies?page=2*', discoverPage(2, 20, 4));
    cy.intercept('/api/v1/discover/movies?page=3*', discoverPage(3, 19, 4));
    cy.intercept('/api/v1/discover/movies?page=4*', discoverPage(4, 20, 4)).as(
      'page4'
    );
    cy.visit('/discover/movies');
    cy.get('[data-testid=title-card]').should('have.length', 59);
    cy.scrollTo('bottom');
    cy.wait('@page4');
    cy.get('[data-testid=title-card]').should('have.length', 79);
  });

  it('skips a single failed page', () => {
    cy.intercept('/api/v1/discover/movies?page=1*', discoverPage(1, 20, 5));
    cy.intercept('/api/v1/discover/movies?page=2*', discoverPage(2, 20, 5));
    cy.intercept('/api/v1/discover/movies?page=3*', discoverPage(3, 20, 5));
    cy.intercept('/api/v1/discover/movies?page=4*', { statusCode: 500 }).as(
      'page4'
    );
    cy.intercept('/api/v1/discover/movies?page=5*', discoverPage(5, 20, 5)).as(
      'page5'
    );
    cy.visit('/discover/movies');
    cy.get('[data-testid=title-card]').should('have.length', 60);
    cy.scrollTo('bottom');
    cy.wait('@page4');
    cy.wait('@page4');
    cy.wait('@page5');
    cy.get('[data-testid=title-card]').should('have.length', 80);
  });

  it('keeps a page that succeeds on retry', () => {
    cy.intercept('/api/v1/discover/movies?page=1*', discoverPage(1, 20, 4));
    cy.intercept('/api/v1/discover/movies?page=2*', discoverPage(2, 20, 4));
    cy.intercept('/api/v1/discover/movies?page=3*', discoverPage(3, 20, 4));
    cy.intercept('/api/v1/discover/movies?page=4*', discoverPage(4, 20, 4)).as(
      'page4'
    );
    cy.intercept(
      { url: '/api/v1/discover/movies?page=4*', times: 1 },
      { statusCode: 500 }
    ).as('page4Failed');
    cy.visit('/discover/movies');
    cy.get('[data-testid=title-card]').should('have.length', 60);
    cy.scrollTo('bottom');
    cy.wait('@page4Failed');
    cy.wait('@page4');
    cy.get('[data-testid=title-card]').should('have.length', 80);
  });

  it('surfaces two failed pages in a row', () => {
    cy.intercept('/api/v1/discover/movies?page=1*', discoverPage(1, 20, 6));
    cy.intercept('/api/v1/discover/movies?page=2*', discoverPage(2, 20, 6));
    cy.intercept('/api/v1/discover/movies?page=3*', discoverPage(3, 20, 6));
    cy.intercept('/api/v1/discover/movies?page=4*', { statusCode: 500 }).as(
      'page4'
    );
    cy.intercept('/api/v1/discover/movies?page=5*', { statusCode: 500 }).as(
      'page5'
    );
    cy.visit('/discover/movies');
    cy.get('[data-testid=title-card]').should('have.length', 60);
    cy.scrollTo('bottom');
    cy.wait('@page4');
    cy.wait('@page4');
    cy.wait('@page5');
    cy.contains('Something went wrong. Please try again.').should('be.visible');
    cy.get('[data-testid=title-card]').should('have.length', 60);
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
            email: 'demo@seerr.dev',
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
            displayName: 'demo@seerr.dev',
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
});
