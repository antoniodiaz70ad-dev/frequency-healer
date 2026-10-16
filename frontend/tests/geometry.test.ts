import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeometryScene, geometrySignature } from '../src/lib/geometry/math';
import { GEOMETRY_PRESETS, cloneGeometryConfig } from '../src/lib/geometry/presets';
import { renderGeometrySvg } from '../src/lib/geometry/export';
import { rasterizeGeometrySvg } from '../src/lib/geometry/browserExport';
import { normalizeStarParameters, starCycleCount, starKind, validateGeometryConfig } from '../src/lib/geometry/validation';

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

test('vertices and step normalize atomically across every control boundary',()=>{
  assert.deepEqual(normalizeStarParameters({vertices:72,step:71},{vertices:3}),{vertices:3,step:2});
  assert.deepEqual(normalizeStarParameters({vertices:3,step:2},{vertices:72}),{vertices:72,step:2});
  assert.deepEqual(normalizeStarParameters({vertices:72,step:2},{step:71}),{vertices:72,step:71});
  assert.deepEqual(normalizeStarParameters({vertices:12,step:4},{step:Number.NaN}),{vertices:12,step:4});
  for(let vertices=3;vertices<=72;vertices++){
    for(const requestedStep of [1,vertices-1,71]){
      const pair=normalizeStarParameters({vertices:7,step:2},{vertices,step:requestedStep});
      assert.ok(pair.step>=1&&pair.step<pair.vertices);
      const config={...cloneGeometryConfig(GEOMETRY_PRESETS[0]),...pair};
      assert.deepEqual(validateGeometryConfig(config),[]);
      assert.doesNotThrow(()=>createGeometryScene(config));
    }
  }
});

test('successive family, star parameter and preset changes remain valid and deterministic',()=>{
  const families=['star-polygon','orbital-circles','radial-wheel','lissajous','polar'] as const;
  let current=cloneGeometryConfig(GEOMETRY_PRESETS[0]);
  for(const preset of GEOMETRY_PRESETS){
    current=cloneGeometryConfig(preset);
    for(const family of families){
      current={...current,family,...normalizeStarParameters(current,{vertices:72,step:71})};
      assert.deepEqual(validateGeometryConfig(current),[]);
      assert.doesNotThrow(()=>createGeometryScene(current));
      current={...current,...normalizeStarParameters(current,{vertices:3})};
      assert.deepEqual(validateGeometryConfig(current),[]);
    }
  }
});

test('PNG rasterization releases its source URL on success and failure',async()=>{
  const revoked:string[]=[];
  const makeImage=(fails=false)=>{const image:{onload:null|(()=>void);onerror:null|(()=>void);_src:string}= {onload:null,onerror:null,_src:''};Object.defineProperty(image,'src',{set(value:string){image._src=value;queueMicrotask(()=>fails?image.onerror?.():image.onload?.());}});return image;};
  const successEnvironment={createImage:()=>makeImage() as unknown as HTMLImageElement,createCanvas:()=>({width:0,height:0,getContext:()=>({drawImage(){}}),toBlob:(callback:(blob:Blob|null)=>void)=>callback(new Blob(['png'],{type:'image/png'}))}) as unknown as HTMLCanvasElement,createObjectUrl:()=> 'blob:success',revokeObjectUrl:(url:string)=>revoked.push(url)};
  assert.equal((await rasterizeGeometrySvg('<svg/>',32,successEnvironment)).type,'image/png');
  const failureEnvironment={...successEnvironment,createImage:()=>makeImage(true) as unknown as HTMLImageElement,createObjectUrl:()=> 'blob:failure'};
  await assert.rejects(()=>rasterizeGeometrySvg('<svg/>',32,failureEnvironment),/decodificar/);
  assert.deepEqual(revoked,['blob:success','blob:failure']);
});
