#!/usr/bin/env node
/**
 * Validate that a pull request body follows the PR template.
 *
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const bodyFile = process.argv[2];

if (!bodyFile) {
  console.error('body file path is required as an argument.');
  process.exit(2);
}

const body = readFileSync(resolve(bodyFile), 'utf8').replace(/\r\n?/g, '\n');
const issues = [];

const MAINTAINER_PERMISSIONS = ['admin', 'write'];
const isMaintainer = MAINTAINER_PERMISSIONS.includes(
  process.env.AUTHOR_PERMISSION ?? ''
);

const stripComments = (s) => {
  let result = s;
  let previous;
  do {
    previous = result;
    result = result.replace(/<!--[\s\S]*?-->/g, '');
  } while (result !== previous);
  return result;
};

const stripFixesPlaceholder = (s) => s.replace(/-\s*Fixes\s*`?#XXXX`?/gi, '');

const descriptionMatch = body.match(
  /(?:^|\n) {0,3}## Description[ \t]*(?=\n|$)([\s\S]*?)(?=\n {0,3}## |$)/
);
const descriptionContent = descriptionMatch
  ? stripFixesPlaceholder(stripComments(descriptionMatch[1])).trim()
  : '';

if (!descriptionContent) {
  issues.push(
    '**Description** section is empty or only contains placeholder text.'
  );
}

const testingMatch = body.match(
  /(?:^|\n) {0,3}## How Has This Been Tested\?[ \t]*(?=\n|$)([\s\S]*?)(?=\n {0,3}## |$)/
);
const testingContent = testingMatch
  ? stripComments(testingMatch[1]).trim()
  : '';

if (!testingContent) {
  issues.push('**How Has This Been Tested?** section is empty.');
}

const checklistMatch = body.match(
  /(?:^|\n) {0,3}## Checklist:[ \t]*\n([\s\S]*?)$/
);
const checklistContent = checklistMatch ? checklistMatch[1] : '';

const totalBoxes = (checklistContent.match(/- \[[ x]\]/gi) || []).length;
const checkedBoxes = (checklistContent.match(/- \[x\]/gi) || []).length;

if (totalBoxes === 0) {
  issues.push('**Checklist** section is missing or has been removed.');
} else if (checkedBoxes === 0) {
  issues.push(
    'No items in the **checklist** have been checked. Please review and check all applicable items.'
  );
}

if (
  !/- \[x\] I have read and followed the contribution/i.test(checklistContent)
) {
  issues.push('The **contribution guidelines** checkbox has not been checked.');
}

const aiMatch = body.match(
  /(?:^|\n) {0,3}## AI Disclosure[ \t]*(?=\n|$)([\s\S]*?)(?=\n {0,3}## |$)/
);
const aiContent = aiMatch ? stripComments(aiMatch[1]).trim() : '';
const legacyAiBox =
  !aiMatch && /- \[x\] Disclosed any use of AI/i.test(checklistContent);

if (!isMaintainer && !aiContent && !legacyAiBox) {
  issues.push(
    '**AI Disclosure** section is empty. Describe how you used AI, or write "None".'
  );
}

if (/-\s*Fixes\s*`?#XXXX`?/i.test(body)) {
  issues.push(
    'The `Fixes #XXXX` placeholder has not been updated. Please link the relevant issue or remove it.'
  );
}

console.log(JSON.stringify(issues));
process.exit(issues.length > 0 ? 1 : 0);
