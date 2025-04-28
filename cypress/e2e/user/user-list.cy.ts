const testUser = {
  username: 'Test User',
  emailAddress: 'test@seeerr.dev',
  password: 'test1234',
};

describe('User List', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('opens the user list from the home page', () => {
    cy.visit('/');

    cy.get('[data-testid=sidebar-toggle]').click();
    cy.get('[data-testid=sidebar-menu-users-mobile]').click();

    cy.get('[data-testid=page-header]').should('contain', 'User List');
  });

  it('can find the admin user and friend user in the user list', () => {
    cy.visit('/users');

    cy.get('[data-testid=user-list-row]').contains(Cypress.env('ADMIN_EMAIL'));
    cy.get('[data-testid=user-list-row]').contains(Cypress.env('USER_EMAIL'));
  });

  it('can create a local user', () => {
    cy.visit('/users');

    cy.contains('Create Local User').click();

    cy.get('[data-testid=modal-title]').should('contain', 'Create Local User');

    cy.get('#username').type(testUser.username);
    cy.get('#email').type(testUser.emailAddress);
    cy.get('#password').type(testUser.password);

    cy.intercept('/api/v1/user*').as('user');

    cy.get('[data-testid=modal-ok-button]').click();

    cy.wait('@user');
    // Wait a little longer for the user list to fully re-render
    cy.wait(1000);

    cy.get('[data-testid=user-list-row]').contains(testUser.emailAddress);
  });

  it('can delete the created local test user', () => {
    cy.visit('/users');

    cy.contains('[data-testid=user-list-row]', testUser.emailAddress)
      .contains('Delete')
      .click();

    cy.get('[data-testid=modal-title]').should('contain', `Delete User`);

    cy.intercept('/api/v1/user*').as('user');

    cy.get('[data-testid=modal-ok-button]').should('contain', 'Delete').click();

    cy.wait('@user');
    cy.wait(1000);

    cy.get('[data-testid=user-list-row]')
      .contains(testUser.emailAddress)
      .should('not.exist');
  });
});
