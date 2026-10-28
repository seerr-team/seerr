const visitUserEditPage = (email: string): void => {
  cy.visit('/users');

  cy.contains('[data-testid=user-list-row]', email).contains('Edit').click();
};

describe('Auto Request Settings', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('should not see watchlist sync settings on an account without permissions', () => {
    visitUserEditPage(Cypress.expose('USER_EMAIL'));

    cy.contains('Auto-Request Movies').should('not.exist');
    cy.contains('Auto-Request Series').should('not.exist');
  });

  it('should see watchlist sync settings on an admin account', () => {
    visitUserEditPage(Cypress.expose('ADMIN_EMAIL'));

    cy.contains('Auto-Request Movies').should('exist');
    cy.contains('Auto-Request Series').should('exist');
  });

  it('should see auto-request settings after being given permission', () => {
    visitUserEditPage(Cypress.expose('USER_EMAIL'));

    cy.get('[data-testid=settings-nav-desktop').contains('Permissions').click();

    cy.get('#autorequest').should('not.be.checked').click();

    cy.intercept('/api/v1/user/*/settings/permissions').as('userPermissions');

    cy.contains('Save Changes').click();

    cy.wait('@userPermissions');

    cy.reload();

    cy.get('#autorequest').should('be.checked');
    cy.get('#autorequestmovies').should('be.checked');
    cy.get('#autorequesttv').should('be.checked');

    cy.get('[data-testid=settings-nav-desktop').contains('General').click();

    cy.contains('Auto-Request Movies').should('exist');
    cy.contains('Auto-Request Series').should('exist');

    cy.get('#watchlistSyncMovies').should('not.be.checked').click();
    cy.get('#watchlistSyncTv').should('not.be.checked').click();

    cy.intercept('/api/v1/user/*/settings/main').as('userMain');

    cy.contains('Save Changes').click();

    cy.wait('@userMain');

    cy.reload();

    cy.get('#watchlistSyncMovies').should('be.checked').click();
    cy.get('#watchlistSyncTv').should('be.checked').click();

    cy.contains('Save Changes').click();

    cy.wait('@userMain');

    cy.get('[data-testid=settings-nav-desktop').contains('Permissions').click();

    cy.get('#autorequest').should('be.checked').click();

    cy.contains('Save Changes').click();
  });
});
