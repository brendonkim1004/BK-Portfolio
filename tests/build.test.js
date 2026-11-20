import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test, expect } from 'vitest';

test('build emits every page', () => {
  execSync('npx vite build', { stdio: 'pipe' });
  for (const page of ['index.html', 'type-test.html', 'storyboard.html', 'demos/truck-tracker/dashboard.html']) {
    expect(existsSync(`dist/${page}`), page).toBe(true);
  }
}, 60_000);
