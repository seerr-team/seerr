export interface HardcoverPaginatedResponse {
  page: number;
  total_results: number;
  total_pages: number;
}

export interface Image {
  color?: string;
  color_name?: string;
  height: number;
  id: number;
  url: string;
  width: number;
}

export interface Author {
  alternate_names: string[];
  books: string[];
  books_count: number;
  id: number;
  image?: Image;
  name: string;
  name_personal: string;
  series_names: string[];
  slug: string;
}

export interface Book {
  id: number;
  title: string;
  description: string;
  release_date: string;
  tags: Tags;
  image: Image;
  book_series: {
    position: number;
    series_id: number;
    series: Series;
  }[];
}

export interface Series {
  name: string;
  id: number;
  slug: string;
  description: string;
  books_count: number;
  primary_books_count: number;
}

export interface HardcoverBookResult {
  id: number;
  title: string;
  description: string;
  release_date: string;
  cached_tags?: Tags;
  image?: Image;
  media_type: 'book';
}

export interface HardcoverAuthorResult {
  id: number;
  name: string;
  image?: Image;
  slug: string;
  media_type: 'author';
}

export interface BookTrendingResponse {
  data: {
    books_trending: {
      ids: number[];
    };
  };
}

export interface HardcoverSearchMultiResponse
  extends HardcoverPaginatedResponse {
  results: (HardcoverBookResult | HardcoverAuthorResult)[];
}

export interface AuthorByPKResponse {
  data: {
    authors_by_pk: HardcoverAuthorDetails;
  };
}

export interface BookByPKResponse {
  data: {
    books_by_pk: HardcoverBookDetails;
  };
}

export interface SeriesByPKResponse {
  data: {
    series_by_pk: HardcoverSeries;
  };
}

export interface RelatedResponse {
  data: {
    recommendations: {
      item_book: HardcoverBookResult;
    }[];
  };
}

export interface AuthorResponse extends HardcoverPaginatedResponse {
  data: {
    authors: Author[];
  };
}

export interface BookResponse extends HardcoverPaginatedResponse {
  data: Books;
}

export interface Books {
  books: HardcoverBookResult[];
}

export interface AuthorContribution {
  id: number;
  book: HardcoverBookResult;
}

export interface BookContribution {
  id: number;
  author: Author;
  contribution?: string | null;
}

export interface Identifiers {
  goodreads: string[];
  openlibrary: string[];
  isbn_10: string[];
  isbn_13: string[];
  asin: string[];
  kindle_asin: string[];
  inventaire_id: string[];
  lccn: string[];
  ocaid: string[];
  oclc: string[];
}

export interface Tags {
  Genre: {
    tag: string;
    tagSlug: string;
    category: string;
    categorySlug: string;
    spoilerRatio: number;
    count: number;
  }[];
  Mood: {
    tag: string;
    tagSlug: string;
    category: string;
    categorySlug: string;
    spoilerRatio: number;
    count: number;
  }[];
  'Content Warning': {
    tag: string;
    tagSlug: string;
    category: string;
    categorySlug: string;
    spoilerRatio: number;
    count: number;
  }[];
  Tag: {
    tag: string;
    tagSlug: string;
    category: string;
    categorySlug: string;
    spoilerRatio: number;
    count: number;
  }[];
}

export interface HardcoverSearchHit {
  document: {
    activities_count: number;
    alternative_titles: string[];
    author_names: string[];
    compilation: boolean;
    content_warnings: string[];
    contribution_types: string[];
    contributions: BookContribution[];
    cover_color?: string;
    description?: string;
    featured_series: {
      details: string;
      featured: boolean;
      id: number;
      position: number;
      series: Series;
      unreleased: boolean;
    };
    genres: string[];
    has_audiobook: boolean;
    has_ebook: boolean;
    id: string;
    image: Image;
    isbns: string[];
    lists_count: number;
    moods: string[];
    pages?: number;
    prompts_count: number;
    rating: number;
    ratings_count: number;
    release_date?: string;
    release_year?: number;
    reviews_count: number;
    series_names: string[];
    slug: string;
    subtitle?: string;
    tags: string[];
    title: string;
    users_count: number;
    users_read_count: number;
  };
  text_match: number;
  text_match_info: {
    best_field_score: string;
    best_field_weight: number;
    fields_matched: number;
    score: string;
    tokens_matched: number;
  };
}

export interface HardcoverSearchResponse {
  data: {
    search: {
      results: {
        found: number;
        hits: HardcoverSearchHit[];
        page: number;
        request_params: {
          per_page: number;
          q: string;
        };
      };
    };
  };
}

interface BookSeries {
  position: number;
  book: HardcoverBookResult;
}

export interface HardcoverSeries {
  id: number;
  name: string;
  description: string;
  primary_books_count: number;
  books_count: number;
  book_series: BookSeries[];
}

export interface HardcoverBookDetails {
  id: number;
  title: string;
  description: string;
  release_date: string;
  image: Image;
  subtitle: string;
  headline: string;
  rating: number;
  pages: number;
  cached_tags: Tags;
  contributions: BookContribution[];
  book_series: {
    position: number;
    series_id: number;
    series: HardcoverSeries;
  }[];
}

export interface HardcoverAuthorDetails {
  bio: string;
  books_count: number;
  id: number;
  identifiers: Identifiers;
  name: string;
  image: {
    url: string;
  };
  users_count: number;
  born_date: string;
  contributions: AuthorContribution[];
}
