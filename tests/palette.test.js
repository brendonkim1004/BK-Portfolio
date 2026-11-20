import { test, expect } from 'vitest';
import { palette, contrastRatio } from '../src/styles/palette.js';

test('contrastRatio matches known values', () => {
  expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
});

test('cream text is readable on ink', () => {
  expect(contrastRatio(palette.cream, palette.ink)).toBeGreaterThanOrEqual(7);
});

test('there are six face colours and ink labels are readable on each', () => {
  const faces = Object.entries(palette.faces);
  expect(faces).toHaveLength(6);
  for (const [name, hex] of faces) {
    expect(contrastRatio(palette.ink, hex), name).toBeGreaterThanOrEqual(4.5);
  }
});

test('decision page styles read colours from the palette, not hard-coded hex', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  for (const file of readdirSync('src/pages').filter((f) => f.endsWith('.css'))) {
    const css = readFileSync(`src/pages/${file}`, 'utf8');
    expect(css.match(/#[0-9a-fA-F]{6}\b/g) ?? [], file).toEqual([]);
  }
});
