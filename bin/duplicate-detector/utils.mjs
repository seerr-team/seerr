export const EMBEDDING = {
  model: 'Xenova/bge-small-en-v1.5',
  pooling: 'cls',
  threshold: 0.82,
};

const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

function ghHeaders() {
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };
}

export async function fetchIssues({
  state = 'open',
  since,
  creator,
  maxIssues = 5000,
} = {}) {
  const issues = [];
  let page = 1;
  const perPage = 100;

  while (issues.length < maxIssues) {
    const params = new URLSearchParams({
      state,
      per_page: String(perPage),
      page: String(page),
      sort: 'updated',
      direction: 'desc',
    });
    if (since) params.set('since', since);
    if (creator) params.set('creator', creator);

    const url = `${GITHUB_API}/repos/${GITHUB_REPOSITORY}/issues?${params}`;
    const resp = await fetch(url, { headers: ghHeaders() });

    if (!resp.ok) {
      throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
    }

    const batch = await resp.json();
    if (!batch.length) break;

    for (const item of batch) {
      if (!item.pull_request) {
        issues.push(item);
      }
    }

    page++;
    if (batch.length < perPage) break;
  }

  return issues.slice(0, maxIssues);
}

export async function getIssue(issueNumber) {
  const url = `${GITHUB_API}/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}`;
  const resp = await fetch(url, { headers: ghHeaders() });

  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status} ${resp.statusText}`);
  }

  return resp.json();
}

export async function postComment(issueNumber, body) {
  const url = `${GITHUB_API}/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/comments`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });

  if (!resp.ok) {
    throw new Error(
      `Failed to post comment: ${resp.status} ${resp.statusText}`
    );
  }

  console.log(`Posted comment on #${issueNumber}`);
}

export async function addLabel(issueNumber, label) {
  const url = `${GITHUB_API}/repos/${GITHUB_REPOSITORY}/issues/${issueNumber}/labels`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels: [label] }),
  });

  if (resp.status === 404) {
    console.warn(
      `Label '${label}' does not exist - skipping. Create it manually.`
    );
    return;
  }

  if (!resp.ok) {
    throw new Error(`Failed to add label: ${resp.status} ${resp.statusText}`);
  }

  console.log(`Added label '${label}' to #${issueNumber}`);
}

const FORM_NOISE = [/^###\s.*$/gm, /^_No response_$/gm, /^- \[[ xX]\] .*$/gm];

export function issueText(title, body) {
  body = (body || '').trim();
  for (const pattern of FORM_NOISE) body = body.replace(pattern, '');
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  if (body.length > 2000) body = body.slice(0, 2000) + '...';
  return body ? `${title}\n\n${body}` : title;
}

export function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
