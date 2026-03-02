#!/usr/bin/env node

/**
 * Check that i18n locale files are in sync with extracted messages.
 * Runs `pnpm i18n:extract` and compares en.json; exits 1 if they differ.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const localePath = path.join(
  __dirname,
  '..',
  'src',
  'i18n',
  'locale',
  'en.json'
);
const backupPath = `${localePath}.bak`;

try {
  fs.copyFileSync(localePath, backupPath);
  execSync('pnpm i18n:extract', { stdio: 'inherit' });
  const original = fs.readFileSync(backupPath, 'utf8');
  const extracted = fs.readFileSync(localePath, 'utf8');
  fs.unlinkSync(backupPath);

  if (original !== extracted) {
    console.error(
      "i18n messages are out of sync. Please run 'pnpm i18n:extract' and commit the changes."
    );
    process.exit(1);
  }
} catch (err) {
  if (fs.existsSync(backupPath)) {
    fs.unlinkSync(backupPath);
  }
  throw err;
}
