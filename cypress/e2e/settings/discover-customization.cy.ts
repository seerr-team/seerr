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
});
