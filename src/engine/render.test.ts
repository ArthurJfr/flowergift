import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOUQUETS, type BouquetId } from './catalog.js';
import { createScene, renderFrame } from './scene.js';
import { toEmailHtml, toHtml, toText } from './serialize.js';

const frameOptions = {
  style: 'classique' as const,
  wrap: 'paper' as const,
  cols: 100,
  rows: 56,
  seed: 1,
};

function frameText(bouquetId: BouquetId, seed = 1): string {
  const scene = createScene({ ...frameOptions, bouquetId, seed });
  return toText(renderFrame(scene, 6, 6, 0), { style: 'classique', t: 6 });
}

describe('moteur', () => {
  it('ne référence ni le DOM ni Math.random', () => {
    const files = readdirSync(import.meta.dirname).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
    for (const name of files) {
      const text = readFileSync(join(import.meta.dirname, name), 'utf8');
      expect(text, name).not.toMatch(/\bwindow\b/);
      expect(text, name).not.toMatch(/\bdocument\b/);
      expect(text, name).not.toMatch(/\bnavigator\b/);
      expect(text, name).not.toMatch(/Math\.random/);
    }
  });

  it('reste déterministe pour le même seed', () => {
    expect(frameText('roses', 3)).toBe(frameText('roses', 3));
  });

  it('change avec les pétales seedés', () => {
    const play = (seed: number) => {
      const scene = createScene({
        bouquetId: 'roses',
        style: 'classique',
        wrap: 'paper',
        cols: 80,
        rows: 46,
        seed,
        petals: true,
      });
      let text = '';
      for (let step = 0; step < 50; step++) {
        const time = step * 0.1;
        text = toText(renderFrame(scene, time, time, 0.1), { style: 'classique', t: time });
      }
      return text;
    };
    expect(play(1)).toBe(play(1));
    expect(play(1)).not.toBe(play(2));
  });

  it.each(BOUQUETS.map((bouquet) => bouquet.id))('snapshot %s', (bouquetId) => {
    expect(frameText(bouquetId)).toMatchSnapshot();
  });

  it('sérialise le HTML et le mail', () => {
    const scene = createScene({ ...frameOptions, bouquetId: 'tulipes' });
    const grid = renderFrame(scene, 6, 6, 0);
    const html = toHtml(grid, { style: 'classique', colorMode: 'color', t: 6 });
    const email = toEmailHtml(grid, { style: 'classique' });
    expect(html).toContain('class="s');
    expect(html).not.toContain('style="color:');
    expect(email).toMatch(/style="color:#[0-9a-f]{6}"/);
    expect(email).not.toContain('class="s');
  });

  it('tient 30 images/s en résolution haute', () => {
    const scene = createScene({
      bouquetId: 'roses',
      style: 'classique',
      wrap: 'paper',
      cols: 140,
      rows: 78,
      seed: 1,
    });
    const started = performance.now();
    for (let step = 0; step < 30; step++) {
      const time = step / 30;
      renderFrame(scene, time, time, 1 / 30);
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
