const BOOK_ROUTES = [
  '/book',
  '/books',
  '/author',
  '/series',
  '/discover/books',
] as const;

export function isBookRoute(pathname: string): boolean {
  return BOOK_ROUTES.some((route) => pathname.startsWith(route));
}
