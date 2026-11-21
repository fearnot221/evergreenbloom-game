// Builds the self-hosted display subset (SIL OFL 1.1, see public/fonts/OFL.txt):
//   songying-display.woff2  Noto Sans TC Black (思源黑體 900), titles, wordmark, seals
//
// Usage: node scripts/fonts/build-display-font.mjs <NotoSansTC-Black.ttf>
// Source: the variable NotoSansTC[wght].ttf (fonts.google.com/noto/specimen/Noto+Sans+TC)
// cut to weight 900 with `fonttools varLib.instancer NotoSansTC[wght].ttf wght=900`.
// Requires fonttools with brotli; set PYFTSUBSET to use a specific pyftsubset binary.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { collectCharacters, subsets } from './characters.mjs';

const [source] = process.argv.slice(2);
if (!source || !fs.existsSync(source)) {
  console.error('Usage: build-display-font.mjs <NotoSansTC-Black.ttf>');
  process.exit(1);
}
const name = 'songying-display';
const chars = collectCharacters(subsets[name]);
const textFile = `public/fonts/${name}.chars.txt`;
fs.writeFileSync(textFile, chars);
execFileSync(process.env.PYFTSUBSET || 'pyftsubset', [
  source,
  `--text-file=${textFile}`,
  '--flavor=woff2',
  '--layout-features=kern,palt,halt',
  '--no-hinting',
  '--desubroutinize',
  `--output-file=public/fonts/${name}.woff2`,
]);
const size = fs.statSync(`public/fonts/${name}.woff2`).size;
console.log(`${name}: ${[...chars].length} characters, ${(size / 1024).toFixed(1)} KiB`);
