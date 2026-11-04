describe('Login Page', () => {
  it('succesfully logs in as an admin', () => {
    cy.loginAsAdmin();
    cy.visit('/');
    cy.contains('Trending');
  });

  it('succesfully logs in as a local user', () => {
    cy.loginAsUser();
    cy.visit('/');
    cy.contains('Trending');
  });

  it('returns to the requested page after logging in', () => {
    cy.visit('/movie/438148?manage=1');
    cy.location('pathname').should('eq', '/login');

    cy.get('[data-testid=email]').type(Cypress.env('ADMIN_EMAIL'));
    cy.get('[data-testid=password]').type(Cypress.env('ADMIN_PASSWORD'));
    cy.get('[data-testid=local-signin-button]').click();

    cy.location('pathname').should('eq', '/movie/438148');
    cy.location('search').should('eq', '?manage=1');
  });
});
