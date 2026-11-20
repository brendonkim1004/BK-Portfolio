import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test, expect } from 'vitest';

test('build emits all three pages', () => {
  execSync('npx vite build', { stdio: 'pipe' });
  for (const page of ['index.html', 'type-test.html', 'storyboard.html']) {
    expect(existsSync(`dist/${page}`), page).toBe(true);
  }
}, 60_000);
