import { readFileSync } from 'node:fs';

const secrets = [process.env.E2E_LOGIN, process.env.E2E_PASSWORD].filter(Boolean);
const seen = new Set();
const lines = [];

function redact(value) {
  return secrets.reduce((text, secret) => text.split(secret).join('***'), value);
}

function walk(node) {
  const attributes = node?.attributes ?? {};
  const parts = ['resource-id', 'accessibilityText', 'text', 'hintText'].map((key) => attributes[key]).filter((value) => typeof value === 'string' && value.trim());
  const line = redact(parts.join(' | '));
  if (line && !seen.has(line)) {
    seen.add(line);
    lines.push(line);
  }
  for (const child of node?.children ?? []) walk(child);
}

walk(JSON.parse(readFileSync(0, 'utf8')));
console.log(lines.join('\n'));
