export interface CymaticsProtocolV1 {
  id: string;
  version: 'cymatics-protocol-v1';
  title: string;
  question: string;
  steps: readonly string[];
  controlledVariables: readonly string[];
  measuredVariables: readonly string[];
}

export const CYMATICS_PROTOCOLS_V1: readonly CymaticsProtocolV1[] = [
  { id:'frequency-response',version:'cymatics-protocol-v1',title:'Respuesta frente a frecuencia',question:'¿Cómo cambia la amplitud calculada al variar solo la frecuencia?',steps:['Mantén superficie, punto de excitación y amortiguamiento.','Explora el rango sin audio.','Compara una frecuencia cercana al pico con otra alejada.'],controlledVariables:['superficie','parámetros físicos','excitación','amortiguamiento'],measuredVariables:['frecuencia Hz','amplitud RMS relativa'] },
  { id:'excitation-position',version:'cymatics-protocol-v1',title:'Posición de excitación',question:'¿Qué modos aparecen al mover el punto de excitación?',steps:['Selecciona una frecuencia propia.','Cambia un eje del punto de excitación.','Compara el mapa de modos sin cambiar los demás parámetros.'],controlledVariables:['superficie','frecuencia','amortiguamiento'],measuredVariables:['posición relativa x/y','modos acoplados'] },
  { id:'microphone-spectrum',version:'cymatics-protocol-v1',title:'Espectro de una fuente externa',question:'¿Qué componentes espectrales observa el micrófono local?',steps:['Silencia el generador.','Activa el micrófono explícitamente.','Observa FFT y espectrograma; registra solo el resumen.'],controlledVariables:['distancia/orientación declaradas por el usuario'],measuredVariables:['pico FFT Hz','magnitud dBFS','tono estimado Hz'] },
] as const;

export function getCymaticsProtocol(id:string):CymaticsProtocolV1 {
  const protocol=CYMATICS_PROTOCOLS_V1.find(row=>row.id===id);
  if(!protocol) throw new Error('Protocolo cimático desconocido.');
  return protocol;
}
