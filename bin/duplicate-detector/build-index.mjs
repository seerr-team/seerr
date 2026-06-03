#!/usr/bin/env node
/**
 * Build Issue Embedding Index
 *
 * Fetches all open issues and recently closed ones,
 * generates embeddings using a local ONNX transformer model,
 * and saves them as a JSON artifact for the duplicate detector.
 */

import { pipeline } from '@huggingface/transformers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fetchIssues, issueText } from './utils.mjs';

const MODEL_NAME = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
const OUTPUT_PATH = 'issue_index.json';
const INCLUDE_CLOSED_DAYS = 90;
const MAX_ISSUES = 5000;
const BATCH_SIZE = 64;

async function main() {
  console.log('Fetching open issues...');
  const openIssues = await fetchIssues({
    state: 'open',
    maxIssues: MAX_ISSUES,
  });
  console.log(`Fetched ${openIssues.length} open issues`);

  const since = new Date(
    Date.now() - INCLUDE_CLOSED_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  console.log(
    `Fetching closed issues from last ${INCLUDE_CLOSED_DAYS} days...`
  );

  const closedIssues = await fetchIssues({
    state: 'closed',
    since,
    maxIssues: MAX_ISSUES,
  });
  console.log(`Fetched ${closedIssues.length} closed issues`);
  let allIssues = [...openIssues, ...closedIssues];

  const seen = new Set();
  allIssues = allIssues.filter((issue) => {
    if (seen.has(issue.number)) return false;
    seen.add(issue.number);
    return true;
  });

  console.log(`Total unique issues to index: ${allIssues.length}`);

  if (allIssues.length === 0) {
    console.warn('No issues found - writing empty index');
    writeFileSync(OUTPUT_PATH, JSON.stringify({ issues: [], embeddings: [] }));
    return;
  }

  console.log(`Loading model: ${MODEL_NAME}`);
  const extractor = await pipeline('feature-extraction', MODEL_NAME, {
    dtype: 'fp32',
  });

  const texts = allIssues.map((issue) => issueText(issue.title, issue.body));
  const allEmbeddings = [];

  console.log(`Generating embeddings for ${texts.length} issues...`);
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const output = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });

    const vectors = output.tolist();
    allEmbeddings.push(...vectors);

    const progress = Math.min(i + BATCH_SIZE, texts.length);
    console.log(`  ${progress}/${texts.length}`);
  }

  const issueMetadata = allIssues.map((issue) => {
    const body = (issue.body || '').trim();
    return {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      url: issue.html_url,
      body_preview: body.slice(0, 500) || '',
      labels: (issue.labels || []).map((l) => l.name),
      created_at: issue.created_at,
      updated_at: issue.updated_at,
    };
  });

  const indexData = {
    issues: issueMetadata,
    embeddings: allEmbeddings,
    model: MODEL_NAME,
    issue_count: issueMetadata.length,
    built_at: new Date().toISOString(),
  };

  const dir = dirname(OUTPUT_PATH);
  if (dir && dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(indexData));

  const sizeMb = (
    Buffer.byteLength(JSON.stringify(indexData)) /
    (1024 * 1024)
  ).toFixed(1);
  console.log(
    `Index saved to ${OUTPUT_PATH} (${sizeMb} MB, ${issueMetadata.length} issues)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
