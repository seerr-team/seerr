const users = [
  {
    id: 1,
    displayName: 'Owner',
    email: 'owner@example.com',
    permissions: 2,
    userType: 3,
  },
  {
    id: 2,
    displayName: 'Friend',
    email: 'friend@example.com',
    permissions: 32,
    userType: 3,
  },
  {
    id: 3,
    displayName: 'Housemate',
    email: 'housemate@example.com',
    permissions: 32,
    userType: 3,
  },
];

const connection = {
  userId: 2,
  traktUserId: 'trakt-2',
  traktUsername: 'friend-on-trakt',
  traktSlug: 'friend-on-trakt',
  displayName: 'Friend on Trakt',
  status: 'active',
  connectedByUserId: 1,
  lastValidatedAt: null,
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T10:00:00.000Z',
};

const interceptAdminData = () => {
  cy.intercept('GET', '/api/v1/settings/trakt', {
    clientId: 'saved-client-id',
    clientSecretConfigured: true,
    callbackUrl: 'https://requests.example.com/api/v1/auth/trakt/callback',
  }).as('traktSettings');
  cy.intercept(
    {
      method: 'GET',
      pathname: '/api/v1/user',
      query: { take: '50', skip: '0' },
    },
    {
      pageInfo: { pages: 2, page: 1, results: 3, pageSize: 2 },
      results: users.slice(0, 2),
    }
  ).as('usersPageOne');
  cy.intercept(
    {
      method: 'GET',
      pathname: '/api/v1/user',
      query: { take: '50', skip: '50' },
    },
    {
      pageInfo: { pages: 2, page: 2, results: 3, pageSize: 1 },
      results: users.slice(2),
    }
  ).as('usersPageTwo');
  cy.intercept('GET', '/api/v1/settings/trakt/connections', [connection]).as(
    'traktConnections'
  );
};

