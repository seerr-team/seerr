#!/usr/bin/env node

const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const categoryPath = resolve(__dirname, '../../docs/api/_category_.json');
let categoryContent;

try {
  categoryContent = readFileSync(categoryPath, 'utf8');
} catch {
  categoryContent = undefined;
}

const result = spawnSync('docusaurus', ['clean-api-docs', ...args], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.error) {
  throw result.error;
}

if (categoryContent !== undefined) {
  mkdirSync(dirname(categoryPath), { recursive: true });
  writeFileSync(categoryPath, categoryContent, 'utf8');
}

process.exit(result.status ?? 1);
