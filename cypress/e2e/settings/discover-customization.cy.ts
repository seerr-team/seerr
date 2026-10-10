const movieResult = {
  id: 603,
  mediaType: 'movie',
  title: 'The Matrix',
  originalTitle: 'The Matrix',
  releaseDate: '1999-03-30',
  adult: false,
  video: false,
  popularity: 50,
  voteCount: 100,
  voteAverage: 8.2,
  genreIds: [28],
  overview: 'A hacker learns the truth.',
  originalLanguage: 'en',
};

const tvResult = {
  id: 14929,
  mediaType: 'tv',
  name: 'Heartland',
  originalName: 'Heartland',
  firstAirDate: '2007-10-14',
  originCountry: ['CA'],
  popularity: 34,
  voteCount: 580,
  voteAverage: 8.3,
  genreIds: [18],
  overview: 'Life on a ranch.',
  originalLanguage: 'en',
};

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

  it('can create a slider for a public TMDB list with coliding IDs', () => {
    const listId = '8542986';
    const sliderTitle = 'My TMDB List';
    const listResults = [
      movieResult,
      { ...tvResult, id: movieResult.id },
      ...Array.from({ length: 19 }, (_, index) => ({
        ...movieResult,
        id: movieResult.id + index + 1,
        title: `List Movie ${index + 1}`,
        originalTitle: `List Movie ${index + 1}`,
      })),
    ];

    cy.intercept('/api/v1/settings/discover/*').as('discoverSlider');
    cy.intercept('GET', '/api/v1/discover/list/*', {
      page: 1,
      totalPages: 1,
      totalResults: listResults.length,
      results: listResults,
    }).as('tmdbList');

    cy.visit('/');
    cy.get('[data-testid=discover-start-editing]').click();
    cy.get('#sliderType').select('TMDB List');
    cy.get('#title').type(sliderTitle);

    cy.get('#data').type('not-a-list');
    cy.get('[data-testid=create-discover-option-form]')
      .find('button')
      .should('be.disabled');

    cy.get('#data').clear().type(listId);
    cy.wait('@tmdbList');
    cy.contains('.slider-header', sliderTitle)
      .next('[data-testid=media-slider]')
      .find('[data-testid=title-card]')
      .should('have.length', 20);
    cy.get('[data-testid=create-discover-option-form]').submit();
    cy.wait('@discoverSlider');
    cy.wait('@getDiscoverSliders');

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .should('contain', sliderTitle)
      .find('[role="checkbox"]')
      .click();
    cy.get('[data-testid=discover-customize-submit').click();
    cy.wait('@getDiscoverSliders');

    cy.visit('/');
    cy.contains('.slider-header a', sliderTitle).should(
      'have.attr',
      'href',
      `/discover/list/${listId}`
    );
    cy.get('[data-testid=discover-start-editing]').click();

    cy.get('[data-testid=discover-slider-edit-mode]')
      .first()
      .should('contain', sliderTitle)
      .find('[data-testid=discover-slider-remove-button]')
      .click();

    cy.wait('@discoverSlider');
    cy.wait('@getDiscoverSliders');

    cy.visit(`/discover/list/${listId}`);
    cy.wait('@tmdbList');
    cy.get('[data-testid=page-header]').should('contain', 'TMDB List');
    cy.get('.cards-vertical')
      .find('[data-testid=title-card]')
      .should('have.length', listResults.length);
  });

  it('can create a new discover option and remove it', () => {
    cy.visit('/');
    cy.intercept('/api/v1/settings/discover/*').as('discoverSlider');
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/v1/search/keyword',
        query: { query: 'invalidkeyword' },
      },
      { page: 1, total_pages: 0, total_results: 0, results: [] }
    ).as('invalidKeyword');
    cy.intercept(
      {
        method: 'GET',
        pathname: '/api/v1/search/keyword',
        query: { query: 'christmas' },
      },
      {
        page: 1,
        total_pages: 1,
        total_results: 1,
        results: [{ id: 207317, name: 'Christmas' }],
      }
    ).as('searchKeyword');
    cy.intercept('GET', '/api/v1/discover/movies*', {
      page: 1,
      totalPages: 1,
      totalResults: 1,
      results: [movieResult],
    }).as('discoverMovies');

    cy.get('[data-testid=discover-start-editing]').click();

    const sliderTitle = 'Custom Keyword Slider';

    cy.get('#sliderType').select('TMDB Movie Keyword');

    cy.get('#title').type(sliderTitle);
    // First confirm that an invalid keyword doesn't allow us to submit anything
    cy.get('#data').type('invalidkeyword{enter}', { delay: 100 });
    cy.wait('@invalidKeyword');

    cy.get('[data-testid=create-discover-option-form]')
      .find('button')
      .should('be.disabled');

    cy.get('#data').clear();
    cy.get('#data').type('christmas', { delay: 100 });
    cy.wait('@searchKeyword');
    cy.contains('.react-select__option', 'Christmas').click();
    cy.wait('@discoverMovies');

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
