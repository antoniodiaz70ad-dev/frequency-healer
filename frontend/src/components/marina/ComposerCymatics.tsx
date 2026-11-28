'use client';

import { memo, useMemo, useState } from 'react';
import type {CymaticsPalette} from '@/lib/cymatics/palettes';
import CymaticsPalettePicker from '@/components/cymatics/CymaticsPalettePicker';
import CymaticsCanvas from '@/components/cymatics/CymaticsCanvas';
import { defaultCymaticsConfig } from '@/lib/cymatics/physics';
import { computeComposerCymatics, type ComposerChannel } from '@/lib/marina/composerCymatics';
import type { ComposerRecipe } from '@/lib/marina/composer';
import styles from './marina.module.css';

function ComposerCymatics({recipe,palette,onPaletteChange}:{recipe:ComposerRecipe;palette:CymaticsPalette;onPaletteChange:(color:CymaticsPalette)=>void}) {
  const [channel, setChannel] = useState<ComposerChannel>('left');
  const config = useMemo(() => ({ ...defaultCymaticsConfig(), view: 'field' as const, autoExposure: true, renderQuality: 'low' as const }), []);
  const result = useMemo(() => {
    try { return { ...computeComposerCymatics(recipe, channel, config), error: '' }; }
    catch { return { components: [], field: null, notices: [], error: 'Completa los ajustes de las capas para calcular la cimática.' }; }
  }, [recipe, channel, config]);
  const canvasConfig = useMemo(() => ({ ...config, palette, channelFrequenciesHz: result.components.map(value => value.hz) }), [config, palette, result.components]);
  const stereo = recipe.layers.some(layer => layer.enabled && layer.level > 0 && layer.mode === 'binaural');
  return <section className={styles.composerCymatics} aria-label="Cimática del compositor">
    <p className={styles.eyebrow}>Tus capas → una placa virtual</p>
    <h3>Cimática de tu composición</h3>
    <p className={styles.muted}>La figura se recalcula al cambiar frecuencias, niveles o capas activas. Las zonas oscuras tienen menor vibración media.</p>
    <CymaticsPalettePicker value={palette} onChange={onPaletteChange}/>
    {stereo && <label className={styles.field}>Canal de la simulación<select aria-label="Canal de la simulación" value={channel} onChange={event => setChannel(event.target.value as ComposerChannel)}><option value="left">Izquierdo</option><option value="right">Derecho</option></select></label>}
    {result.field && <CymaticsCanvas config={canvasConfig} field={result.field} label={`Cimática · ${stereo ? channel === 'left' ? 'izquierdo' : 'derecho' : 'mono'} · promedio RMS`} animateVibration={false} />}
    <p className={styles.muted} data-testid="composer-cymatics-spectrum">{result.components.length > 0 ? `Componentes del canal ${channel === 'left' ? 'izquierdo' : 'derecho'}: ${result.components.map(value => Number(value.hz.toFixed(6))).join(' · ')} Hz` : 'Sin componentes activos.'}</p>
    {result.error && <p role="status">{result.error}</p>}
    {result.notices.map(notice => <p className={styles.muted} key={notice}>{notice}</p>)}
    <p className={styles.muted}>Es una simulación de la placa, no una medición de tu cuerpo. El brillo se ajusta para distinguir la forma; no indica potencia ni beneficio.</p>
    <details><summary>Cómo se relaciona con el sonido</summary>
      <p>Usa los niveles normalizados del compositor. Las pulsaciones incluyen portadora y bandas laterales. En binaural, cada canal se calcula por separado; la diferencia entre oídos no se dibuja como un tono adicional.</p>
      <p>Vista del promedio RMS a largo plazo: la figura puede permanecer quieta durante el audio y no reproduce cada pulso o batido. Las frecuencias coincidentes se combinan con su fase; las distintas se promedian por energía. No todas las mezclas forman líneas nodales estables.</p>
      <p>Placa de aluminio de 32 × 32 cm y 1 mm, bordes simplemente apoyados, excitación en (0.31, 0.37), amortiguamiento 0.012 y 25 modos. Fuerza relativa sin calibración; se omiten el volumen maestro y las transiciones. Cambiar la placa cambia la figura.</p>
    </details>
  </section>;
}

export default memo(ComposerCymatics);
