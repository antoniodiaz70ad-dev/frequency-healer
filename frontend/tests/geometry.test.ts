import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeometryScene, geometrySignature } from '../src/lib/geometry/math';
import { GEOMETRY_PRESETS, cloneGeometryConfig } from '../src/lib/geometry/presets';
import { renderGeometrySvg } from '../src/lib/geometry/export';
import { starCycleCount, starKind, validateGeometryConfig } from '../src/lib/geometry/validation';

test('seven artistic presets are valid, deterministic and cover every requested family',()=>{
  assert.deepEqual(GEOMETRY_PRESETS.map(row=>row.acousticFrequencyHz),[33,66,99,333,666,999,1998]);
  assert.deepEqual(new Set(GEOMETRY_PRESETS.map(row=>row.family)),new Set(['star-polygon','orbital-circles','radial-wheel','lissajous','polar']));
  for(const preset of GEOMETRY_PRESETS){assert.deepEqual(validateGeometryConfig(preset),[]);assert.equal(preset.classification,'ARTISTIC_GEOMETRY');assert.deepEqual(createGeometryScene(preset),createGeometryScene(preset));}
});

test('star engine distinguishes single-cycle and compound polygons without imposing coprimality',()=>{
  assert.equal(starKind(7,2),'single-cycle');assert.equal(starCycleCount(7,2),1);
  assert.equal(starKind(12,4),'compound');assert.equal(starCycleCount(12,4),4);
  const compound=cloneGeometryConfig(GEOMETRY_PRESETS.find(row=>row.id==='reference-666')!);
  assert.equal(createGeometryScene(compound).polylines.length,4);
});

test('acoustic frequency is independent from geometry identity and scene output',()=>{
  const a=cloneGeometryConfig(GEOMETRY_PRESETS[3]),b={...a,acousticFrequencyHz:432};
  assert.deepEqual(createGeometryScene(a),createGeometryScene(b));
  assert.equal(geometrySignature(a),geometrySignature(b));
});

test('geometrically relevant fields change the signature and reset clones remain detached',()=>{
  const original=GEOMETRY_PRESETS[0],copy=cloneGeometryConfig(original),rotated={...copy,rotationDeg:copy.rotationDeg+15};
  assert.notEqual(geometrySignature(copy),geometrySignature(rotated));copy.name='Changed';assert.notEqual(copy.name,original.name);
});

test('SVG export is standalone, classified and contains no scripts or raster reference',()=>{
  const config=GEOMETRY_PRESETS[6],svg=renderGeometrySvg(config);
  assert.match(svg,/^<svg xmlns=/);assert.match(svg,/GEOMETRÍA ARTÍSTICA/);assert.match(svg,/1998\.00 Hz/);assert.doesNotMatch(svg,/<script|data:image|<image/i);
});

test('validation rejects unsafe numeric and presentation values',()=>{
  const config=cloneGeometryConfig(GEOMETRY_PRESETS[0]);
  assert.ok(validateGeometryConfig({...config,scale:Number.NaN}).length);
  assert.ok(validateGeometryConfig({...config,step:config.vertices}).length);
  assert.ok(validateGeometryConfig({...config,color:'red'}).length);
});
