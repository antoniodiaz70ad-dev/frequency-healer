/** UI dictionaries are independent of parser vocabulary and deterministic rule IDs. */
export const dictionaries = {
  es: {
    goals: { clarity: 'Claridad', focus: 'Enfoque', relaxation: 'Relajación', reflection: 'Reflexión', creative_exploration: 'Exploración creativa', sleep_preparation: 'Preparación para dormir', custom: 'Personalizado' },
    states: { calm: 'Calma', focus: 'Enfoque', openness: 'Apertura', grounded: 'Presencia', creative: 'Creatividad', restful: 'Descanso' },
    rationale: { clarity: 'Recorrido ascendente y retorno a la raíz.', focus: 'Estructura simple, estable y repetible.', relaxation: 'Intervalos cercanos e intensidad inicial suave.', reflection: 'Progresión breve y retorno.', creative_exploration: 'Trayectoria experimental 13/12 de expansión y retorno.', sleep_preparation: 'Diseño mínimo y volumen bajo; no promete sueño.', custom: 'Configuración neutral; revisa todos los parámetros.' },
  },
  en: {
    goals: { clarity: 'Clarity', focus: 'Focus', relaxation: 'Relaxation', reflection: 'Reflection', creative_exploration: 'Creative exploration', sleep_preparation: 'Sleep preparation', custom: 'Custom' },
    states: { calm: 'Calm', focus: 'Focus', openness: 'Openness', grounded: 'Grounded', creative: 'Creative', restful: 'Restful' },
    rationale: { clarity: 'Ascending path and return to the root.', focus: 'Simple, stable, repeating structure.', relaxation: 'Close intervals and gentle initial intensity.', reflection: 'Short progression and return.', creative_exploration: 'Experimental 13/12 expansion and return.', sleep_preparation: 'Minimal design and low volume; no promise of sleep.', custom: 'Neutral configuration; review all parameters.' },
  },
} as const;
