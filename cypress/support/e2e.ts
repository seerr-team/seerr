import './commands';

before(() => {
  if (Cypress.expose('SEED_DATABASE')) {
    cy.exec('pnpm cypress:prepare');
  }
});
