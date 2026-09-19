export type SafeVoiceCommand =
  | { type: 'volume_relative'; delta: -10 | -5 | 5 | 10 }
  | { type: 'mark_moment'; note?: string }
  | { type: 'stop_session' }
  | { type: 'none'; transcript: string };
export function parseCommand(transcript: string): SafeVoiceCommand {
  const value = transcript.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
  if (['deten la sesion', 'detener sesion', 'stop session', 'stop the session'].includes(value)) return { type: 'stop_session' };
  if (['baja el volumen', 'bajar volumen', 'lower the volume', 'volume down'].includes(value)) return { type: 'volume_relative', delta: -5 };
  if (['sube el volumen', 'subir volumen', 'raise the volume', 'volume up'].includes(value)) return { type: 'volume_relative', delta: 5 };
  const volume = value.match(/^(baja|sube|lower|raise) (?:el volumen|the volume) (5|10)$/);
  if (volume) return { type: 'volume_relative', delta: (Number(volume[2]) * (['baja', 'lower'].includes(volume[1]) ? -1 : 1)) as -10 | -5 | 5 | 10 };
  if (['marca este momento', 'mark this moment'].includes(value)) return { type: 'mark_moment' };
  return { type: 'none', transcript: transcript.trim().slice(0, 500) };
}
