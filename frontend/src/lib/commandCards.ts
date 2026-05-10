import { CommandCard, CommandPhase } from './types';

/**
 * Tarjetas de Comando para sesiones de proyección consciente.
 *
 * Compendio práctico de instrucciones que el practicante debe memorizar
 * antes de iniciar una sesión binaural profunda. Una vez fuera del cuerpo
 * la consciencia analítica está atenuada y no es posible "consultar" la
 * app — por eso el material debe revisarse previamente.
 *
 * Las tarjetas se basan en testimonios y enseñanzas públicas de
 * practicantes contemporáneos del fenómeno (Robert Monroe, William
 * Buhlman, Darius J. Wright, etc.) sin reproducir audio ni texto
 * licenciado de ninguno de ellos.
 */

export const PHASE_INFO: Record<CommandPhase, {
  label: string;
  order: number;
  color: string;
  icon: string;
  description: string;
}> = {
  preparacion: {
    label: 'Preparación',
    order: 1,
    color: '#67e8f9',
    icon: '🌙',
    description: 'Antes de la sesión: cuándo, cómo, intención.',
  },
  induccion: {
    label: 'Inducción',
    order: 2,
    color: '#a78bfa',
    icon: '〰️',
    description: 'Durante la parálisis: vibraciones, calma, espera lúcida.',
  },
  salida: {
    label: 'Salida Activa',
    order: 3,
    color: '#fbbf24',
    icon: '↗',
    description: 'El momento de desenganchar: rodar, sentarse, alejarse.',
  },
  estabilizacion: {
    label: 'Estabilización',
    order: 4,
    color: '#4ade80',
    icon: '✦',
    description: 'Justo afuera: anclar visión, comandar claridad.',
  },
  exploracion: {
    label: 'Exploración',
    order: 5,
    color: '#60a5fa',
    icon: '◎',
    description: 'Estable y fuera: navegar, telepatía, destino.',
  },
  post: {
    label: 'Post-sesión',
    order: 6,
    color: '#f87171',
    icon: '∽',
    description: 'Al regresar: registro, descanso, prevención de burnout.',
  },
};

