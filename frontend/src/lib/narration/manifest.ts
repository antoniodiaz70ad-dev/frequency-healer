/** Arthur / ElevenLabs. Fixed public guide text only; personal intentions are never synthesized. */
export const ARTHUR_VOICE_VERSION = 'arthur-es-v1';
export const ARTHUR_GUIDES = [
  {
    "key": "crystals-prepare",
    "text": "Sostén la pieza cómodamente o colócala frente a ti. Reconoce cómo estás. Respira con naturalidad, sin retenciones ni presión sobre las puntas.",
    "src": "/audio/arthur-es-v1/crystals-prepare.mp3"
  },
  {
    "key": "crystals-define",
    "text": "Formula una sola intención. Reconoce qué papel eliges para esta herramienta. Reúne una escena concreta y un sentimiento que puedas sostener cómodamente.",
    "src": "/audio/arthur-es-v1/crystals-define.mp3"
  },
  {
    "key": "crystals-program",
    "text": "Mantén juntos tu frase, la escena y el sentimiento. Puedes decir la frase suavemente tres veces, dejando espacio entre repeticiones. Observa sin forzar una sensación.",
    "src": null
  },
  {
    "key": "crystals-stabilize",
    "text": "Deja de añadir instrucciones. Las capas se retiran progresivamente. Permanece con la intención elegida sin aumentar su intensidad.",
    "src": null
  },
  {
    "key": "crystals-close",
    "text": "Suelta la imagen y deja la pieza en su lugar. Permanece en silencio. Después registra lo vivido y una acción que corresponda a tu intención.",
    "src": "/audio/arthur-es-v1/crystals-close.mp3"
  },
  {
    "key": "marina-zero",
    "text": "Siente el apoyo del cuerpo. Respira con naturalidad. Observa tu experiencia y permite que la reacción se aquiete.",
    "src": "/audio/arthur-es-v1/marina-zero.mp3"
  },
  {
    "key": "marina-emotion",
    "text": "Evoca una experiencia de alegría, amor o gratitud. Observa cómo se siente en ti. Dale espacio antes de construir la imagen.",
    "src": null
  },
  {
    "key": "marina-blueprint",
    "text": "Construye la escena que deseas explorar. Añade entorno, sensaciones y relaciones. Mantén la emoción mientras desarrollas sus detalles.",
    "src": null
  },
  {
    "key": "marina-intensify",
    "text": "Profundiza en la emoción y la escena de una manera cómoda. Observa qué cambia. Puedes permanecer simplemente con la imagen.",
    "src": null
  },
  {
    "key": "marina-hold",
    "text": "Sostén la escena y el sentimiento. Permite una estabilidad cómoda. Advierte sensaciones, imágenes o ideas sin apresurarte a explicarlas.",
    "src": null
  },
  {
    "key": "marina-release",
    "text": "Deja caer la imagen. Respira y vuelve al entorno. Conserva lo que quieras registrar y elige cómo llevar tu intención al día.",
    "src": null
  },
  {
    "key": "marina-neutral",
    "text": "Respira con naturalidad. Reconoce el deseo y la emoción que lo contradice. Permanece sin alimentarlos ni combatirlos.",
    "src": null
  },
  {
    "key": "marina-choose",
    "text": "Elige una sola dirección. Formula una intención concreta y comprensible, sin apresurar el resultado.",
    "src": null
  },
  {
    "key": "marina-integrate",
    "text": "Reúne tu escena, tu frase y un sentimiento que puedas sostener cómodamente. Observa si apuntan en la misma dirección.",
    "src": null
  },
  {
    "key": "marina-express",
    "text": "Di tu frase suavemente o escucha tu grabación. Advierte cómo se siente al escucharla. Después deja espacio.",
    "src": null
  },
  {
    "key": "marina-settle",
    "text": "Permanece en silencio sin añadir instrucciones. Al terminar puedes prolongar esta quietud y después registrar tu experiencia.",
    "src": null
  }
] as const;
export type ArthurGuideKey = typeof ARTHUR_GUIDES[number]['key'];
export const arthurGuide = (key: string) => ARTHUR_GUIDES.find(guide => guide.key === key);
