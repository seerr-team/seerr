const requestDetailUrl = /\/api\/v1\/request\/\d+$/;

const stubRequests = (requests) => {
  cy.intercept('GET', '/api/v1/request?*', requests).as('getRequests');
  cy.intercept({ method: 'GET', url: requestDetailUrl }, (req) => {
    const id = Number(req.url.match(/\d+$/)[0]);
    req.reply(requests.results.filter((request) => request.id === id)[0]);
  }).as('getRequest');
};

const visitRequests = () => {
  cy.visit('/requests');
  cy.wait('@getRequests');
  cy.wait(['@getMovie', '@getMovie', '@getTv']);

  cy.contains('Minions: The Rise of Gru');
  cy.contains('Top Gun: Maverick');
  cy.contains('Stranger Things');
};

describe('Request List', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.viewport(1280, 800);

    cy.intercept('GET', '/api/v1/movie/*').as('getMovie');
    cy.intercept('GET', '/api/v1/tv/*').as('getTv');
  });

  it('does not refetch each request on load', () => {
    cy.fixture('requests.json').then(stubRequests);
    visitRequests();

    cy.get('@getRequest.all').should('have.length', 0);
  });

  it('does not refetch each request on window focus', () => {
    cy.fixture('requests.json').then(stubRequests);
    visitRequests();

    // SWR ignores focus events within focusThrottleInterval (5s) of mount
    cy.wait(5500);

    cy.intercept({ method: 'GET', url: requestDetailUrl }).as(
      'getRequestOnFocus'
    );
    cy.window().then((win) => {
      win.dispatchEvent(new win.Event('focus'));
    });
    cy.wait(1000);

    cy.get('@getRequestOnFocus.all').should('have.length', 0);
  });

  it('does not show a stale request after client-side navigation', () => {
    cy.fixture('requests.json').then((fixture) => {
      const approved = Cypress._.cloneDeep(fixture);
      approved.results = approved.results.slice(0, 1);
      const pending = Cypress._.cloneDeep(approved);
      pending.results[0].status = 1;
      pending.results[0].media.status = 2;

      stubRequests(pending);
      cy.visit('/');
      cy.wait('@getRequest');

      stubRequests(approved);
      // A full reload would empty the SWR cache the home page just filled
      cy.window().then((win) => {
        win['beforeNavigation'] = true;
      });
      cy.contains('.slider-header', 'Recent Requests').find('a').click();
      cy.wait('@getRequests');
      cy.location('pathname').should('eq', '/requests');
      cy.window().should('have.prop', 'beforeNavigation', true);
    });

    cy.contains('Minions: The Rise of Gru');
    cy.contains('button', 'Delete Request');
    cy.contains('button', 'Approve').should('not.exist');
    cy.contains('button', 'Decline').should('not.exist');
  });

  it('polls a request with an active download', () => {
    cy.clock(Date.now(), ['setTimeout', 'clearTimeout']);
    cy.fixture('requests.json').then((fixture) => {
      const requests = Cypress._.cloneDeep(fixture);
      requests.results[0].media.downloadStatus = [
        {
          mediaType: 'movie',
          externalId: 1,
          size: 1000,
          sizeLeft: 500,
          status: 'downloading',
          timeLeft: '00:10:00',
          estimatedCompletionTime: '2099-01-01T00:00:00.000Z',
          title: 'Minions: The Rise of Gru',
          downloadId: 'download-1',
        },
      ];
      stubRequests(requests);
    });
    visitRequests();

    cy.tick(15000);

    cy.wait('@getRequest')
      .its('request.url')
      .should('match', /\/api\/v1\/request\/101$/);
    cy.get('@getRequest.all').should('have.length', 1);
  });
});
