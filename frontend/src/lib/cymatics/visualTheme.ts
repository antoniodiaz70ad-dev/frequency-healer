/** Graphite and natural sand, shared by analytical fields and lightweight canvases. */
export const CYMATICS_COLORS = {
  background: '#030509',
  metalLight: '#414950',
  metalMid: '#303840',
  metalDark: '#1d242b',
  rim: '#5f666e',
  sand: '#d4c5a5',
  oppositePhase: '#828b91',
} as const;
export function amplitudeRgb(value: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, value));
  return [Math.round(28 + 205 * t), Math.round(34 + 186 * t), Math.round(41 + 151 * t)];
}
export const amplitudeColor = (value: number) => `rgb(${amplitudeRgb(value).join(' ')})`;
export function phaseColor(value: number) {
  const t = Math.min(1, Math.abs(value));
  const target = value >= 0 ? [233, 220, 192] : [130, 139, 145];
  return `rgb(${target.map((channel, index) => Math.round([28, 34, 41][index] + (channel - [28, 34, 41][index]) * t)).join(' ')})`;
}
