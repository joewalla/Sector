const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const sectorRequire = createRequire(path.join(root, 'artifacts/sector/package.json'));
const colors = { primary: 'primary', foreground: 'foreground', card: 'card', mutedForeground: 'muted', signalBlue: 'blue' };

// Execute the real native TSX and clustering logic. Only the platform boundary
// and theme hook are stubbed; the web renderer is never imported.
function loadSource(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : sectorRequire(name),
  }, { filename });
  return module.exports;
}

const { default: RouteMapPreview } = loadSource('artifacts/sector/components/route-map-preview.native.tsx', {
  'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' },
  'react-native': { View: 'View', Text: 'Text', StyleSheet: { create: (styles) => styles } },
  '@/hooks/useColors': { useColors: () => colors },
  '@/simulation/practice-stop-markers': loadSource('artifacts/sector/simulation/practice-stop-markers.ts'),
});

const points = [
  { latitude: 51.5, longitude: -0.12 },
  { latitude: 51.51, longitude: -0.1 },
  { latitude: 51.52, longitude: -0.08 },
];
const route = { geometry: points, durationSeconds: 180, distanceMeters: 900, steps: [], attribution: 'Synthetic native fixture; not Mapbox or GPS data' };
const props = {
  route,
  destinationName: 'Synthetic destination',
  position: points[1],
  sectorBoundaries: [{ id: 1, position: points[1] }],
  practiceStops: [{ number: 1, position: points[1] }, { number: 2, position: points[1] }],
};

function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}

function assertUnavailable(result) {
  assert.equal(result.type, 'Text');
  assert.equal(result.props.children, 'Route shape unavailable. No replacement geometry has been generated.');
  assert.equal(elements(result).some((node) => ['MapView', 'Marker', 'Polyline'].includes(node.type)), false);
}

function assertValid(result, expectedPoints = points) {
  const nodes = elements(result);
  const map = nodes.find((node) => node.type === 'MapView');
  assert.ok(map, 'native map must recover');
  for (const value of Object.values(map.props.initialRegion)) assert.ok(Number.isFinite(value));
  assert.ok(map.props.initialRegion.latitudeDelta > 0);
  assert.ok(map.props.initialRegion.longitudeDelta > 0);
  const line = nodes.find((node) => node.type === 'Polyline');
  assert.equal(JSON.stringify(line.props.coordinates), JSON.stringify(expectedPoints), 'never replace or omit route points');
  const markers = nodes.filter((node) => node.type === 'Marker');
  assert.equal(markers.length, 7, 'start, end, boundary, position, two anchors and grouped label');
  assert.equal(markers[0].props.coordinate, expectedPoints[0]);
  assert.equal(markers[1].props.coordinate, expectedPoints.at(-1));
  assert.equal(markers[2].props.coordinate.latitude, props.sectorBoundaries[0].position.latitude);
  assert.equal(markers[3].props.coordinate.longitude, props.position.longitude);
  assert.equal(markers[4].props.coordinate, props.practiceStops[0].position);
  assert.equal(markers[5].props.coordinate, props.practiceStops[1].position);
  assert.equal(markers[6].props.title, 'Synthetic practice stops 1, 2');
}

const invalidGeometries = [
  ['null geometry', null],
  ['undefined geometry', undefined],
  ['non-array geometry', { latitude: 51.5, longitude: -0.12 }],
  ['empty geometry', []],
  ['singleton geometry', [points[0]]],
  ['sparse geometry', [points[0], , points[2]]],
];
for (const [name, point] of [
  ['null', null],
  ['undefined', undefined],
  ['missing latitude', { longitude: 0 }],
  ['missing longitude', { latitude: 0 }],
  ['string latitude', { latitude: '51.5', longitude: 0 }],
  ['string longitude', { latitude: 0, longitude: '0' }],
  ['NaN latitude', { latitude: NaN, longitude: 0 }],
  ['NaN longitude', { latitude: 0, longitude: NaN }],
  ['infinite latitude', { latitude: Infinity, longitude: 0 }],
  ['infinite longitude', { latitude: 0, longitude: -Infinity }],
  ['latitude above range', { latitude: 90.01, longitude: 0 }],
  ['latitude below range', { latitude: -90.01, longitude: 0 }],
  ['longitude above range', { latitude: 0, longitude: 180.01 }],
  ['longitude below range', { latitude: 0, longitude: -180.01 }],
]) {
  // Bad points at the start, middle and end must all reject the entire shape.
  for (const index of [0, 1, 2]) {
    const geometry = [...points];
    geometry[index] = point;
    invalidGeometries.push([`${name} point at ${index}`, geometry]);
  }
}

for (const [name, geometry] of invalidGeometries) {
  test(`${name}: safe fallback and valid → invalid → valid recovery`, () => {
    assertValid(RouteMapPreview(props));
    const malformed = { ...route, geometry };
    const before = JSON.stringify(malformed);
    assertUnavailable(RouteMapPreview({ ...props, route: malformed }));
    assert.equal(JSON.stringify(malformed), before, 'must not repair the response');
    // Keep destination and duration identical to expose stale-map recovery.
    assertValid(RouteMapPreview(props));
  });
}

test('missing geometry shows fallback, then a different valid shape recovers', () => {
  const { geometry, ...missingGeometry } = route;
  assertUnavailable(RouteMapPreview({ ...props, route: missingGeometry }));
  const recovered = points.map((point) => ({ latitude: point.latitude + 1, longitude: point.longitude + 1 }));
  assertValid(RouteMapPreview({ ...props, route: { ...route, geometry: recovered } }), recovered);
});

test('minimal valid shape renders only original endpoints without optional overlays', () => {
  const result = RouteMapPreview({ route: { ...route, geometry: points.slice(0, 2) }, destinationName: props.destinationName });
  const nodes = elements(result);
  assert.equal(nodes.filter((node) => node.type === 'Marker').length, 2);
  assert.equal(nodes.find((node) => node.type === 'Polyline').props.coordinates.length, 2);
});

test('valid coordinate limits and zero-span axes keep the viewport finite', () => {
  for (const geometry of [
    [{ latitude: -90, longitude: -180 }, { latitude: 90, longitude: 180 }],
    [{ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }],
    [{ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }],
  ]) assertValid(RouteMapPreview({ ...props, route: { ...route, geometry } }), geometry);
});
