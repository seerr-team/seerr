#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports, no-console */
/**
 * Check that i18n locale files are in sync with extracted messages.
 * Runs extract scripts and compares en.json; exits 1 if they differ.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targets = [
  {
    localePath: path.join(__dirname, '..', 'src', 'i18n', 'locale', 'en.json'),
    script: 'pnpm i18n:extract',
  },
  {
    localePath: path.join(
      __dirname,
      '..',
      'server',
      'lib',
      'i18n',
      'locale',
      'en.json'
    ),
    script: 'pnpm i18n:extract:server',
  },
];

for (const { localePath, script } of targets) {
  const backupPath = `${localePath}.bak`;
  try {
    fs.copyFileSync(localePath, backupPath);
    execSync(script, { stdio: 'inherit' });

    const original = fs.readFileSync(backupPath, 'utf8');
    const extracted = fs.readFileSync(localePath, 'utf8');
    fs.unlinkSync(backupPath);

    if (original !== extracted) {
      console.error(
        `i18n messages are out of sync. Please run '${script}' and commit the changes.`
      );
      process.exit(1);
    }
  } catch (err) {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
    throw err;
  }
}