describe('Trakt administration', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    interceptAdminData();
  });

  it('keeps the secret write-only and confirms only client ID changes', () => {
    let reconnectRequired = false;
    cy.intercept('GET', '/api/v1/settings/trakt/connections', (request) => {
      request.reply([
        {
          ...connection,
          status: reconnectRequired ? 'reconnect_required' : 'active',
        },
      ]);
    }).as('settingsConnections');
    cy.visit('/settings/trakt');
    cy.wait('@settingsConnections');

    cy.get('#trakt-client-id')
      .should('have.length', 1)
      .and('have.value', 'saved-client-id');
    cy.get('#trakt-client-secret')
      .should('have.length', 1)
      .and('have.attr', 'type', 'password')
      .and('have.value', '');
    cy.contains('Client secret configured').should('be.visible');

    cy.intercept('PUT', '/api/v1/settings/trakt', (request) => {
      expect(request.body).to.deep.equal({
        clientId: 'saved-client-id',
        confirmReconnectAll: false,
        clientSecret: 'replacement-secret',
      });
      request.reply({
        clientId: 'saved-client-id',
        clientSecretConfigured: true,
        callbackUrl: 'https://requests.example.com/api/v1/auth/trakt/callback',
      });
    }).as('saveSecret');
    cy.get('#trakt-client-secret').type('replacement-secret');
    cy.get('[data-testid=trakt-application-form]').submit();
    cy.wait('@saveSecret');
    cy.get('#trakt-client-secret').should('have.value', '');
    cy.contains('All connected users will need to reconnect').should(
      'not.exist'
    );
    cy.contains('[data-testid=trakt-user-row]', 'friend@example.com').within(
      () => {
        cy.contains('friend-on-trakt').should('be.visible');
        cy.contains('Connected').should('be.visible');
      }
    );

    cy.intercept('PUT', '/api/v1/settings/trakt', (request) => {
      expect(request.body).to.deep.equal({
        clientId: 'new-client-id',
        confirmReconnectAll: true,
      });
      reconnectRequired = true;
      request.reply({
        clientId: 'new-client-id',
        clientSecretConfigured: true,
        callbackUrl: 'https://requests.example.com/api/v1/auth/trakt/callback',
      });
    }).as('changeClientId');
    cy.get('#trakt-client-id').clear().type('new-client-id');
    cy.get('[data-testid=trakt-application-form]').submit();
    cy.contains('All connected users will need to reconnect').should(
      'be.visible'
    );
    cy.get('[data-testid=modal-ok-button]').click();
    cy.wait('@changeClientId');
    cy.wait('@settingsConnections');
    cy.contains('[data-testid=trakt-user-row]', 'friend@example.com').within(
      () => {
        cy.contains('Reconnect required').should('be.visible');
        cy.contains('button', 'Reconnect').should('be.visible');
      }
    );
  });

  it('names the secret visibility and callback copy controls', () => {
    cy.visit('/settings/trakt');
    cy.get('button[aria-label="Show or hide client secret"]').should(
      'be.visible'
    );
    cy.get('button[aria-label="Copy Trakt callback URL"]').should('be.visible');
  });

  it('reconnects an active account and identifies each OAuth target', () => {
    const openedPopups: {
      closed: boolean;
      close: () => void;
      location: { href: string };
    }[] = [];
    cy.intercept('POST', '/api/v1/user/2/settings/trakt/auth', {
      transactionId: 'active-reconnect',
      authorizationUrl:
        'https://trakt.tv/oauth/authorize?prompt=login&state=active-reconnect',
      callbackOrigin: 'https://requests.example.com',
      expiresAt: '2026-07-31T11:00:00.000Z',
    }).as('startActiveReconnect');
    cy.intercept('GET', '/api/v1/trakt/oauth/active-reconnect/status', {
      status: 'pending',
      resultCode: null,
    }).as('activeReconnectStatus');
    cy.intercept('POST', '/api/v1/user/3/settings/trakt/auth', {
      transactionId: 'housemate-connect',
      authorizationUrl:
        'https://trakt.tv/oauth/authorize?prompt=login&state=housemate-connect',
      callbackOrigin: 'https://requests.example.com',
      expiresAt: '2026-07-31T11:00:00.000Z',
    }).as('startHousemateConnect');
    cy.intercept('GET', '/api/v1/trakt/oauth/housemate-connect/status', {
      status: 'pending',
      resultCode: null,
    }).as('housemateConnectStatus');

    cy.visit('/settings/trakt');
    cy.window().then((win) => {
      cy.stub(win, 'open').callsFake(() => {
        const popup = {
          closed: false,
          close: cy.stub(),
          location: { href: 'about:blank' },
        };
        openedPopups.push(popup);
        return popup as unknown as Window;
      });
    });

    cy.contains('[data-testid=trakt-user-row]', 'friend@example.com').within(
      () => {
        cy.contains('button', 'Reconnect').should('be.visible').click();
        cy.contains('button', 'Unlink').should('be.visible');
      }
    );
    cy.get('[role=dialog]').within(() => {
      cy.get('[data-testid=modal-title]').should(
        'have.text',
        'Connect Trakt for Friend'
      );
      cy.contains('friend@example.com').should('not.exist');
    });
    cy.wait('@startActiveReconnect').then(({ response }) => {
      expect(response?.body.authorizationUrl).to.contain('prompt=login');
      expect(openedPopups[0].location.href).to.contain('prompt=login');
      expect(openedPopups[0].location.href).to.contain(
        'state=active-reconnect'
      );
    });
    cy.wait('@activeReconnectStatus');
    cy.get('[data-testid=modal-cancel-button]').click();

    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('button', 'Connect')
      .click();
    cy.get('[role=dialog]').within(() => {
      cy.get('[data-testid=modal-title]').should(
        'have.text',
        'Connect Trakt for Housemate'
      );
      cy.contains('housemate@example.com').should('not.exist');
    });
    cy.wait('@startHousemateConnect');
    cy.wait('@housemateConnectStatus');
    cy.get('[data-testid=modal-cancel-button]').click();

    cy.then(() => {
      expect(openedPopups).to.have.length(2);
      expect(openedPopups[0].close).to.have.property('callCount', 1);
      expect(openedPopups[1].close).to.have.property('callCount', 1);
    });
  });

  it('pages through every user and refreshes one canonical row after OAuth', () => {
    let connectionsRequest = 0;
    cy.intercept('GET', '/api/v1/settings/trakt/connections', (request) => {
      connectionsRequest += 1;
      request.reply(
        connectionsRequest === 1
          ? [connection]
          : [
              connection,
              {
                ...connection,
                userId: 3,
                traktUserId: 'trakt-3',
                traktUsername: 'housemate-on-trakt',
              },
            ]
      );
    }).as('refreshConnections');
    cy.intercept('POST', '/api/v1/user/3/settings/trakt/auth', (request) => {
      request.reply({
        transactionId: 'transaction-3',
        authorizationUrl:
          'https://trakt.tv/oauth/authorize?client_id=saved-client-id&prompt=login&state=transaction-3',
        callbackOrigin: 'https://requests.example.com',
        expiresAt: '2026-07-31T11:00:00.000Z',
      });
    }).as('startOAuth');
    let statusRequest = 0;
    cy.intercept(
      'GET',
      '/api/v1/trakt/oauth/transaction-3/status',
      (request) => {
        statusRequest += 1;
        request.reply(
          statusRequest === 1
            ? { status: 'pending', resultCode: null }
            : { status: 'succeeded', resultCode: null }
        );
      }
    ).as('oauthStatus');

    cy.visit('/settings/trakt');
    cy.wait(['@usersPageOne', '@usersPageTwo']);
    cy.get('[data-testid=trakt-user-row]').should('have.length', 3);
    users.forEach((user) => {
      cy.contains('[data-testid=trakt-user-row]', user.email).should(
        'have.length',
        1
      );
    });

    const popup = {
      closed: false,
      close: cy.stub(),
      location: { href: 'about:blank' },
    };
    cy.window().then((win) => {
      cy.stub(win, 'open')
        .returns(popup as unknown as Window)
        .as('openPopup');
    });
    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('Connect')
      .click();
    cy.get('@openPopup').should(
      'have.been.calledWith',
      'about:blank',
      'trakt-oauth',
      'popup,width=640,height=760'
    );
    cy.wait('@startOAuth').then(({ response }) => {
      expect(response?.body.authorizationUrl).to.contain('prompt=login');
      expect(popup.location.href).to.contain('prompt=login');
    });
    cy.wait('@oauthStatus')
      .its('response.body.status')
      .should('equal', 'pending');
    cy.window().then((win) => {
      win.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://malicious.example.com',
          data: {
            type: 'trakt-oauth-result',
            transactionId: 'transaction-3',
          },
        })
      );
      win.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://requests.example.com',
          data: {
            type: 'not-trakt',
            transactionId: 'transaction-3',
          },
        })
      );
      win.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://requests.example.com',
          data: {
            type: 'trakt-oauth-result',
            transactionId: 'wrong-transaction',
          },
        })
      );
    });
    cy.wait(250).then(() => expect(statusRequest).to.equal(1));
    cy.window().then((win) => {
      win.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://requests.example.com',
          data: {
            type: 'trakt-oauth-result',
            transactionId: 'transaction-3',
            status: 'succeeded',
          },
        })
      );
      win.dispatchEvent(
        new MessageEvent('message', {
          origin: 'https://requests.example.com',
          data: {
            type: 'trakt-oauth-result',
            transactionId: 'transaction-3',
            status: 'succeeded',
          },
        })
      );
    });
    cy.wait('@oauthStatus')
      .its('response.body.status')
      .should('equal', 'succeeded');
    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com').within(
      () => {
        cy.contains('housemate-on-trakt').should('be.visible');
        cy.contains('Connected').should('be.visible');
      }
    );
    cy.get('[data-testid=trakt-user-row]').should('have.length', 3);
    cy.then(() => {
      expect(statusRequest).to.equal(2);
      expect(connectionsRequest).to.equal(2);
    });
  });

  it('completes OAuth when popup close is observed before the queued callback message', () => {
    let statusRequests = 0;
    let connectedAfterCallback = false;
    const popup = {
      closed: false,
      close: cy.stub(),
      location: { href: 'about:blank' },
    };
    cy.intercept('GET', '/api/v1/settings/trakt/connections', (request) => {
      request.reply(
        connectedAfterCallback
          ? [
              connection,
              {
                ...connection,
                userId: 3,
                traktUserId: 'trakt-3',
                traktUsername: 'callback-close-user',
              },
            ]
          : [connection]
      );
    }).as('callbackConnections');
    cy.intercept('POST', '/api/v1/user/3/settings/trakt/auth', {
      transactionId: 'callback-close',
      authorizationUrl:
        'https://trakt.tv/oauth/authorize?prompt=login&state=callback-close',
      callbackOrigin: 'https://requests.example.com',
      expiresAt: '2026-07-31T11:00:00.000Z',
    }).as('startCallbackOAuth');
    cy.intercept(
      'GET',
      '/api/v1/trakt/oauth/callback-close/status',
      (request) => {
        statusRequests += 1;
        connectedAfterCallback = statusRequests > 1;
        request.reply(
          connectedAfterCallback
            ? { status: 'succeeded', resultCode: null }
            : { status: 'pending', resultCode: null }
        );
      }
    ).as('callbackStatus');

    cy.visit('/settings/trakt');
    cy.window().then((win) => {
      cy.stub(win, 'open').returns(popup as unknown as Window);
    });
    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('button', 'Connect')
      .click();
    cy.wait('@startCallbackOAuth');
    cy.wait('@callbackStatus')
      .its('response.body.status')
      .should('equal', 'pending');
    cy.window().then((win) => {
      win.setTimeout(() => {
        win.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://requests.example.com',
            data: {
              type: 'trakt-oauth-result',
              transactionId: 'callback-close',
            },
          })
        );
      }, 700);
      popup.closed = true;
    });

    cy.wait('@callbackStatus')
      .its('response.body.status')
      .should('equal', 'succeeded');
    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com').within(
      () => {
        cy.contains('callback-close-user').should('be.visible');
        cy.contains('Connected').should('be.visible');
      }
    );
    cy.contains('Trakt login was closed').should('not.exist');
    cy.then(() => expect(statusRequests).to.equal(2));
  });

  it('closes every reserved popup when authorization cannot start', () => {
    const failureStatuses = [400, 403, 500];
    const popups = failureStatuses.map(() => ({
      closed: false,
      close: cy.stub(),
      location: { href: 'about:blank' },
    }));
    let authorizationAttempt = 0;
    let popupAttempt = 0;
    cy.intercept('POST', '/api/v1/user/3/settings/trakt/auth', (request) => {
      request.reply({
        statusCode: failureStatuses[authorizationAttempt],
        body: { message: 'Unable to start Trakt authorization.' },
      });
      authorizationAttempt += 1;
    }).as('failedAuthorization');

    cy.visit('/settings/trakt');
    cy.window().then((win) => {
      cy.stub(win, 'open').callsFake(() => {
        const popup = popups[popupAttempt];
        popupAttempt += 1;
        return popup as unknown as Window;
      });
    });
    failureStatuses.forEach((statusCode, index) => {
      cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
        .contains('button', 'Connect')
        .click();
      cy.wait('@failedAuthorization')
        .its('response.statusCode')
        .should('equal', statusCode);
      cy.contains('Trakt could not be connected').should('be.visible');
      cy.then(() => expect(popups[index].close).to.have.been.calledOnce);
      cy.get('[data-testid=modal-cancel-button]').click();
    });
  });

  it('recovers from blocked and closed popups with fresh transactions and cleanup', () => {
    let transaction = 0;
    let statusRequests = 0;
    let popupCalls = 0;
    const popupToClose = {
      closed: false,
      close: cy.stub(),
      location: { href: 'about:blank' },
    };
    const openPopup = () => ({
      closed: false,
      close: cy.stub(),
      location: { href: 'about:blank' },
    });

    cy.intercept('POST', '/api/v1/user/3/settings/trakt/auth', (request) => {
      transaction += 1;
      request.reply({
        transactionId: `lifecycle-${transaction}`,
        authorizationUrl: `https://trakt.tv/oauth/authorize?prompt=login&state=lifecycle-${transaction}`,
        callbackOrigin: 'https://requests.example.com',
        expiresAt: '2026-07-31T11:00:00.000Z',
      });
    }).as('startLifecycleOAuth');
    cy.intercept('GET', '/api/v1/trakt/oauth/lifecycle-*/status', (request) => {
      statusRequests += 1;
      request.reply({ status: 'pending', resultCode: null });
    }).as('lifecycleStatus');

    cy.visit('/settings/trakt');
    cy.window().then((win) => {
      cy.stub(win, 'open').callsFake(() => {
        popupCalls += 1;
        if (popupCalls === 1) return null;
        if (popupCalls === 3) return popupToClose as unknown as Window;
        return openPopup() as unknown as Window;
      });
    });

    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('button', 'Connect')
      .click();
    cy.wait('@startLifecycleOAuth')
      .its('response.body.transactionId')
      .should('equal', 'lifecycle-1');
    cy.contains('Trakt login was closed').should('be.visible');
    cy.contains('button', 'Open Trakt').click();
    cy.wait('@lifecycleStatus');
    cy.get('[data-testid=modal-cancel-button]').click();
    cy.then(() => statusRequests).then((requestsAfterClose) => {
      cy.window().then((win) => {
        win.dispatchEvent(
          new MessageEvent('message', {
            origin: 'https://requests.example.com',
            data: {
              type: 'trakt-oauth-result',
              transactionId: 'lifecycle-1',
            },
          })
        );
      });
      cy.wait(2200).then(() => {
        expect(statusRequests).to.equal(requestsAfterClose);
      });
    });

    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('button', 'Connect')
      .click();
    cy.wait('@startLifecycleOAuth')
      .its('response.body.transactionId')
      .should('equal', 'lifecycle-2');
    cy.wait('@lifecycleStatus');
    cy.then(() => {
      popupToClose.closed = true;
    });
    cy.contains('Trakt login was closed', { timeout: 2000 }).should(
      'be.visible'
    );
    cy.get('[data-testid=modal-secondary-button]').click();
    cy.wait('@startLifecycleOAuth')
      .its('response.body.transactionId')
      .should('equal', 'lifecycle-3');
    cy.get('[data-testid=modal-cancel-button]').click();
    cy.then(() => {
      expect(transaction).to.equal(3);
      expect(popupCalls).to.equal(4);
    });
  });

  it('shows safe conflict messages and the remote-revoke warning', () => {
    let transaction = 0;
    cy.intercept('POST', '/api/v1/user/3/settings/trakt/auth', (request) => {
      transaction += 1;
      request.reply({
        transactionId: `conflict-${transaction}`,
        authorizationUrl: `https://trakt.tv/oauth/authorize?prompt=login&state=conflict-${transaction}`,
        callbackOrigin: 'https://requests.example.com',
        expiresAt: '2026-07-31T11:00:00.000Z',
      });
    });
    cy.intercept('GET', '/api/v1/trakt/oauth/conflict-1/status', {
      statusCode: 409,
      body: {
        message: 'Trakt account conflict.',
        code: 'target_has_different_trakt_account',
      },
    });
    cy.intercept('GET', '/api/v1/trakt/oauth/conflict-2/status', {
      statusCode: 409,
      body: {
        message: 'Trakt account conflict.',
        code: 'trakt_account_owned_by_another_user',
      },
    });
    cy.intercept('DELETE', '/api/v1/user/2/settings/trakt', {
      delay: 750,
      body: { remoteRevocationSucceeded: false },
    }).as('unlinkTrakt');

    cy.visit('/settings/trakt');
    cy.window().then((win) => {
      cy.stub(win, 'open').callsFake(
        () =>
          ({
            closed: false,
            close: cy.stub(),
            location: { href: 'about:blank' },
          }) as unknown as Window
      );
    });
    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('button', 'Connect')
      .click();
    cy.contains(
      'This Seerr user is already connected to another Trakt account'
    ).should('be.visible');
    cy.get('[data-testid=modal-cancel-button]').click();

    cy.contains('[data-testid=trakt-user-row]', 'housemate@example.com')
      .contains('button', 'Connect')
      .click();
    cy.contains('This Trakt account belongs to another Seerr user').should(
      'be.visible'
    );
    cy.get('[data-testid=modal-cancel-button]').click();

    cy.contains('[data-testid=trakt-user-row]', 'friend@example.com')
      .contains('Unlink')
      .click()
      .click();
    cy.contains('[data-testid=trakt-user-row]', 'friend@example.com')
      .contains('button', 'Confirm unlink')
      .should('be.disabled');
    cy.wait('@unlinkTrakt');
    cy.contains(
      'The local connection was removed, but Trakt could not revoke its token'
    ).should('be.visible');
  });
});
