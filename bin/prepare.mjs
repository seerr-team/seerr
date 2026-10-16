#!/usr/bin/env node

/**
 * Do not run husky in CI environments
 */
const isCi = process.env.CI !== undefined;
if (!isCi) {
  const husky = (await import('husky')).default;
  console.log(husky());
}
