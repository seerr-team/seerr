import {
  DISCOVER_BRAND_LOGO_PATH,
  discoverBrandsSchema,
} from '@server/constants/discover';

// The Networks and Studios sliders both show a list of brands (TMDB networks
// or production companies).
export interface DiscoverBrand {
  id: number;
  name: string;
  logoPath: string;
}

export const isBrandLogoPath = (logoPath: string): boolean =>
  DISCOVER_BRAND_LOGO_PATH.test(logoPath);

export const brandLogoUrl = (logoPath: string): string =>
  `https://image.tmdb.org/t/p/w780_filter(duotone,ffffff,bababa)${logoPath}`;

export const parseBrandList = (
  data: string | null | undefined,
  defaults: DiscoverBrand[]
): DiscoverBrand[] => {
  if (!data) {
    return defaults;
  }

  try {
    // The same schema the server uses, so names are trimmed and duplicate ids
    // are dropped here too
    const result = discoverBrandsSchema.safeParse(JSON.parse(data));

    return result.success ? result.data : defaults;
  } catch {
    return defaults;
  }
};

export const isDefaultBrandList = (
  brands: DiscoverBrand[],
  defaults: DiscoverBrand[]
): boolean =>
  brands.length === defaults.length &&
  brands.every((brand, index) => {
    const fallback = defaults[index];

    return (
      brand.id === fallback.id &&
      brand.name === fallback.name &&
      brand.logoPath === fallback.logoPath
    );
  });

// The default list is stored as null, so changes to the defaults in a later
// version reach everyone who never customized the list.
export const serializeBrandList = (
  brands: DiscoverBrand[],
  defaults: DiscoverBrand[]
): string | null =>
  isDefaultBrandList(brands, defaults) ? null : JSON.stringify(brands);
