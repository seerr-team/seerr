import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  env: {
    commitTag: process.env.COMMIT_TAG || 'local',
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { hostname: 'gravatar.com' },
      { hostname: 'image.tmdb.org' },
      { hostname: 'artworks.thetvdb.com' },
      { hostname: 'plex.tv' },
    ],
  },
  transpilePackages: ['country-flag-icons'],
  turbopack: {
    resolveAlias: {
      'next/link': './src/components/Common/BaseLink/index.tsx',
      'next/router': './src/utils/router.ts',
    },
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack: (config) => {
    const svgRule = config.module.rules.find((rule: { test?: RegExp }) =>
      rule?.test?.test?.('.svg')
    );

    if (svgRule) {
      svgRule.exclude = /\.svg$/i;
    }

    config.module.rules.push({
      test: /\.svg$/i,
      use: ['@svgr/webpack'],
    });

    config.resolve.alias['next/link'] = path.resolve(
      './src/components/Common/BaseLink/index.tsx'
    );
    config.resolve.alias['next/router'] = path.resolve('./src/utils/router.ts');

    return config;
  },
  experimental: {
    scrollRestoration: true,
    largePageDataBytes: 512 * 1000,
  },
};

export default nextConfig;
