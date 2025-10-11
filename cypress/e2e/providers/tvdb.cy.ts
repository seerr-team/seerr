describe('TVDB Integration', () => {
  // Constants for routes and selectors
  const ROUTES = {
    home: '/',
    metadataSettings: '/settings/metadata',
    tomorrowIsOursTvShow: '/tv/72879',
    monsterTvShow: '/tv/225634',
    dragonnBallZKaiAnime: '/tv/61709',
  };

  const SELECTORS = {
    sidebarToggle: '[data-testid=sidebar-toggle]',
    sidebarSettingsMobile: '[data-testid=sidebar-menu-settings-mobile]',
    settingsNavDesktop: 'nav[data-testid="settings-nav-desktop"]',
    metadataTestButton: 'button[type="button"]:contains("Test")',
    metadataSaveButton: '[data-testid="metadata-save-button"]',
    tmdbStatus: '[data-testid="tmdb-status"]',
    tvdbStatus: '[data-testid="tvdb-status"]',
    tvMetadataProviderSelector: '[data-testid="tv-metadata-provider-selector"]',
    animeMetadataProviderSelector:
      '[data-testid="anime-metadata-provider-selector"]',
    seasonSelector: '[data-testid="season-selector"]',
    season1: 'Season 1',
    season2: 'Season 2',
    season3: 'Season 3',
    episodeList: '[data-testid="episode-list"]',
    episode9: '9 - Hang Men',
  };

  // Reusable commands
  const navigateToMetadataSettings = () => {
    cy.visit(ROUTES.home);
    cy.get(SELECTORS.sidebarToggle).click();
    cy.get(SELECTORS.sidebarSettingsMobile).click();
    cy.get(
      `${SELECTORS.settingsNavDesktop} a[href="${ROUTES.metadataSettings}"]`
    ).click();
  };

  const testAndVerifyMetadataConnection = () => {
    cy.intercept('POST', '/api/v1/settings/metadatas/test').as(
      'testConnection'
    );
    cy.get(SELECTORS.metadataTestButton).click();
    return cy.wait('@testConnection');
  };

  const saveMetadataSettings = (customBody = null) => {
    if (customBody) {
      cy.intercept('PUT', '/api/v1/settings/metadatas', (req) => {
        req.body = customBody;
      }).as('saveMetadata');
    } else {
      // Else just intercept without modifying body
      cy.intercept('PUT', '/api/v1/settings/metadatas').as('saveMetadata');
    }

    cy.get(SELECTORS.metadataSaveButton).click();
    return cy.wait('@saveMetadata');
  };

  beforeEach(() => {
    // Perform login
    cy.login(Cypress.env('ADMIN_EMAIL'), Cypress.env('ADMIN_PASSWORD'));

    // Navigate to Metadata settings
    navigateToMetadataSettings();

    // Verify we're on the correct settings page
    cy.contains('h3', 'Metadata Providers').should('be.visible');

    // Configure TVDB as TV provider and test connection
    cy.get(SELECTORS.tvMetadataProviderSelector).click();

    // get id react-select-4-option-1
    cy.get('[class*="react-select__option"]').contains('TheTVDB').click();

    // Test the connection
    testAndVerifyMetadataConnection().then(({ response }) => {
      expect(response.statusCode).to.equal(200);
      // Check TVDB connection status
      cy.get(SELECTORS.tvdbStatus).should('contain', 'Operational');
    });

    // Save settings
    saveMetadataSettings({
      anime: 'tvdb',
      tv: 'tvdb',
    }).then(({ response }) => {
      expect(response.statusCode).to.equal(200);
      expect(response.body.tv).to.equal('tvdb');
    });
  });

  it('should display "Tomorrow is Ours" show information with multiple seasons from TVDB', () => {
    // Navigate to the TV show
    cy.visit(ROUTES.tomorrowIsOursTvShow);

    // Verify that multiple seasons are displayed (TMDB has only 1 season, TVDB has multiple)
    // cy.get(SELECTORS.seasonSelector).should('exist');
    cy.intercept('/api/v1/tv/225634/season/1').as('season1');
    // Select Season 2 and verify it loads
    cy.contains(SELECTORS.season2)
      .should('be.visible')
      .scrollIntoView()
      .click();

    // Verify that episodes are displayed for Season 2
    cy.contains('260 - Episode 506').should('be.visible');
  });

  it('Should display "Monster" show information correctly when not existing on TVDB', () => {
    // Navigate to the TV show
    cy.visit(ROUTES.monsterTvShow);

    // Intercept season 1 request
    cy.intercept('/api/v1/tv/225634/season/1').as('season1');

    // Select Season 1
    cy.contains(SELECTORS.season1)
      .should('be.visible')
      .scrollIntoView()
      .click();

    // Wait for the season data to load
    cy.wait('@season1');

    // Verify specific episode exists
    cy.contains(SELECTORS.episode9).should('be.visible');
  });

  it('should display "Dragon Ball Z Kai" show information with multiple only 2 seasons from TVDB', () => {
    // Navigate to the TV show
    cy.visit(ROUTES.dragonnBallZKaiAnime);

    // Intercept season 1 request
    cy.intercept('/api/v1/tv/61709/season/1').as('season1');

    // Select Season 2 and verify it visible
    cy.contains(SELECTORS.season2)
      .should('be.visible')
      .scrollIntoView()
      .click();

    // select season 3 and verify it not visible
    cy.contains(SELECTORS.season3).should('not.exist');
  });
});
