// Builds src/data/campus-map.json: a small, pre-projected base map for the stamp map
// (src/map/StampMap.tsx) from the website's normalized OpenStreetMap snapshot.
//
// Usage: node scripts/map/build-campus-map.mjs <evergreenbloom-website>/data/campus/normalized.json
//
// Data © OpenStreetMap contributors, ODbL 1.0 (the UI credits it). Community-mapped and
// not surveyed: an illustration of the campus, not a navigation map. Coordinates are
// metres east (x) and south (y) of the snapshot's origin, rounded to 1 m and simplified.
import fs from 'node:fs';

const [source] = process.argv.slice(2);
if (!source || !fs.existsSync(source)) {
  console.error('Usage: build-campus-map.mjs <normalized.json>');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(source, 'utf8'));
const { longitude: lon0, latitude: lat0 } = data.origin;
const kx = Math.cos((lat0 * Math.PI) / 180) * 111320;
const ky = 110574;
const project = ([lon, lat]) => [(lon - lon0) * kx, -(lat - lat0) * ky];

/** Douglas-Peucker on projected points, tolerance in metres. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points.at(-1)];
  let index = 0;
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d =
      dx === 0 && dy === 0
        ? Math.hypot(x - a[0], y - a[1])
        : Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / Math.hypot(dx, dy);
    if (d > max) [max, index] = [d, i];
  }
  if (max <= tolerance) return [a, b];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

const path = (coords, closed, tolerance) => {
  const pts = simplify(coords.map(project), tolerance).map(
    ([x, y]) => `${Math.round(x)} ${Math.round(y)}`,
  );
  return pts.length < 2 ? '' : `M${pts.join('L')}${closed ? 'Z' : ''}`;
};
const rings = (geometry) =>
  geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();

const layers = { boundary: '', water: '', green: '', roads: '', paths: '', buildings: '' };
for (const feature of data.features) {
  const g = feature.geometry;
  const tags = feature.tags ?? {};
  if (feature.type === 'CampusBoundary')
    layers.boundary += rings(g)
      .map((r) => path(r, true, 2))
      .join('');
  else if (feature.type === 'OpenSpace')
    layers[tags.natural === 'water' ? 'water' : 'green'] += rings(g)
      .map((r) => path(r, true, 1.5))
      .join('');
  else if (feature.type === 'Building')
    layers.buildings += rings(g)
      .map((r) => path(r, true, 1.5))
      .join('');
  else if (feature.type === 'Road') layers.roads += path(g.coordinates, false, 2);
  else if (feature.type === 'Walkway' && tags.highway !== 'steps')
    layers.paths += path(g.coordinates, false, 2);
}

// Frame: the campus boundary, plus a margin.
const xs = [];
const ys = [];
for (const feature of data.features)
  if (feature.type === 'CampusBoundary')
    for (const ring of rings(feature.geometry))
      for (const [x, y] of ring.map(project)) {
        xs.push(x);
        ys.push(y);
      }
const pad = 40;
const frame = [
  Math.floor(Math.min(...xs) - pad),
  Math.floor(Math.min(...ys) - pad),
  Math.ceil(Math.max(...xs) - Math.min(...xs) + 2 * pad),
  Math.ceil(Math.max(...ys) - Math.min(...ys) + 2 * pad),
];

const out = {
  attribution: '© OpenStreetMap contributors, ODbL 1.0',
  retrievedAt: data.source?.retrievedAt ?? null,
  origin: [lon0, lat0],
  scale: [kx, ky],
  frame,
  ...layers,
};
fs.writeFileSync('src/data/campus-map.json', `${JSON.stringify(out)}\n`);
console.log(
  `campus-map.json: ${(fs.statSync('src/data/campus-map.json').size / 1024).toFixed(1)} KiB, frame ${frame.join(' ')}`,
);
