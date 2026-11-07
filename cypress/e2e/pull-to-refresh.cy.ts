describe('Pull To Refresh', () => {
  beforeEach(() => {
    cy.login(Cypress.expose('ADMIN_EMAIL'), Cypress.expose('ADMIN_PASSWORD'));
    cy.viewport(390, 844);
    cy.visitMobile('/');
  });

  it('reloads the current page', () => {
    cy.wait(500);

    cy.intercept({
      method: 'GET',
      url: '/api/v1/*',
    }).as('apiCall');

    cy.get('.searchbar').swipe('bottom', [190, 500]);

    cy.wait('@apiCall').then((interception) => {
      assert.isNotNull(
        interception.response.body,
        'API was called and received data'
      );
    });
  });
});
