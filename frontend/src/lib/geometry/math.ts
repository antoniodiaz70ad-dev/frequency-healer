import type { GeometryConfig, GeometryPoint, GeometryScene } from './types';
import { starCycleCount, validateGeometryConfig } from './validation';

const TAU = Math.PI * 2;
const point = (angle: number, radius: number, rotation: number): GeometryPoint => ({
  x: Math.cos(angle + rotation) * radius,
  y: Math.sin(angle + rotation) * radius,
});

function starPolylines(config: GeometryConfig): GeometryPoint[][] {
  const cycles = starCycleCount(config.vertices, config.step);
  const length = config.vertices / cycles;
  const rotation = config.rotationDeg * Math.PI / 180 + config.phase * TAU / config.vertices;
  return Array.from({ length: cycles }, (_, start) => {
    const line: GeometryPoint[] = [];
    let index = start;
    for (let i = 0; i < length; i++) {
      line.push(point(index / config.vertices * TAU, config.scale, rotation));
      index = (index + config.step) % config.vertices;
    }
    line.push(line[0]);
    return line;
  });
}

export function createGeometryScene(config: GeometryConfig): GeometryScene {
  const errors = validateGeometryConfig(config);
  if (errors.length) throw new Error(errors.join('; '));
  const scene: GeometryScene = { polylines: [], circles: [], radialLines: [] };
  const rotation = config.rotationDeg * Math.PI / 180;
  if (config.family === 'star-polygon') scene.polylines = starPolylines(config);
  if (config.family === 'radial-wheel') {
    scene.circles.push({ x:0, y:0, radius:config.scale }, { x:0, y:0, radius:config.scale * .38 });
    for (let i=0;i<config.symmetry;i++) {
      const angle=rotation+i/config.symmetry*TAU;
      scene.radialLines.push({ from:point(angle,config.scale*.38,0), to:point(angle,config.scale,0) });
    }
    scene.polylines.push(...starPolylines({...config,vertices:Math.max(3,config.vertices),step:Math.min(config.step,config.vertices-1),scale:config.scale*.3}));
  }
  if (config.family === 'orbital-circles') {
    const orbitRadius=config.scale*.34, circleRadius=config.scale*(.28+.08*Math.sin(config.phase*TAU));
    for(let i=0;i<config.symmetry;i++){
      const center=point(i/config.symmetry*TAU,orbitRadius,rotation);
      scene.circles.push({...center,radius:circleRadius});
    }
    scene.circles.push({x:0,y:0,radius:config.scale*.14});
  }
  if (config.family === 'lissajous') {
    const a=Math.max(1,config.symmetry),b=Math.max(1,config.vertices-config.step),delta=config.phase*TAU;
    scene.polylines.push(Array.from({length:481},(_,i)=>{const t=i/480*TAU;return{x:Math.sin(a*t+delta)*config.scale,y:Math.sin(b*t)*config.scale};}));
  }
  if (config.family === 'polar') {
    const petals=Math.max(2,config.symmetry),phase=config.phase*TAU;
    scene.polylines.push(Array.from({length:721},(_,i)=>{const angle=i/720*TAU,r=config.scale*(.56+.38*Math.cos(petals*angle+phase));return point(angle,r,rotation);}));
    scene.circles.push({x:0,y:0,radius:config.scale*.12});
  }
  return scene;
}

export function geometrySignature(config: GeometryConfig): string {
  return [config.engineVersion,config.family,config.vertices,config.step,config.symmetry,config.rotationDeg,config.phase,config.scale,config.color].join(':');
}

/** Maps an acoustic reference to a deliberately slowed artistic rotation. */
export function frequencyToVisualMotion(frequencyHz: number): { durationSeconds: number; degreesPerSecond: number } {
  const safeFrequency = Math.min(20_000, Math.max(0.1, Number.isFinite(frequencyHz) ? frequencyHz : 0.1));
  const octavePosition = Math.log2(safeFrequency / 0.1) / Math.log2(20_000 / 0.1);
  const degreesPerSecond = 8 + octavePosition * 52;
  return { degreesPerSecond, durationSeconds: 360 / degreesPerSecond };
}
