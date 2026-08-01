describe('TV Details', () => {
  it('shows successful and temporarily unavailable household rows', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '/api/v1/trakt/watchstatus/tv/66732', {
      mediaType: 'tv',
      tmdbId: 66732,
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
          userId: 3,
          displayName: 'TV Partner',
          traktUsername: 'tv-partner',
          watched: false,
          watchedAt: null,
          status: 'temporarily_unavailable',
        },
      ],
    }).as('tvWatchStatus');

    // Try to load stranger things
    cy.visit('/tv/66732');
    cy.wait('@tvWatchStatus');

    cy.get('[data-testid=media-title]').should(
      'contain',
      'Stranger Things (2016)'
    );
    cy.get('[data-testid=trakt-watch-status-item]').should('have.length', 2);
    cy.get('[data-testid=trakt-watch-status]').within(() => {
      cy.contains('admin').should('be.visible');
      cy.get('[aria-label="Watched"]').should('be.visible');
      cy.contains('TV Partner').should('be.visible');
      cy.get('[aria-label="Temporarily unavailable"]').should('be.visible');
    });
  });

  it('shows seasons and expands episodes', () => {
    cy.loginAsAdmin();

    // Try to load stranger things
    cy.visit('/tv/66732');

    // intercept request for season info
    cy.intercept('/api/v1/tv/66732/season/4').as('season4');

    cy.contains('Season 4').should('be.visible').scrollIntoView().click();

    cy.wait('@season4');

    cy.contains('Chapter Nine').should('be.visible');
  });
});
