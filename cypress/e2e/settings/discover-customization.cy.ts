describe('Discover Customization', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.intercept('/api/v1/settings/discover').as('getDiscoverSliders');
  });

  it('show the discover customization settings', () => {
    cy.visit('/');

    cy.get('[data-testid=discover-start-editing]').click();

    cy.get('[data-testid=create-slider-header')
      .should('contain', 'Create New Slider')
      .scrollIntoView();

    // There should be some built in options
    cy.get('[data-testid=discover-slider-edit-mode]').should(
      'contain',
      'Recently Added'
    );
    cy.get('[data-testid=discover-slider-edit-mode]').should(
      'contain',
      'Recent Requests'
    );
  });

  it('can drag to re-order elements and save to persist the changes', () => {
    let dataTransfer = new DataTransfer();
    cy.visit('/');

    cy.get('[data-testid=discover-start-editing]').click();

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .trigger('dragstart', { dataTransfer });
    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .trigger('drop', { dataTransfer });
    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .trigger('dragend', { dataTransfer });

    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .should('contain', 'Recently Added');

    cy.get('[data-testid=discover-customize-submit').click();
    cy.wait('@getDiscoverSliders');

    cy.reload();

    cy.get('[data-testid=discover-start-editing]').click();

    dataTransfer = new DataTransfer();

    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .should('contain', 'Recently Added');

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .trigger('dragstart', { dataTransfer });
    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .trigger('drop', { dataTransfer });
    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .trigger('dragend', { dataTransfer });

    cy.get('[data-testid=discover-slider-edit-mode]')
      .eq(1)
      .should('contain', 'Recent Requests');

    cy.get('[data-testid=discover-customize-submit').click();
    cy.wait('@getDiscoverSliders');
  });

  it('can create a new discover option and remove it', () => {
    cy.visit('/');
    cy.intercept('/api/v1/settings/discover/*').as('discoverSlider');

    cy.get('[data-testid=discover-start-editing]').click();

    const sliderTitle = 'Custom Keyword Slider';

    cy.get('#sliderType').select('TMDB Movie Keyword');

    cy.get('#title').type(sliderTitle);
    // First confirm that an invalid keyword doesn't allow us to submit anything
    cy.get('#data').type('invalidkeyword');
    // Enter before the full query loads selects a stale option from a partial one
    cy.contains('.react-select__menu-notice--no-options', 'No results.');
    cy.get('#data').type('{enter}');

    cy.get('[data-testid=create-discover-option-form]')
      .find('button')
      .should('be.disabled');

    cy.get('#data').clear();
    cy.get('#data').type('christmas');
    cy.contains('.react-select__option', /^christmas$/).click();

    // Confirming we have some results
    cy.contains('.slider-header', sliderTitle)
      .next('[data-testid=media-slider]')
      .find('[data-testid=title-card]');

    cy.get('[data-testid=create-discover-option-form]').submit();

    cy.wait('@discoverSlider');
    cy.wait('@getDiscoverSliders');
    cy.wait(1000);

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .should('contain', sliderTitle);

    // Make sure its still there even if we reload
    cy.reload();

    cy.get('[data-testid=discover-start-editing]').click();

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .should('contain', sliderTitle);

    // Verify it's not rendering on our discover page (its still disabled!)
    cy.visit('/');

    cy.get('.slider-header').should('not.contain', sliderTitle);

    cy.get('[data-testid=discover-start-editing]').click();

    // Enable it, and check again
    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .find('[role="checkbox"]')
      .click();

    cy.get('[data-testid=discover-customize-submit').click();
    cy.wait('@getDiscoverSliders');

    cy.visit('/');

    cy.contains('.slider-header', sliderTitle)
      .next('[data-testid=media-slider]')
      .find('[data-testid=title-card]');

    cy.get('[data-testid=discover-start-editing]').click();

    // let's delete it and confirm its deleted.
    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .find('[data-testid=discover-slider-remove-button]')
      .click();

    cy.wait('@discoverSlider');
    cy.wait('@getDiscoverSliders');
    cy.wait(1000);

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .should('not.contain', sliderTitle);
  });

  describe('Networks slider editor', () => {
    const addNetwork = (id: string) => {
      cy.get('[data-testid=discover-network-editor]')
        .find('input')
        .type(`${id}{enter}`);
    };

    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid=discover-start-editing]').click();
      cy.get('[data-testid=discover-network-editor]').should('be.visible');
    });

    it('shows a success toast when a network is added', () => {
      cy.intercept('GET', '/api/v1/network/2697', {
        body: { id: 2697, name: 'AcornTV', logoPath: '/acorntv.png' },
      }).as('getNetwork');

      addNetwork('2697');
      cy.wait('@getNetwork');

      cy.contains('AcornTV has been added to the list.').should('be.visible');
      cy.get('[data-testid=discover-network-editor]')
        .find('li')
        .last()
        .should('contain', 'AcornTV');
      cy.get('[data-testid=discover-network-editor]')
        .find('input')
        .should('have.value', '');
    });

    it('does not add a network that is already in the list', () => {
      cy.intercept('GET', '/api/v1/network/2697', {
        body: { id: 2697, name: 'AcornTV', logoPath: '/acorntv.png' },
      }).as('getNetwork');

      addNetwork('2697');
      cy.wait('@getNetwork');
      cy.contains('AcornTV has been added to the list.').should('be.visible');

      addNetwork('2697');

      cy.contains('AcornTV is already in the list.').should('be.visible');
      cy.get('[data-testid=discover-network-editor]')
        .find('li')
        .filter(':contains("AcornTV")')
        .should('have.length', 1);
    });

    it('does not add a network without a logo', () => {
      cy.intercept('GET', '/api/v1/network/9999', {
        body: { id: 9999, name: 'No Logo TV' },
      }).as('getNetwork');

      addNetwork('9999');
      cy.wait('@getNetwork');

      cy.contains('No Logo TV has no logo, so it cannot be added.').should(
        'be.visible'
      );
      cy.contains('has been added to the list.').should('not.exist');
    });

    it('shows an error when the network cannot be found', () => {
      // The API responds with a 500 when TMDB cannot find the network
      cy.intercept('GET', '/api/v1/network/8888', { statusCode: 500 }).as(
        'getNetwork'
      );

      addNetwork('8888');
      cy.wait('@getNetwork');

      cy.contains('Could not find that network.').should('be.visible');
      cy.contains('has been added to the list.').should('not.exist');
    });
  });

  describe('Studios slider editor', () => {
    const addStudio = (id: string) => {
      cy.get('[data-testid=discover-studio-editor]')
        .find('input')
        .type(`${id}{enter}`);
    };

    beforeEach(() => {
      cy.visit('/');
      cy.get('[data-testid=discover-start-editing]').click();
      cy.get('[data-testid=discover-studio-editor]').should('be.visible');
    });

    it('shows the default studios', () => {
      cy.get('[data-testid=discover-studio-editor]')
        .find('li')
        .should('contain', 'Disney')
        .and('contain', 'Pixar')
        .and('contain', 'A24');
    });

    it('shows a success toast when a studio is added', () => {
      cy.intercept('GET', '/api/v1/studio/1632', {
        body: { id: 1632, name: 'Lionsgate', logoPath: '/lionsgate.png' },
      }).as('getStudio');

      addStudio('1632');
      cy.wait('@getStudio');

      cy.contains('Lionsgate has been added to the list.').should('be.visible');
      cy.get('[data-testid=discover-studio-editor]')
        .find('li')
        .last()
        .should('contain', 'Lionsgate');
      cy.get('[data-testid=discover-studio-editor]')
        .find('input')
        .should('have.value', '');
    });

    it('does not add a studio that is already in the list', () => {
      cy.intercept('GET', '/api/v1/studio/1632', {
        body: { id: 1632, name: 'Lionsgate', logoPath: '/lionsgate.png' },
      }).as('getStudio');

      addStudio('1632');
      cy.wait('@getStudio');
      cy.contains('Lionsgate has been added to the list.').should('be.visible');

      addStudio('1632');

      cy.contains('Lionsgate is already in the list.').should('be.visible');
      cy.get('[data-testid=discover-studio-editor]')
        .find('li')
        .filter(':contains("Lionsgate")')
        .should('have.length', 1);
    });

    it('does not add a studio without a logo', () => {
      cy.intercept('GET', '/api/v1/studio/9999', {
        body: { id: 9999, name: 'No Logo Pictures' },
      }).as('getStudio');

      addStudio('9999');
      cy.wait('@getStudio');

      cy.contains(
        'No Logo Pictures has no logo, so it cannot be added.'
      ).should('be.visible');
      cy.contains('has been added to the list.').should('not.exist');
    });

    it('shows an error when the studio cannot be found', () => {
      // The API responds with a 500 when TMDB cannot find the studio
      cy.intercept('GET', '/api/v1/studio/8888', { statusCode: 500 }).as(
        'getStudio'
      );

      addStudio('8888');
      cy.wait('@getStudio');

      cy.contains('Could not find that studio.').should('be.visible');
      cy.contains('has been added to the list.').should('not.exist');
    });

    it('does not change the networks list', () => {
      cy.intercept('GET', '/api/v1/studio/1632', {
        body: { id: 1632, name: 'Lionsgate', logoPath: '/lionsgate.png' },
      }).as('getStudio');

      addStudio('1632');
      cy.wait('@getStudio');

      cy.get('[data-testid=discover-network-editor]')
        .find('li')
        .should('not.contain', 'Lionsgate');
    });
  });
});
