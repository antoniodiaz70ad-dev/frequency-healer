import { useId, useMemo } from 'react';
import { createGeometryScene } from '@/lib/geometry/math';
import type { GeometryConfig, GeometryPoint } from '@/lib/geometry/types';
import styles from './geometry.module.css';

const xy=(point:GeometryPoint)=>`${500+point.x*420},${500+point.y*420}`;

export default function GeometrySvg({config,label,className='',animated=false}:{config:GeometryConfig;label?:string;className?:string;animated?:boolean}){
  const gradientId=useId().replace(/:/g,'');
  const scene=useMemo(()=>createGeometryScene(config),[config]);
  return <svg className={`${styles.artwork} ${className}`.trim()} viewBox="0 0 1000 1000" role="img" aria-label={label??`${config.name}, geometría artística`}>
    <defs><radialGradient id={gradientId}><stop offset="0" stopColor={config.color} stopOpacity=".11"/><stop offset="1" stopColor={config.color} stopOpacity="0"/></radialGradient></defs>
    <rect width="1000" height="1000" rx="46" fill="#050914"/>
    <circle cx="500" cy="500" r="455" fill={`url(#${gradientId})`}/>
    <g className={animated?styles.frequencyMotion:undefined} data-frequency-motion={animated?'active':'paused'} fill="none" stroke={config.color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      {scene.polylines.map((line,index)=><polyline key={`p-${index}`} points={line.map(xy).join(' ')}/>)}
      {scene.circles.map((circle,index)=><circle key={`c-${index}`} cx={500+circle.x*420} cy={500+circle.y*420} r={circle.radius*420}/>)}
      {scene.radialLines.map((line,index)=><line key={`l-${index}`} x1={500+line.from.x*420} y1={500+line.from.y*420} x2={500+line.to.x*420} y2={500+line.to.y*420}/>)}
    </g>
  </svg>;
}
