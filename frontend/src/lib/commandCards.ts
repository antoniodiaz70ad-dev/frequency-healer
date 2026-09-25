import { CommandCard, CommandPhase } from './types';
import type { EvidenceCategoryV1 } from './protocolLibrary';

/**
 * Tarjetas de apoyo para prácticas subjetivas de exploración OBE.
 *
 * Compendio práctico de instrucciones que el practicante debe memorizar
 * antes de iniciar una sesión. Se revisan previamente para evitar consultar
 * la app durante la práctica.
 *
 * Las tarjetas se basan en testimonios y enseñanzas públicas de
 * practicantes contemporáneos del fenómeno (Robert Monroe, William
 * Buhlman, Darius J. Wright, etc.) sin reproducir audio ni texto
 * licenciado de ninguno de ellos.
 */

export const OBE_CONTENT_CLASSIFICATION: EvidenceCategoryV1 = 'EXPLORATORY';

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
    description: 'Durante sensaciones de inmovilidad: calma y observación.',
  },
  salida: {
    label: 'Salida Activa',
    order: 3,
    color: '#fbbf24',
    icon: '↗',
    description: 'Ensayo imaginativo: rodar, sentarse y cambiar el foco.',
  },
  estabilizacion: {
    label: 'Estabilización',
    order: 4,
    color: '#4ade80',
    icon: '✦',
    description: 'Durante la experiencia percibida: atención y claridad.',
  },
  exploracion: {
    label: 'Exploración',
    order: 5,
    color: '#60a5fa',
    icon: '◎',
    description: 'Exploración subjetiva: imágenes, intención y significado.',
  },
  post: {
    label: 'Post-sesión',
    order: 6,
    color: '#f87171',
    icon: '∽',
    description: 'Al terminar: registro subjetivo, descanso y autocuidado.',
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
      'Si eliges la práctica WBTB, duerme primero unas 4-6 horas, despierta entre las 2:00 y 3:00 a.m. y entonces inicia la pista binaural. Interrumpe si te sientes demasiado cansado.',
    why:
      'Algunas tradiciones OBE usan este horario para intentar conservar la atención al volver a dormir. La respuesta es individual y no se presenta como una ventana fisiológica verificada.',
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
      'Esta visualización puede servir como ritual personal para apartar preocupaciones y dirigir la atención a la práctica.',
    tags: ['mental-prep', 'caja', 'energy-conversion-box'],
  },
  {
    id: 'respiracion-478',
    phase: 'preparacion',
    title: 'Respiración 4-7-8',
    whenToUse: 'Mientras suena el primer tramo de la pista, antes de la fase de inmovilidad percibida.',
    body:
      'Inhala por la nariz contando 4. Retén el aire contando 7. Exhala por la boca, lentamente, contando 8. Repite 4-6 ciclos. Después deja que la respiración se vuelva natural y pasiva.',
    why:
      'El conteo ofrece un foco sencillo y un ritmo deliberado. No se afirma un efecto fisiológico específico; respira con comodidad y detente si aparece malestar.',
    tags: ['respiracion', 'vagal', 'calm'],
  },
  {
    id: 'declaracion-intencion',
    phase: 'preparacion',
    title: 'Declaración de intención',
    whenToUse: 'Después de la respiración, antes de soltar el cuerpo.',
    body:
      'Repite mental o verbalmente, con serenidad: "Tengo la intención de estar fuera de mi cuerpo con completa conciencia". Puedes tratarla como lenguaje simbólico y personalizar el propósito de tu exploración. Repite sin tensión.',
    why:
      'Declarar una intención ayuda a mantener presente el propósito elegido. No demuestra un mecanismo neurológico ni garantiza un resultado.',
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
      'Reducir distracciones físicas puede facilitar la comodidad y la atención durante la sesión.',
    tags: ['checklist', 'fisico', 'auriculares'],
  },

  // ── Inducción ──────────────────────────────────────────────────────
  {
    id: 'estoicismo-emocional',
    phase: 'induccion',
    title: 'Estoicismo emocional absoluto',
    whenToUse: 'Cuando comiences a sentir vibraciones, hormigueo, ruidos cíclicos, peso o "estallidos".',
    body:
      'Observa con calma cualquier sensación percibida, como zumbidos, hormigueo o peso, sin asumir que indica un resultado concreto. Si aparece miedo o malestar, detén la práctica.',
    why:
      'La calma puede ayudar a sostener la atención. Un cambio brusco de emoción también puede coincidir con el fin de la experiencia subjetiva, sin implicar una fuerza física o magnética.',
    tags: ['calma', 'snap-back', 'no-fear'],
  },
  {
    id: 'no-pasividad',
    phase: 'induccion',
    title: 'No te quedes pasivo esperando',
    whenToUse: 'Cuando la parálisis está completa y sientes la "desconexión".',
    body:
      'Cuando percibas inmovilidad o un cambio de estado, pasa al siguiente ejercicio imaginativo (Salida Activa) si te resulta cómodo.',
    why:
      'Esta tarjeta propone actuar en el momento elegido para mantener el hilo de la práctica. No afirma una ventana neurológica específica.',
    tags: ['pasividad', 'agency', 'voluntad'],
  },
  {
    id: 'no-tragar',
    phase: 'induccion',
    title: 'No tragar saliva, no moverse',
    whenToUse: 'Durante toda la fase de inducción.',
    body:
      'Mantén una postura cómoda y evita ajustes innecesarios si puedes hacerlo sin esfuerzo. Traga, muévete o termina la práctica cuando lo necesites; después vuelve a observar con calma.',
    why:
      'La quietud voluntaria funciona aquí como recurso de atención. Moverse puede cambiar la experiencia percibida, pero no se presenta como una regla fisiológica universal.',
    tags: ['inmovilidad', 'paralisis', 'cuerpo'],
  },

  // ── Salida activa ──────────────────────────────────────────────────
  {
    id: 'rodar',
    phase: 'salida',
    title: 'Rodar fuera del cuerpo',
    whenToUse: 'Tras percibir inmovilidad y un cambio de estado.',
    body:
      'Imagina que ruedas hacia un lado de la cama, como un tronco, sin ejecutar el movimiento físico. Observa las sensaciones e imágenes que surjan sin interpretarlas como separación corporal literal.',
    why:
      'Es un ejercicio imaginativo descrito en tradiciones OBE para cambiar el foco de atención. Su resultado es subjetivo y no demuestra desacoplamiento corporal.',
    tags: ['rodar', 'roll-out', 'tecnica-salida'],
  },
  {
    id: 'sentarse',
    phase: 'salida',
    title: 'Sentarse del cuerpo',
    whenToUse: 'Si el rodar no funciona, alternativa estándar.',
    body:
      'Imagina que te incorporas de la cama sin ejecutar el movimiento físico. Trata cualquier sensación de elevación como parte de la experiencia subjetiva.',
    why:
      'Es una técnica imaginativa asociada históricamente con prácticas de Robert Monroe; aquí no se afirma un mecanismo propioceptivo ni un cuerpo separado.',
    tags: ['sentarse', 'sit-up', 'tecnica-salida'],
  },
  {
    id: 'alejarse-rapido',
    phase: 'salida',
    title: 'Alejarse rápido del cuerpo físico',
    whenToUse: 'Inmediatamente después de la separación inicial.',
    body:
      'Durante los primeros 20 segundos de la experiencia percibida, imagina caminar, flotar o dirigirte hacia otro punto. Observa si cambiar el foco modifica tu experiencia.',
    why:
      'Algunos relatos tradicionales recomiendan cambiar pronto el foco de atención. No existe aquí una afirmación de fuerza magnética ni una ley de distancia corporal.',
    tags: ['alejarse', 'distancia', 'magnetic-pull'],
  },

  // ── Estabilización ─────────────────────────────────────────────────
  {
    id: 'no-mirar-atras',
    phase: 'estabilizacion',
    title: 'No mirar atrás al cuerpo (regla de oro)',
    whenToUse: 'Durante las primeras salidas, sin excepción.',
    body:
      'Si aparece una imagen de tu cuerpo o cama, puedes elegir no fijarte en ella y llevar la atención a la imagen de tus manos. Esto no confirma una salida corporal.',
    why:
      'Cambiar el foco puede ayudar a reducir sobresalto o distracción. El llamado “snap-back” se presenta como descripción subjetiva de un retorno de atención.',
    tags: ['no-mirar', 'snap-back', 'regla-oro'],
  },
  {
    id: 'comando-claridad',
    phase: 'estabilizacion',
    title: 'Comando de claridad',
    whenToUse: 'Si la escena imaginada o percibida se ve borrosa, oscura o nublada.',
    body:
      'Repite el comando elegido: "¡Claridad!", "Dame plena conciencia" o "Comando mi espacio". Observa si cambia la escena percibida, sin dar por hecho que ocurrirá.',
    why:
      'El comando funciona como una señal de atención dentro de la práctica. Cualquier cambio de claridad es una observación subjetiva.',
    command: '¡Claridad! / Dame plena conciencia / Comando mi espacio',
    tags: ['claridad', 'comando', 'voz', 'enfoque'],
  },
  {
    id: 'manos-del-alma',
    phase: 'estabilizacion',
    title: 'Anclaje en la imagen de las manos',
    whenToUse: 'Mientras das el comando de claridad, o si la visión flaquea.',
    body:
      'Imagina tus manos frente al rostro y concentra la atención en sus formas percibidas. Combina este ejercicio con el comando de claridad si lo deseas.',
    why:
      'La imagen de las manos ofrece un punto de referencia para sostener la atención. No implica la existencia de un cuerpo separado.',
    tags: ['manos', 'ancla', 'visual', 'soul-body'],
  },
  {
    id: 'voz-divina',
    phase: 'estabilizacion',
    title: 'Si la voz no sale al comandar',
    whenToUse: 'Cuando intentas hablar dentro de la experiencia y no percibes sonido.',
    body:
      'No te frustres. Mira la imagen de tus manos e intenta repetir la orden. Registra cualquier voz, eco o silencio como parte de tu experiencia subjetiva.',
    why:
      'La repetición puede ayudar a mantener el foco. No se afirma la existencia de una cuerda vocal o canal separado.',
    tags: ['voz', 'mudez', 'persistencia'],
  },

  // ── Exploración ────────────────────────────────────────────────────
  {
    id: 'destino-claro',
    phase: 'exploracion',
    title: 'Fija un destino antes de moverte',
    whenToUse: 'Una vez la visión es clara y estable.',
    body:
      'Elige un tema o destino imaginado, como una persona, lugar o pregunta. Decláralo mentalmente o en voz alta: "Llévame a..." o "Quiero ver...".',
    why:
      'Elegir un destino proporciona estructura narrativa y atencional. Las escenas que aparezcan no se presentan como desplazamiento físico ni como acceso verificado a otro lugar.',
    command: 'Llévame a... / Quiero ver...',
    tags: ['destino', 'navegacion', 'intencion'],
  },
  {
    id: 'no-dudar',
    phase: 'exploracion',
    title: 'No dudes ni analices',
    whenToUse: 'Si te asalta el pensamiento "¿esto es real?" o "¿me levanté físicamente?".',
    body:
      'Si la experiencia se siente vívida, observa primero y deja el análisis para el registro posterior. Puedes detenerla en cualquier momento si te incomoda.',
    why:
      'Posponer el análisis puede ayudar a mantener una experiencia imaginativa continua. No se atribuye este efecto a un mecanismo cortical específico.',
    tags: ['no-dudar', 'aceptacion', 'mental-state'],
  },
  {
    id: 'telepatia',
    phase: 'exploracion',
    title: 'Comunicación telepática',
    whenToUse: 'Si percibes personajes, seres queridos u otras presencias durante la experiencia.',
    body:
      'Observa si surgen palabras, emociones o “bloques de significado” sin diálogo verbal. Puedes responder mentalmente y registrar después tu interpretación.',
    why:
      'Esta tarjeta recoge una interpretación frecuente en relatos OBE. No verifica telepatía, contacto externo ni transferencia directa de información.',
    tags: ['telepatia', 'comunicacion', 'no-verbal'],
  },

  // ── Post-sesión ────────────────────────────────────────────────────
  {
    id: 'registro-inmediato',
    phase: 'post',
    title: 'Registro inmediato al regresar',
    whenToUse: 'Tan pronto como abras los ojos físicos.',
    body:
      'Antes de revisar el teléfono, escribe lo que recuerdes: imágenes, sensaciones e interpretaciones. Si prefieres dictar, evita grabar información sensible.',
    why:
      'Registrar pronto puede conservar más detalles del recuerdo. No se afirma un porcentaje de pérdida ni un mecanismo de memoria específico.',
    tags: ['registro', 'diario', 'memoria'],
  },
  {
    id: 'descanso-burnout',
    phase: 'post',
    title: 'Prevención de burnout',
    whenToUse: 'Después de una sesión intensa o varias seguidas.',
    body:
      'Si terminas con cansancio profundo, dolor de cabeza o malestar, descansa 3-7 días sin estas sesiones y prioriza tus hábitos habituales de descanso. Si el malestar persiste, busca orientación profesional.',
    why:
      'La pausa es una medida conservadora de autocuidado basada en cómo te sientes. No se afirma que la sesión drene o desregule el sistema nervioso.',
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
      'Estas acciones ofrecen referencias sensoriales familiares para orientar la atención al entorno. No se afirma desacoplamiento cortical ni resincronización fisiológica.',
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