export const COMMAND_CARDS: CommandCard[] = [
  // ── Preparación ─────────────────────────────────────────────────────
  {
    id: 'wbtb',
    phase: 'preparacion',
    title: 'Romper el ciclo de sueño',
    whenToUse: 'Antes de programar la sesión binaural.',
    body:
      'No intentes la sesión al acostarte por la noche: el cansancio te derrumba a sueño profundo y pierdes la lucidez. Duerme primero unas 4-6 horas, despierta entre las 2:00 y 3:00 a.m., y entonces inicia la pista binaural.',
    why:
      'A esa hora el cerebro está saturado de REM y la mente analítica se reactiva con facilidad mientras el cuerpo permanece dispuesto a recaer en parálisis. Es la ventana fisiológica de máxima eficiencia.',
    tags: ['wbtb', 'horario', 'sleep-cycle'],
  },
  {
    id: 'caja-energia',
    phase: 'preparacion',
    title: 'Caja de Conversión de Energía',
    whenToUse: 'Justo antes de iniciar la pista, mientras te acomodas.',
    body:
      'Visualiza un cofre, una caja fuerte o un contenedor de cualquier forma. Deposita simbólicamente cada preocupación, deuda, conflicto o tarea pendiente del día. Cierra la caja. Imagina que queda fuera del campo de la sesión.',
    why:
      'El sistema nervioso simpático se mantiene activo si el ego sigue procesando preocupaciones materiales. Externalizar las ataduras libera ancho de banda atencional para la inducción.',
    tags: ['mental-prep', 'caja', 'energy-conversion-box'],
  },
  {
    id: 'respiracion-478',
    phase: 'preparacion',
    title: 'Respiración 4-7-8',
    whenToUse: 'Mientras suena el primer tramo de la pista, antes de la parálisis.',
    body:
      'Inhala por la nariz contando 4. Retén el aire contando 7. Exhala por la boca, lentamente, contando 8. Repite 4-6 ciclos. Después deja que la respiración se vuelva natural y pasiva.',
    why:
      'Activa el nervio vago y reduce frecuencia cardíaca. La exhalación prolongada baja el tono simpático y prepara el cuerpo para la atonía.',
    tags: ['respiracion', 'vagal', 'calm'],
  },
  {
    id: 'declaracion-intencion',
    phase: 'preparacion',
    title: 'Declaración de intención',
    whenToUse: 'Después de la respiración, antes de soltar el cuerpo.',
    body:
      'Repite mental o verbalmente, con autoridad serena: "Tengo la intención de estar fuera de mi cuerpo con completa conciencia". Personalízala con tu objetivo (sanación, encuentro, exploración). Repite sin tensión hasta que se vuelva fondo.',
    why:
      'El subconsciente no actúa por petición sino por mandato. Una intención clara y declarada es la semilla que el sistema activador reticular utiliza como dirección al modular los estados.',
    command: 'Tengo la intención de estar fuera de mi cuerpo con completa conciencia.',
    tags: ['intencion', 'comando', 'mandato'],
  },
  {
    id: 'checklist-fisico',
    phase: 'preparacion',
    title: 'Checklist físico',
    whenToUse: 'Inmediatamente antes de presionar play.',
    body:
      '✓ Auriculares estéreo conectados.\n✓ Antifaz o ropa que bloquee la luz por completo.\n✓ Posición boca arriba o ligeramente lateral, manos sin cruzar.\n✓ Ropa holgada, sin cinturón, ni reloj, ni cadenas.\n✓ Tracto digestivo en ayunas (>60 min sin comer).\n✓ Vejiga vacía.\n✓ Habitación fresca y silenciosa.',
    why:
      'Cualquier estímulo somático persistente (presión, calor, hambre) reactiva la corteza sensorial e interrumpe el arrastre. La preparación física es tan importante como la mental.',
    tags: ['checklist', 'fisico', 'auriculares'],
  },

  // ── Inducción ──────────────────────────────────────────────────────
  {
    id: 'estoicismo-emocional',
    phase: 'induccion',
    title: 'Estoicismo emocional absoluto',
    whenToUse: 'Cuando comiences a sentir vibraciones, hormigueo, ruidos cíclicos, peso o "estallidos".',
    body:
      'Permanece completamente neutro. Ni euforia por estar lográndolo, ni miedo por la intensidad. Las sensaciones intensas (vientos, zumbidos altos, electricidad) son señales correctas, no peligro. Déjalas pasar como nubes.',
    why:
      'Cualquier oleada emocional fuerte excita el cuerpo físico. El campo magnético del cuerpo te succiona instantáneamente al despertar. El miedo y la euforia tienen el mismo efecto: snap-back inmediato.',
    tags: ['calma', 'snap-back', 'no-fear'],
  },
  {
    id: 'no-pasividad',
    phase: 'induccion',
    title: 'No te quedes pasivo esperando',
    whenToUse: 'Cuando la parálisis está completa y sientes la "desconexión".',
    body:
      'No esperes a que algo te saque mágicamente del cuerpo. La separación es un acto de voluntad. Cuando reconozcas la atonía y la disociación cerca, pasa al siguiente bloque (Salida Activa) sin dudar.',
    why:
      'Muchos principiantes alcanzan la parálisis y la dejan ir. La ventana de salida es corta — si no actúas, el cerebro se desliza a sueño NREM ordinario.',
    tags: ['pasividad', 'agency', 'voluntad'],
  },
  {
    id: 'no-tragar',
    phase: 'induccion',
    title: 'No tragar saliva, no moverse',
    whenToUse: 'Durante toda la fase de inducción.',
    body:
      'Cualquier microajuste físico (rascarse, tragar, abrir un ojo, moverte de lado) reinicia la cadena. Si pica algo, ignóralo. Si tragas, observa cómo el cuerpo se recompone solo. Eres testigo, no operador.',
    why:
      'La parálisis del sueño es un estado del tronco encefálico que se activa cuando el cuerpo deja de recibir señales motoras voluntarias. Cualquier comando muscular la aborta.',
    tags: ['inmovilidad', 'paralisis', 'cuerpo'],
  },

  // ── Salida activa ──────────────────────────────────────────────────
  {
    id: 'rodar',
    phase: 'salida',
    title: 'Rodar fuera del cuerpo',
    whenToUse: 'Tras confirmar la atonía completa y la disociación.',
    body:
      'Imagina que ruedas hacia un lado de la cama (como un tronco). No muevas el cuerpo físico — mueve el cuerpo del alma. La sensación es la de despegarse de una superficie pegajosa. Persiste sin frustrarte.',
    why:
      'El movimiento rotacional pequeño desacopla el "campo perceptivo" del soma sin disparar comandos motores corticales. Es la técnica más reproducible de extrusión.',
    tags: ['rodar', 'roll-out', 'tecnica-salida'],
  },
  {
    id: 'sentarse',
    phase: 'salida',
    title: 'Sentarse del cuerpo',
    whenToUse: 'Si el rodar no funciona, alternativa estándar.',
    body:
      'Imagina sentarte como si te incorporaras de la cama, pero sin tensión muscular. La sensación: el torso del alma se eleva mientras el físico permanece acostado. No mires hacia abajo todavía.',
    why:
      'Activa la propiocepción del cuerpo del alma sin disparar el motor primario. Es la técnica clásica documentada por Monroe.',
    tags: ['sentarse', 'sit-up', 'tecnica-salida'],
  },
  {
    id: 'alejarse-rapido',
    phase: 'salida',
    title: 'Alejarse rápido del cuerpo físico',
    whenToUse: 'Inmediatamente después de la separación inicial.',
    body:
      'Camina, flota, lánzate hacia la puerta o cruza la pared. Aleja la consciencia del cuerpo físico tanto como puedas en los primeros 20 segundos. Cuanto más lejos, más estable.',
    why:
      'El campo magnético del cuerpo físico ejerce una fuerza de retorno proporcional a la inversa del cuadrado de la distancia. Cerca del cuerpo el snap-back es casi seguro.',
    tags: ['alejarse', 'distancia', 'magnetic-pull'],
  },

  // ── Estabilización ─────────────────────────────────────────────────
  {
    id: 'no-mirar-atras',
    phase: 'estabilizacion',
    title: 'No mirar atrás al cuerpo (regla de oro)',
    whenToUse: 'Durante las primeras salidas, sin excepción.',
    body:
      'Aunque sientas la curiosidad de verte durmiendo, NO lo hagas en las primeras experiencias. Si necesitas confirmar que estás fuera, mira tus manos del alma, no tu cuerpo.',
    why:
      'Verte a ti mismo durmiendo provoca una reacción emocional inevitable (asombro, shock, validación). Esa oleada de emoción acelera el cuerpo físico y te succiona de regreso al instante.',
    tags: ['no-mirar', 'snap-back', 'regla-oro'],
  },
  {
    id: 'comando-claridad',
    phase: 'estabilizacion',
    title: 'Comando de claridad',
    whenToUse: 'Si el entorno se ve borroso, oscuro o nublado al salir.',
    body:
      'Da la orden con voz firme y autoridad: "¡Claridad!" o "Dame plena conciencia" o "Comando mi espacio". No pidas, exige. Repite hasta que el espacio se ilumine.',
    why:
      'La conciencia recién separada no está plenamente enfocada. El comando verbal en voz alta sintoniza la percepción al máximo enfoque y disipa la niebla. Es el equivalente a abrir el obturador de una cámara.',
    command: '¡Claridad! / Dame plena conciencia / Comando mi espacio',
    tags: ['claridad', 'comando', 'voz', 'enfoque'],
  },
  {
    id: 'manos-del-alma',
    phase: 'estabilizacion',
    title: 'Anclaje en las manos del alma',
    whenToUse: 'Mientras das el comando de claridad, o si la visión flaquea.',
    body:
      'Levanta las manos espirituales frente a tu rostro. Mira fijamente sus formas (pueden verse transparentes o gelatinosas al inicio). No mires nada más hasta que estén nítidas. Combina con el comando de claridad.',
    why:
      'Concentrar la atención en un punto fijo y propio (las manos) ancla la conciencia al cuerpo del alma y fuerza al sistema perceptivo a estabilizarse en ese vehículo. Es el único punto de referencia que viaja contigo.',
    tags: ['manos', 'ancla', 'visual', 'soul-body'],
  },
  {
    id: 'voz-divina',
    phase: 'estabilizacion',
    title: 'Si la voz no sale al comandar',
    whenToUse: 'Cuando intentas hablar fuera y no sale sonido.',
    body:
      'No te frustres. Mantén la autoridad. Mira tus manos. Sigue intentando emitir la orden sin ceder. La voz "se romperá" de pronto y emergirá poderosa, profunda, casi con eco. Esa es tu voz real.',
    why:
      'La cuerda vocal del alma requiere reactivar un canal que rara vez se usa. Si retrocedes mentalmente, el canal se cierra. La persistencia con autoridad es lo que lo abre.',
    tags: ['voz', 'mudez', 'persistencia'],
  },

  // ── Exploración ────────────────────────────────────────────────────
  {
    id: 'destino-claro',
    phase: 'exploracion',
    title: 'Fija un destino antes de moverte',
    whenToUse: 'Una vez la visión es clara y estable.',
    body:
      'No deambules. Decide a dónde vas y por qué (visitar a un ser querido, explorar un lugar específico, pedir guía). Declara el destino mentalmente o en voz alta: "Llévame a..." o "Quiero ver...".',
    why:
      'El espacio fuera del cuerpo responde a la intención, no a la geometría. Sin destino, la conciencia divaga y la sesión se disipa rápido. Con destino claro, llegas casi instantáneamente.',
    command: 'Llévame a... / Quiero ver...',
    tags: ['destino', 'navegacion', 'intencion'],
  },
  {
    id: 'no-dudar',
    phase: 'exploracion',
    title: 'No dudes ni analices',
    whenToUse: 'Si te asalta el pensamiento "¿esto es real?" o "¿me levanté físicamente?".',
    body:
      'La sensación de realidad es muy intensa fuera del cuerpo — es normal pensar que te despertaste físicamente. NO analices la lógica de lo que ves. Si dudas, regresas al cuerpo físico al instante.',
    why:
      'La duda activa la corteza prefrontal en modo analítico, lo cual reactiva el cuerpo físico y aborta la experiencia. La aceptación pasiva mantiene el estado.',
    tags: ['no-dudar', 'aceptacion', 'mental-state'],
  },
  {
    id: 'telepatia',
    phase: 'exploracion',
    title: 'Comunicación telepática',
    whenToUse: 'Al encontrarte con guías, seres queridos fallecidos u otras presencias.',
    body:
      'No esperes diálogo verbal. La comunicación es un intercambio directo de "bloques de significado" — entiendes la intención, emoción y mensaje sin palabras. Tú también puedes proyectar pensamientos como respuesta.',
    why:
      'El lenguaje verbal humano es una limitación evolutiva del cuerpo físico. Fuera, la comunicación opera en el formato nativo de la conciencia: transferencia directa.',
    tags: ['telepatia', 'comunicacion', 'no-verbal'],
  },

  // ── Post-sesión ────────────────────────────────────────────────────
  {
    id: 'registro-inmediato',
    phase: 'post',
    title: 'Registro inmediato al regresar',
    whenToUse: 'Tan pronto como abras los ojos físicos.',
    body:
      'Antes de levantarte, mover el cuerpo o revisar el teléfono, escribe (o dicta a una grabadora junto a la cama) lo que recuerdes. Detalles, sensaciones, presencias. La memoria del estado fuera se evapora en minutos.',
    why:
      'La consolidación mnemotécnica del estado disociado es frágil. Pasados 5-10 minutos, el 80% del contenido se pierde. El registro inmediato es la única forma de preservarlo.',
    tags: ['registro', 'diario', 'memoria'],
  },
  {
    id: 'descanso-burnout',
    phase: 'post',
    title: 'Prevención de burnout',
    whenToUse: 'Después de una sesión intensa o varias seguidas.',
    body:
      'Si despiertas con cansancio profundo, dolor de cabeza o sensación de "sistema nervioso frito", descansa 3-7 días sin sesiones binaurales profundas. Hidrátate. Sal a caminar al sol. Come alimentos densos y calientes.',
    why:
      'Las sesiones binaurales profundas drenan el sistema nervioso autónomo. Forzar diariamente lleva a desregulación, ansiedad y sueño no reparador. El descanso no es opcional, es parte del protocolo.',
    tags: ['burnout', 'descanso', 'recovery'],
  },
  {
    id: 'grounding',
    phase: 'post',
    title: 'Anclaje a tierra (grounding)',
    whenToUse: 'Si persiste sensación de mareo, irrealidad o "flotar" tras la sesión.',
    body:
      'Camina descalzo sobre césped o tierra. Lava la cara con agua fría. Cuenta de 10 a 1 en voz alta. Come algo denso (pan, frutos secos). Toca objetos con las manos y nómbralos en voz alta.',
    why:
      'La conciencia regresa pero el cuerpo aún tiene la corteza ligeramente desacoplada. Estímulos somáticos fuertes y estructurados resincronizan la percepción al estado de vigilia.',
    tags: ['grounding', 'tierra', 'reentrada'],
  },
];

export const COMMAND_PHASES_ORDERED: CommandPhase[] = [
  'preparacion',
  'induccion',
  'salida',
  'estabilizacion',
  'exploracion',
  'post',
];
