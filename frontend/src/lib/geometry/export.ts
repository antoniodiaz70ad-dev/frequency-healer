import { createGeometryScene } from './math';
import type { GeometryConfig, GeometryPoint } from './types';

const esc=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
const xy=(p:GeometryPoint)=>`${(500+p.x*420).toFixed(2)},${(500+p.y*420).toFixed(2)}`;

export function renderGeometrySvg(config: GeometryConfig): string {
  const scene=createGeometryScene(config),color=esc(config.color),label=esc(`${config.name}, geometría artística`);
  const lines=scene.polylines.map(points=>`<polyline points="${points.map(xy).join(' ')}"/>`).join('');
  const circles=scene.circles.map(circle=>`<circle cx="${(500+circle.x*420).toFixed(2)}" cy="${(500+circle.y*420).toFixed(2)}" r="${(circle.radius*420).toFixed(2)}"/>`).join('');
  const radials=scene.radialLines.map(line=>`<line x1="${(500+line.from.x*420).toFixed(2)}" y1="${(500+line.from.y*420).toFixed(2)}" x2="${(500+line.to.x*420).toFixed(2)}" y2="${(500+line.to.y*420).toFixed(2)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="${label}"><rect width="1000" height="1000" fill="#050914"/><g fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${lines}${circles}${radials}</g><text x="40" y="948" fill="#c2c8d2" font-family="monospace" font-size="24">GEOMETRÍA ARTÍSTICA · ${esc(config.acousticFrequencyHz.toFixed(2))} Hz (variable separada)</text></svg>`;
}
