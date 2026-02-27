interface PageInfo {
  pages: number;
  page: number;
  results: number;
  pageSize: number;
}

export interface PaginatedResponse {
  pageInfo: PageInfo;
}

/**
 * Get the keys of an object that are not functions
 */
type NonFunctionPropertyNames<T> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  [K in keyof T]: T[K] extends Function ? never : K;
}[keyof T];

/**
 * Get the properties of an object that are not functions
 */
export type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;
