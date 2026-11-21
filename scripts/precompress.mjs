// Writes a .gz beside each compressible file in dist/, once at build time, so the
// server sends ready-made gzip instead of compressing on every request.
import fs from 'node:fs';
import path from 'node:path';
import { constants, gzipSync } from 'node:zlib';

const compressible = new Set(['.html', '.js', '.css', '.json', '.svg', '.webmanifest']);
let count = 0;
for (const entry of fs.readdirSync('dist', { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !compressible.has(path.extname(entry.name))) continue;
  const file = path.join(entry.parentPath, entry.name);
  const gz = gzipSync(fs.readFileSync(file), { level: constants.Z_BEST_COMPRESSION });
  fs.writeFileSync(`${file}.gz`, gz);
  count++;
}
console.log(`precompressed ${count} files`);
