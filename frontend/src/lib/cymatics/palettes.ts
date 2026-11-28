export const paletteNames = { original: 'Original', amber: 'Ámbar', blue: 'Azul', gray: 'Gris' } as const;
export type CymaticsPalette = keyof typeof paletteNames;
export const palettes = {
  original: {field:'#ab76e8',positive:'#32d8dc',negative:'#a45ee5',node:'#79f4dc',grainDark:'#bfae8a',grainLight:'#e9dcc0'},
  amber: {field:'#ffc36a',positive:'#ffe895',negative:'#c37744',node:'#ffe0a4',grainDark:'#c28638',grainLight:'#ffe0a2'},
  blue: {field:'#83caff',positive:'#a1eaff',negative:'#8d83dc',node:'#c5e6ff',grainDark:'#629fd0',grainLight:'#c6e9ff'},
  gray: {field:'#d5d5d5',positive:'#efefef',negative:'#262626',node:'#efefef',grainDark:'#999999',grainLight:'#e8e8e8'},
};
export function rgbChannels(hex:string) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)); }
function ramp(from:string,to:string) {
  const a=rgbChannels(from), b=rgbChannels(to);
  return Array.from({length:256},(_,i)=>'rgb('+a.map((v,k)=>Math.round(v+(b[k]-v)*i/255)).join(' ')+')');
}
export function canvasColors(key:CymaticsPalette) {
  const p=palettes[key], zero=key==='gray'?'#828282':'#12131b';
  const field=ramp(key==='gray'?'#101010':'#0a0e16',p.field),positive=ramp(zero,p.positive),negative=ramp(zero,p.negative),grains=ramp(p.grainDark,p.grainLight);
  const index=(v:number)=>Math.round(255*Math.min(1,Math.abs(v)));
  return { field:(t:number)=>field[index(t)],phase:(v:number)=>(v>=0?positive:negative)[index(v)],grain:(t:number)=>grains[index(t)],node:p.node };
}
