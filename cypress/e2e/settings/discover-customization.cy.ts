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
    cy.intercept('/api/v1/search/keyword*').as('searchKeyword');

    cy.get('[data-testid=discover-start-editing]').click();

    const sliderTitle = 'Custom Keyword Slider';

    cy.get('#sliderType').select('TMDB Movie Keyword');

    cy.get('#title').type(sliderTitle);
    // First confirm that an invalid keyword doesn't allow us to submit anything
    cy.get('#data').type('invalidkeyword{enter}', { delay: 100 });
    cy.wait('@searchKeyword');

    cy.get('[data-testid=create-discover-option-form]')
      .find('button')
      .should('be.disabled');

    cy.get('#data').clear();
    cy.get('#data').type('christmas{enter}', { delay: 100 });

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
});
