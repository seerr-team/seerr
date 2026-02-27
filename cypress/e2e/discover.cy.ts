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

  it('navigates from My Media Library slider to the library page', () => {
    cy.intercept('/api/v1/media?filter=allavailable*').as('getLibraryMedia');

    cy.visit('/');

    cy.contains('.slider-header .slider-title', 'My Media Library', {
      timeout: 20000,
    })
      .scrollIntoView()
      .should('be.visible')
      .click();

    cy.get('@getLibraryMedia.all').should('have.length.at.least', 1);

    cy.url().should('include', '/discover/library');
    cy.get('[data-testid=page-header]').should('contain', 'My Media Library');
  });
});
