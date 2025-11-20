#!/usr/bin/env node

/**
 * Do not run husky in CI environments
 */
const isCi = process.env.CI !== undefined;
if (!isCi) {
  require('husky').install();
}
