import { discoverBrandsSchema } from '@server/constants/discover';

interface SanitizeDiscoverBrandListOptions {
  maxBrands: number;
  // These let each slider keep its own error classes and error codes
  createInvalidError: () => Error;
  createTooManyError: () => Error;
}

// Validates the JSON list of brands (networks or studios) that is stored in
// the data of a built-in slider. `null` and an empty string mean "use the
// default list", while `[]` is a real, empty list.
export const sanitizeDiscoverBrandList = (
  data: string | null,
  {
    maxBrands,
    createInvalidError,
    createTooManyError,
  }: SanitizeDiscoverBrandListOptions
): string | null => {
  if (data === null || data === '') {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(data);
  } catch {
    throw createInvalidError();
  }

  const result = discoverBrandsSchema.safeParse(parsed);

  if (!result.success) {
    throw createInvalidError();
  }

  if (result.data.length > maxBrands) {
    throw createTooManyError();
  }

  return JSON.stringify(result.data);
};
