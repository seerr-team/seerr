describe('User Profile', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('opens user profile page from the home page', () => {
    cy.visit('/');

    cy.get('[data-testid=user-menu]').click();
    cy.get('[data-testid=user-menu-profile]').click();

    cy.get('h1').should('contain', Cypress.expose('ADMIN_EMAIL'));
  });

  it('loads plex watchlist', () => {
    // Title cards only load once they're on screen, so fit the watchlist without scrolling
    cy.viewport(1000, 1200);
    cy.intercept('/api/v1/user/[0-9]*/watchlist', {
      fixture: 'watchlist.json',
    }).as('getWatchlist');
    // Wait for one of the watchlist movies to resolve
    cy.intercept('/api/v1/movie/361743').as('getTmdbMovie');

    cy.visit('/profile');

    cy.wait('@getWatchlist');
    cy.wait('@getTmdbMovie');
    // Wait a little longer to make sure the movie component reloaded
    cy.wait(500);

    cy.contains('.slider-header', 'Plex Watchlist')
      .next('[data-testid=media-slider]')
      .find('[data-testid=title-card]')
      .first()
      .trigger('mouseover')
      .find('[data-testid=title-card-title]')
      .invoke('text')
      .then((text) => {
        cy.contains('.slider-header', 'Plex Watchlist')
          .next('[data-testid=media-slider]')
          .find('[data-testid=title-card]')
          .first()
          .click();
        cy.get('[data-testid=media-title]').should('contain', text);
      });
  });
});
