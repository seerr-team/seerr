describe('Movie Details', () => {
  it('loads a movie page', () => {
    cy.loginAsAdmin();
    // Try to load minions: rise of gru
    cy.visit('/movie/438148');

    cy.get('[data-testid=media-title]').should(
      'contain',
      'Minions: The Rise of Gru (2022)'
    );
  });

  it('shows every watch-status row returned to an administrator', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '/api/v1/trakt/watchstatus/movie/438148', {
      mediaType: 'movie',
      tmdbId: 438148,
      items: [
        {
          userId: 1,
          displayName: 'admin',
          traktUsername: 'household-admin',
          watched: true,
          watchedAt: '2026-07-30T20:00:00.000Z',
          status: 'ok',
        },
        {
          userId: 2,
          displayName: 'Movie Partner',
          traktUsername: 'movie-partner',
          watched: false,
          watchedAt: null,
          status: 'ok',
        },
      ],
    }).as('movieWatchStatus');

    // Try to load minions: rise of gru
    cy.visit('/movie/438148');
    cy.wait('@movieWatchStatus');

    cy.get('[data-testid=media-title]').should(
      'contain',
      'Minions: The Rise of Gru (2022)'
    );
    cy.get('[data-testid=trakt-watch-status-item]').should('have.length', 2);
    cy.get('[data-testid=trakt-watch-status]').within(() => {
      cy.contains('admin').should('be.visible');
      cy.get('[aria-label="Watched"]').should('be.visible');
      cy.contains('Jul 30, 2026').should('be.visible');
      cy.contains('Movie Partner').should('be.visible');
      cy.get('[aria-label="Not watched"]').should('be.visible');
    });
  });

  it('shows only the ordinary user row returned by the API', () => {
    cy.loginAsUser();
    cy.intercept('GET', '/api/v1/trakt/watchstatus/movie/438148', {
      mediaType: 'movie',
      tmdbId: 438148,
      items: [
        {
          userId: 2,
          displayName: 'Movie User',
          traktUsername: 'movie-user',
          watched: false,
          watchedAt: null,
          status: 'ok',
        },
      ],
    }).as('movieUserWatchStatus');

    cy.visit('/movie/438148');
    cy.wait('@movieUserWatchStatus');

    cy.get('[data-testid=trakt-watch-status-item]').should('have.length', 1);
    cy.get('[data-testid=trakt-watch-status]').within(() => {
      cy.contains('Movie User').should('be.visible');
      cy.get('[aria-label="Not watched"]').should('be.visible');
      cy.contains('Movie Partner').should('not.exist');
    });
  });

  it('hides watch status when the API returns no visible connections', () => {
    cy.loginAsUser();
    cy.intercept('GET', '/api/v1/trakt/watchstatus/movie/438148', {
      mediaType: 'movie',
      tmdbId: 438148,
      items: [],
    }).as('emptyMovieWatchStatus');

    cy.visit('/movie/438148');
    cy.wait('@emptyMovieWatchStatus');

    cy.get('[data-testid=trakt-watch-status]').should('not.exist');
  });

  it('shows an accessible loading state before rendering watch status', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '/api/v1/trakt/watchstatus/movie/438148', {
      delay: 2000,
      statusCode: 200,
      body: {
        mediaType: 'movie',
        tmdbId: 438148,
        items: [
          {
            userId: 1,
            displayName: 'Loading Admin',
            traktUsername: 'loading-admin',
            watched: true,
            watchedAt: '2026-07-30T20:00:00.000Z',
            status: 'ok',
          },
        ],
      },
    }).as('delayedMovieWatchStatus');

    cy.visit('/movie/438148');

    cy.get('[role=status][aria-busy=true]')
      .should('be.visible')
      .and('have.attr', 'aria-label', 'Loading Trakt watch status')
      .find('[aria-hidden=true]')
      .should('be.visible');

    cy.wait('@delayedMovieWatchStatus');
    cy.get('[role=status]').should('not.exist');
    cy.get('[data-testid=trakt-watch-status]').within(() => {
      cy.contains('Loading Admin').should('be.visible');
      cy.get('[aria-label="Watched"]').should('be.visible');
    });
  });

  it('hides watch status after a transport error and keeps details usable', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '/api/v1/trakt/watchstatus/movie/438148', {
      delay: 1000,
      statusCode: 500,
      body: { message: 'Temporary Trakt failure' },
    }).as('failedMovieWatchStatus');

    cy.visit('/movie/438148');
    cy.get('[role=status][aria-busy=true]').should('be.visible');

    cy.wait('@failedMovieWatchStatus')
      .its('response.statusCode')
      .should('eq', 500);
    cy.get('[role=status]').should('not.exist');
    cy.get('[data-testid=trakt-watch-status]').should('not.exist');
    cy.get('[data-testid=media-title]')
      .should('be.visible')
      .and('contain', 'Minions: The Rise of Gru (2022)');
  });

  it('does not request or render watch status for an unauthenticated visit', () => {
    cy.intercept('GET', '/api/v1/trakt/watchstatus/movie/438148').as(
      'unauthenticatedMovieWatchStatus'
    );

    cy.visit('/movie/438148');

    cy.location('pathname').should('eq', '/login');
    cy.get('@unauthenticatedMovieWatchStatus.all').should('have.length', 0);
    cy.get('[role=status]').should('not.exist');
    cy.get('[data-testid=trakt-watch-status]').should('not.exist');
  });

  it('does not reopen the manager panel after closing and going back', () => {
    cy.loginAsAdmin();

    cy.visit('/movie/438148');
    cy.visit('/movie/438148?manage=1');

    cy.get('button[aria-label="Close panel"]').should('be.visible').click();
    cy.location('search').should('eq', '');
    cy.get('button[aria-label="Close panel"]').should('not.exist');

    cy.go('back');

    cy.location('search').should('eq', '');
    cy.get('button[aria-label="Close panel"]').should('not.exist');
  });
});
