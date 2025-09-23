export const VALID_BOOK_HEADERS = [
  'bookstore',
  'adventure',
  'classics',
  'dystopian',
  'fantasy',
  'fiction',
  'history',
  'lgbtq',
  'mystery',
  'nonfiction',
  'science-fiction',
  'war',
  'young-adult',
];

export const BOOK = `
  id
  pages
  title
  subtitle
  headline
  description
  users_count
  release_date
  rating
  cached_tags
  image {
    url
    height
    width
  }
`;

export const BOOK_RESULT = `
  id
  title
  description
  release_date
  cached_tags
  image {
    url
    height
    width
  }
`;

export const SERIES = `
  name
  id
  slug
  description
  books_count
  primary_books_count
  book_series {
    book {
      ${BOOK_RESULT}
    }
  }
`;

export const AUTHOR = `
  bio
  books_count
  id
  identifiers
  name
  user_id
  users_count
  born_date
  image {
    url
    height
    width
  }
`;

export const BOOK_SERIES = `
  book_series(
    order_by: [{position: asc}, {book: {users_count: desc}}]
    distinct_on: position
    where: {book: {book_status_id: {_eq: "1"}, compilation: {_eq: false}, release_date: {_is_null: false}}, position: {_gte: "0"}}
  ) {
    series_id
    position
    book {
      ${BOOK_RESULT}
    }
  }`;
