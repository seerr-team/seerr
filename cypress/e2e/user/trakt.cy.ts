describe('Trakt linked account', () => {
  beforeEach(() => {
    cy.loginAsUser();
  });

  it('connects, reconnects, and unlinks only the current user', () => {
    let userId = 0;
    let connected = false;
    let transaction = 0;
    const openedPopups: { location: { href: string } }[] = [];

    cy.intercept('GET', '/api/v1/user/*/settings/trakt', (request) => {
      const match = request.url.match(/\/user\/(\d+)\/settings\/trakt$/);
      userId = Number(match?.[1]);
      request.reply({
        applicationConfigured: true,
        connection: connected
          ? {
              userId,
              traktUserId: `trakt-${userId}`,
              traktUsername: 'my-trakt-account',
              traktSlug: 'my-trakt-account',
              displayName: 'My Trakt Account',
              status: transaction > 1 ? 'active' : 'reconnect_required',
              connectedByUserId: userId,
              lastValidatedAt: null,
              createdAt: '2026-07-31T10:00:00.000Z',
              updatedAt: '2026-07-31T10:00:00.000Z',
            }
          : null,
      });
    }).as('traktAccount');
    cy.intercept('POST', '/api/v1/user/*/settings/trakt/auth', (request) => {
      transaction += 1;
      expect(request.url).to.contain(`/user/${userId}/settings/trakt/auth`);
      request.reply({
        transactionId: `self-${transaction}`,
        authorizationUrl: `https://trakt.tv/oauth/authorize?prompt=login&state=self-${transaction}`,
        callbackOrigin: 'https://requests.example.com',
        expiresAt: '2026-07-31T11:00:00.000Z',
      });
    }).as('startSelfOAuth');
    cy.intercept('GET', '/api/v1/trakt/oauth/self-*/status', (request) => {
      connected = true;
      request.reply({ status: 'succeeded', resultCode: null });
    }).as('selfOAuthStatus');
    cy.intercept('DELETE', '/api/v1/user/*/settings/trakt', (request) => {
      expect(request.url).to.contain(`/user/${userId}/settings/trakt`);
      connected = false;
      request.reply({ remoteRevocationSucceeded: true });
    }).as('unlinkSelf');

    cy.visit('/profile/settings/linked-accounts');
    cy.contains('Trakt').should('be.visible');
    cy.get('[data-testid=trakt-user-selector]').should('not.exist');

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

    cy.get('[data-testid=profile-trakt-section]')
      .contains('button', 'Connect')
      .click();
    cy.wait('@startSelfOAuth').then(({ response }) => {
      expect(response?.body.authorizationUrl).to.contain('prompt=login');
      expect(openedPopups[0].location.href).to.contain('prompt=login');
    });
    cy.wait('@selfOAuthStatus');
    cy.get('[data-testid=profile-trakt-section]').within(() => {
      cy.contains('Reconnect required').should('be.visible');
      cy.contains('my-trakt-account').should('be.visible');
    });

    cy.get('[data-testid=profile-trakt-section]')
      .contains('button', 'Reconnect')
      .click();
    cy.wait('@startSelfOAuth').then(({ response }) => {
      expect(response?.body.authorizationUrl).to.contain('prompt=login');
      expect(openedPopups[1].location.href).to.contain('prompt=login');
    });
    cy.wait('@selfOAuthStatus');
    cy.get('[data-testid=profile-trakt-section]').within(() => {
      cy.contains('my-trakt-account').should('be.visible');
      cy.contains('Reconnect required').should('not.exist');
    });

    cy.get('[data-testid=profile-trakt-section]').contains('Unlink').click();
    cy.get('[data-testid=profile-trakt-section]')
      .contains('button', 'Confirm unlink')
      .click();
    cy.wait('@unlinkSelf');
    cy.get('[data-testid=profile-trakt-section]')
      .contains('button', 'Connect')
      .should('be.visible');
  });

  it('shows administrator guidance without OAuth actions when configuration is incomplete', () => {
    cy.intercept('GET', '/api/v1/user/*/settings/trakt', (request) => {
      const userId = Number(request.url.match(/\/user\/(\d+)\//)?.[1]);
      request.reply({
        applicationConfigured: false,
        connection: {
          userId,
          traktUserId: `trakt-${userId}`,
          traktUsername: 'needs-reconnect',
          traktSlug: 'needs-reconnect',
          displayName: 'Needs Reconnect',
          status: 'reconnect_required',
          connectedByUserId: userId,
          lastValidatedAt: null,
          createdAt: '2026-07-31T10:00:00.000Z',
          updatedAt: '2026-07-31T10:00:00.000Z',
        },
      });
    });

    cy.visit('/profile/settings/linked-accounts');
    cy.contains('Ask an administrator to configure Trakt').should('be.visible');
    cy.get('[data-testid=profile-trakt-section]').within(() => {
      cy.contains('Reconnect required').should('be.visible');
      cy.contains('button', 'Connect').should('not.exist');
      cy.contains('button', 'Reconnect').should('not.exist');
    });
  });
});

describe('Trakt cross-user administration', () => {
  it('keeps Trakt management visible when media-server links are restricted', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '/api/v1/auth/me', {
      id: 2,
      displayName: 'Delegated Admin',
      email: 'delegated-admin@example.com',
      permissions: 2,
      userType: 3,
      warnings: [],
    });
    cy.intercept('GET', '/api/v1/user/3', {
      id: 3,
      displayName: 'Target Admin',
      email: 'target-admin@example.com',
      permissions: 2,
      userType: 3,
      warnings: [],
    });
    cy.intercept('GET', '/api/v1/user/3/settings/trakt', {
      applicationConfigured: true,
      connection: null,
    });

    cy.visit('/users/3/settings/linked-accounts');
    cy.contains(
      "You do not have permission to modify this user's linked accounts"
    ).should('be.visible');
    cy.get('[data-testid=profile-trakt-section]').within(() => {
      cy.contains('Trakt').should('be.visible');
      cy.contains('button', 'Connect').should('be.visible');
    });
  });

  it('lets an exact delegated ADMIN manage owner Trakt from direct URLs without exposing other owner settings', () => {
    cy.loginAsAdmin();
    cy.intercept('GET', '/api/v1/auth/me', {
      id: 2,
      displayName: 'Delegated Admin',
      email: 'delegated-admin@example.com',
      permissions: 2,
      userType: 3,
      warnings: [],
    }).as('delegatedAdmin');
    cy.intercept('GET', '/api/v1/user/1', {
      id: 1,
      displayName: 'Owner',
      email: 'owner@example.com',
      permissions: 2,
      userType: 3,
      warnings: [],
      createdAt: '2026-07-31T10:00:00.000Z',
    });
    cy.intercept('GET', '/api/v1/user/1/settings/trakt', {
      applicationConfigured: true,
      connection: null,
    }).as('ownerTrakt');

    cy.visit('/users/1/settings/linked-accounts#trakt');
    cy.wait('@delegatedAdmin');
    cy.wait('@ownerTrakt');
    cy.get('[data-testid=profile-trakt-section]').within(() => {
      cy.contains('Trakt').should('be.visible');
      cy.contains('button', 'Connect').should('be.visible');
    });
    cy.contains('General').should('not.exist');
    cy.contains('Permissions').should('not.exist');

    cy.visit('/users/1/settings/linked-accounts?source=review');
    cy.wait('@delegatedAdmin');
    cy.wait('@ownerTrakt');
    cy.get('[data-testid=profile-trakt-section]')
      .contains('button', 'Connect')
      .should('be.visible');

    cy.visit('/users/1/settings/main?source=review#general');
    cy.wait('@delegatedAdmin');
    cy.contains(
      "You do not have permission to modify this user's settings"
    ).should('be.visible');
    cy.get('[data-testid=user-settings-general-form]').should('not.exist');
  });
});
