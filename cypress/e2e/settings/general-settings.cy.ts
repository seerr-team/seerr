describe('General Settings', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('opens the settings page from the home page', () => {
    cy.visit('/');

    cy.get('[data-testid=sidebar-toggle]').click();
    cy.get('[data-testid=sidebar-menu-settings-mobile]').click();

    cy.get('.heading').should('contain', 'General Settings');
  });

  it('modifies setting that requires restart', () => {
    cy.visit('/settings/network');

    cy.get('#trustProxy').click();
    cy.get('#trustedProxies').type('127.0.0.1');
    cy.get('[data-testid=settings-network-form]').submit();
    cy.get('[data-testid=modal-title]').should(
      'contain',
      'Server Restart Required'
    );

    cy.get('[data-testid=modal-ok-button]').click();
    cy.get('[data-testid=modal-title]').should('not.exist');

    cy.get('[type=checkbox]#trustProxy').click();
    cy.get('[data-testid=settings-network-form]').submit();
    cy.get('[data-testid=modal-title]').should('not.exist');
  });
});
