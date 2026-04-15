#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Check that i18n locale files are in sync with extracted messages.
 * Runs extract script and compares en.json files; exits 1 if they differ.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'src', 'i18n', 'locale', 'en.json'),
  path.join(__dirname, '..', 'server', 'i18n', 'locale', 'en.json'),
];

const backups = targets.map((p) => `${p}.bak`);

try {
  targets.forEach((p, i) => fs.copyFileSync(p, backups[i]));
  execSync('pnpm i18n:extract', { stdio: 'inherit' });

  let outOfSync = false;
  for (let i = 0; i < targets.length; i++) {
    const original = fs.readFileSync(backups[i], 'utf8');
    const extracted = fs.readFileSync(targets[i], 'utf8');
    fs.unlinkSync(backups[i]);

    if (original !== extracted) {
      console.error(
        `i18n messages are out of sync for ${path.basename(path.dirname(path.dirname(targets[i])))}. Please run 'pnpm i18n:extract' and commit the changes.`
      );
      outOfSync = true;
    }
  }

  if (outOfSync) {
    process.exit(1);
  }
} catch (err) {
  backups.forEach((b) => {
    if (fs.existsSync(b)) fs.unlinkSync(b);
  });
  throw err;
}
