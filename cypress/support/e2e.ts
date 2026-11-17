import './commands';

before(() => {
  if (Cypress.expose('SEED_DATABASE')) {
    cy.exec('pnpm cypress:prepare');
  }
});

// The seeded Plex token is fake, so plex.tv rejects every real watchlist fetch
beforeEach(() => {
  const emptyWatchlist = {
    page: 1,
    totalPages: 1,
    totalResults: 0,
    results: [],
  };

  cy.intercept('GET', '/api/v1/discover/watchlist*', emptyWatchlist);
  cy.intercept('GET', '/api/v1/user/*/watchlist*', emptyWatchlist);
});
