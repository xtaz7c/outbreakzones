#!/usr/bin/env node
/**
 * Rasteriza atlases SVG → PNG para runtime previsível no Phaser.
 *
 * Fonte:  public/tiles/*.svg, public/sprites/*.svg
 * Saída:  mesmos caminhos com extensão .png
 *
 * Requer ImageMagick (`convert`).
 * Uso: npm run assets
 * Env:  ATLAS_SCALE=1 (default) ou 2 para 2× a partir de arte 32.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scale = Math.max(1, Number(process.env.ATLAS_SCALE || '1') || 1);

const jobs = [
  {
    svg: path.join(root, 'public/tiles/mission-tiles.svg'),
    png: path.join(root, 'public/tiles/mission-tiles.png'),
  },
  {
    svg: path.join(root, 'public/sprites/characters.svg'),
    png: path.join(root, 'public/sprites/characters.png'),
  },
];

function hasConvert() {
  const r = spawnSync('convert', ['-version'], { encoding: 'utf8' });
  return r.status === 0;
}

function rasterizeWithConvert(svgPath, pngPath, scaleFactor) {
  mkdirSync(path.dirname(pngPath), { recursive: true });
  const args = ['-background', 'none', svgPath];
  if (scaleFactor !== 1) {
    args.push('-filter', 'point', '-resize', `${scaleFactor * 100}%`);
  }
  args.push(`PNG32:${pngPath}`);
  const r = spawnSync('convert', args, { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || `convert failed for ${svgPath}`);
  }
}

function main() {
  if (!hasConvert()) {
    console.error(
      '[assets] ImageMagick `convert` não encontrado. Instale-o ou rode em CI com imagem que o inclua.',
    );
    process.exit(1);
  }

  for (const job of jobs) {
    if (!existsSync(job.svg)) {
      console.warn(`[assets] skip (ausente): ${path.relative(root, job.svg)}`);
      continue;
    }
    rasterizeWithConvert(job.svg, job.png, scale);
    const bytes = readFileSync(job.png).length;
    console.log(
      `[assets] ${path.relative(root, job.svg)} → ${path.relative(root, job.png)} (${bytes} bytes, scale=${scale})`,
    );
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    scale,
    files: jobs.map((j) => path.relative(root, j.png)),
  };
  writeFileSync(path.join(root, 'public/atlas-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log('[assets] ok');
}

main();
