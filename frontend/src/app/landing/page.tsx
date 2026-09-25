import type { Metadata } from "next";
import Link from "next/link";
import HeroVideo from "@/components/landing/HeroVideo";
import styles from "@/components/landing/landing.module.css";
import { HARMONIC_ENABLED, VOICE_ENABLED } from "@/lib/voice/feature";

export const metadata: Metadata = {
  title: "Frequency Healer — Plataforma personal de exploración armónica",
  description:
    "Explora frecuencias, relaciones, octavas y constelaciones como práctica personal observable, sin promesas médicas.",
};

const principles = [
  [
    "Frecuencia",
    "Un punto de partida acústico claro, elegido por reglas locales y mostrado antes de escuchar.",
  ],
  [
    "Relación",
    "La experiencia se construye con proporciones: quinta, cuarta, terceras, octavas y estructuras reproducibles.",
  ],
  [
    "Experiencia",
    "Registras intención, expectativa y estado subjetivo sin convertirlo en diagnóstico o promesa.",
  ],
  [
    "Patrón personal",
    "Con suficiente repetición, comparas tus propios registros para observar asociaciones descriptivas.",
  ],
];

const steps = [
  ["Describe tu intención", "Escribe lo que quieres explorar. La voz es opcional; el texto funciona normalmente."],
  ["Revisa la propuesta", "Frequency Healer muestra una sesión explicable antes de reproducir sonido."],
  ["Confirma y escucha", "La reproducción empieza solo cuando tú confirmas. Puedes detenerla en cualquier momento."],
  ["Registra tu estado", "Guarda claridad, tensión, enfoque, energía, ánimo y reflexión cuando decidas."],
  ["Compara con calma", "La evidencia personal describe repetición; no afirma causalidad automática."],
];

const productModes = [
  [
    "Sesión guiada",
    "Para empezar simple",
    "Describe lo que quieres explorar y recibe una propuesta revisable sin elegir Hz, ratios u octavas.",
    VOICE_ENABLED ? "/voz" : "/",
    VOICE_ENABLED ? "Comenzar sesión guiada" : "Entrar a la app",
  ],
  [
    "Laboratorio Armónico",
    "Para exploración avanzada",
    "Construye relaciones, octavas, constelaciones y experimentos con trazabilidad matemática.",
    HARMONIC_ENABLED ? "/laboratorio-armonico" : "/",
    HARMONIC_ENABLED ? "Abrir laboratorio" : "Entrar a la app",
  ],
];

const trustSignals = [
  ["Reglas locales", "Las propuestas se generan con lógica determinista y versión visible."],
  ["Sin promesas médicas", "La plataforma separa acústica, experiencia subjetiva, observación e interpretación."],
  ["Datos auditables", "Los registros guardan configuración, versión, estado y exportación verificable."],
  ["Tú confirmas", "Aplicar, cargar o previsualizar nunca equivale a reproducir automáticamente."],
];

const modules = [
  [
    "Atlas de frecuencias",
    "Referencia curada",
    "Explora frecuencias con clasificación de evidencia y lenguaje histórico neutralizado.",
  ],
  [
    "Protocolos históricos",
    "Contexto sin absolutismos",
    "Consulta protocolos como material de exploración, no como instrucciones terapéuticas.",
  ],
  [
    "Constelaciones",
    "Relaciones firmadas",
    "Guarda estructuras exactas con firma, semilla, miembros y modo de reproducción.",
  ],
  [
    "Exportación V1",
    "Control del usuario",
    "Descarga tus datos de Frequency Healer desde una lista explícita de espacios propios.",
  ],
];

function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className={styles.label}>{children}</p>;
}

export default function LandingPage() {
  return (
    <div className={styles.landing} lang="es">
      <a className={styles.skip} href="#method">
        Saltar al método
      </a>
      <section className={styles.hero} aria-labelledby="hero-title">
        <HeroVideo />
        <header className={styles.header}>
          <a
            href="#"
            className={styles.brand}
            aria-label="Frequency Healer, inicio de la página"
          >
            <span className={styles.brandMark} aria-hidden="true">
              ∿
            </span>{" "}
            FREQUENCY HEALER
          </a>
          <nav aria-label="Navegación de landing">
            <a href="#method">El método</a>
            <Link href="/" prefetch={false}>
              Entrar a la app <Arrow />
            </Link>
          </nav>
        </header>
        <div className={styles.heroCopy}>
          <Label>
            <span className={styles.signal} /> Plataforma personal de exploración
            armónica
          </Label>
          <h1 id="hero-title">
            No busques la
            <br />
            frecuencia perfecta<span className={styles.coral}>.</span>
            <br />
            Descubre tu <em>patrón</em>.
          </h1>
          <p className={styles.heroDescription}>
            Frequency Healer convierte el sonido en una práctica observable:
            intención, relación acústica, escucha confirmada y evidencia personal
            N=1 sin prometer efectos médicos.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primary} href={VOICE_ENABLED ? "/voz" : "/"} prefetch={false}>
              {VOICE_ENABLED ? "Comenzar sesión guiada" : "Entrar a Frequency Healer"} <Arrow />
            </Link>
            <a className={styles.secondary} href="#method">
              Ver método <span aria-hidden="true">↓</span>
            </a>
          </div>
          <ul className={styles.heroProof} aria-label="Principios de confianza">
            <li>Sin diagnóstico</li>
            <li>Reglas locales</li>
            <li>Datos exportables</li>
          </ul>
          {HARMONIC_ENABLED && (
            <Link
              className={styles.labLink}
              href="/laboratorio-armonico"
              prefetch={false}
            >
              Explorar Laboratorio Armónico <Arrow />
            </Link>
          )}
        </div>
        <div className={styles.heroFooter}>
          <span>Sonido con método.</span>
          <span>FRECUENCIA → RELACIÓN → EXPERIENCIA</span>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.method}`}
        id="method"
        aria-labelledby="method-title"
      >
        <div className={styles.sectionIntro}>
          <Label>01 — EL MÉTODO</Label>
          <h2 id="method-title">
            Una frecuencia sola
            <br />
            no es todo el experimento.
          </h2>
          <p>
            La plataforma mantiene separados cuatro dominios: matemáticas
            acústicas, experiencia subjetiva, observación experimental e
            interpretación personal. Esa separación hace que la exploración sea
            más clara, honesta y repetible.
          </p>
        </div>
        <div className={styles.principles}>
          {principles.map(([title, text], i) => (
            <article key={title}>
              <span className={styles.index}>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.relationships}`}
        id="relationships"
        aria-labelledby="relationships-title"
      >
        <div className={styles.splitIntro}>
          <div>
            <Label>02 — PROGRESIÓN ARMÓNICA</Label>
            <h2 id="relationships-title">
              De un tono
              <br />
              a una constelación
            </h2>
          </div>
          <p>
            Lo único de Frequency Healer es la progresión: no se queda en listas
            de frecuencias. Te lleva de una semilla a relaciones, octavas,
            constelaciones, experiencia registrada y patrón personal.
          </p>
        </div>
        <div
          className={styles.ratioStrip}
          aria-label="Relaciones relativas a una semilla de 432 hercios"
        >
          {[
            ["432", "1:1", "SEMILLA"],
            ["540", "5:4", "TERCERA MAYOR"],
            ["648", "3:2", "QUINTA JUSTA"],
            ["864", "2:1", "OCTAVA"],
          ].map(([hz, ratio, name], i) => (
            <div className={styles.ratioNode} key={hz}>
              <div
                className={styles.rings}
                style={{ "--ring-count": i + 1 } as React.CSSProperties}
              >
                <span />
                <span />
                <span />
                <i />
              </div>
              <p className={styles.frequency}>
                {hz}
                <small> Hz</small>
              </p>
              <span className={styles.ratio}>{ratio}</span>
              <p className={styles.label}>{name}</p>
            </div>
          ))}
        </div>
        <div className={styles.relationshipFooter}>
          <p>
            Una semilla. Relaciones exactas. Una estructura que puedes volver a
            escuchar y comparar sin convertirla en afirmación terapéutica.
          </p>
          <a
            className={styles.textLink}
            href={HARMONIC_ENABLED ? "/laboratorio-armonico" : "#process"}
          >
            Ver relaciones <Arrow />
          </a>
        </div>
        <ol
          className={styles.progression}
          aria-label="Progresión de la plataforma"
        >
          {[
            "Frecuencia",
            "Relación",
            "Octava",
            "Constelación",
            "Experiencia",
            "Patrón personal",
          ].map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ol>
      </section>

      <section className={`${styles.section} ${styles.modes}`} aria-labelledby="modes-title">
        <div className={styles.sectionIntro}>
          <Label>03 — DOS ENTRADAS CLARAS</Label>
          <h2 id="modes-title">
            Simple cuando quieres empezar.
            <br />
            Profundo cuando quieres explorar.
          </h2>
        </div>
        <div className={styles.modeGrid}>
          {productModes.map(([title, eyebrow, text, href, cta]) => (
            <article className={styles.modeCard} key={title}>
              <p className={styles.modeEyebrow}>{eyebrow}</p>
              <h3>{title}</h3>
              <p>{text}</p>
              <Link href={href} prefetch={false}>
                {cta} <Arrow />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section
        className={styles.section}
        id="process"
        aria-labelledby="process-title"
      >
        <Label>04 — PRÁCTICA REPETIBLE</Label>
        <h2 id="process-title">
          Escuchar se vuelve
          <br />
          una observación estructurada
        </h2>
        <ol className={styles.process}>
          {steps.map(([title, text], i) => (
            <li key={title}>
              <span className={styles.stepNumber}>0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        className={`${styles.section} ${styles.consciousness}`}
        aria-labelledby="trust-title"
      >
        <div className={styles.sectionIntro}>
          <Label>05 — CONFIANZA Y TRAZABILIDAD</Label>
          <h2 id="trust-title">
            Una experiencia elegante
            <br />
            con límites explícitos
          </h2>
          <p>
            La app puede sentirse contemplativa sin presentar mecanismos
            médicos, energéticos o místicos como hechos. La propuesta siempre se
            muestra antes de sonar.
          </p>
        </div>
        <div className={styles.trustGrid}>
          {trustSignals.map(([title, text]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.mapSection}`}
        aria-labelledby="map-title"
      >
        <div className={styles.sectionIntro}>
          <Label>06 — ECOSISTEMA V1</Label>
          <h2 id="map-title">
            Todo apunta a una
            <br />
            bitácora personal
          </h2>
          <p>
            Sesión guiada, atlas, laboratorio, constelaciones y exportación
            existen para una misma idea: explorar de forma personal y auditable
            qué relaciones acústicas se asocian con estados útiles para ti.
          </p>
          <ul className={styles.chips}>
            <li>Evidencia personal</li>
            <li>Sin causalidad automática</li>
            <li>Exportación local</li>
          </ul>
        </div>
        <div className={styles.experienceCard} aria-label="Flujo de experiencia">
          <p className={styles.cardKicker}>FLUJO DE UNA SESIÓN</p>
          <ol>
            <li><span>01</span> Intención original del usuario</li>
            <li><span>02</span> Interpretación revisable</li>
            <li><span>03</span> Configuración acústica visible</li>
            <li><span>04</span> Confirmación antes de reproducir</li>
            <li><span>05</span> Registro y exportación</li>
          </ol>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.consciousness}`}
        aria-labelledby="modules-title"
      >
        <div className={styles.sectionIntro}>
          <Label>07 — SUPERFICIES DE LA PLATAFORMA</Label>
          <h2 id="modules-title">
            Una app lista para beta cerrada,
            <br />
            diseñada para crecer con cuidado
          </h2>
          <p>
            Cada módulo tiene un propósito separado para evitar confusión entre
            descubrimiento, escucha, registro y lectura histórica.
          </p>
        </div>
        <div className={styles.modules}>
          {modules.map(([title, status, text], i) => (
            <article key={title}>
              <span className={styles.index}>0{i + 1}</span>
              <div>
                <p className={styles.moduleStatus}>{status}</p>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <span className={styles.moduleMark} aria-hidden="true">
                {["⊙", "◐", "⋮", "≋"][i]}
              </span>
            </article>
          ))}
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.closing}`}
        aria-labelledby="closing-title"
      >
        <Label>EXPLORA. REGISTRA. APRENDE.</Label>
        <h2 id="closing-title">
          La promesa no es curarte.
          <br />
          La promesa es darte
          <br />
          un método <em>honesto</em>.
        </h2>
        <div className={styles.actions}>
          <Link className={styles.primary} href={VOICE_ENABLED ? "/voz" : "/"} prefetch={false}>
            {VOICE_ENABLED ? "Comenzar sesión guiada" : "Entrar a Frequency Healer"} <Arrow />
          </Link>
          <a className={styles.secondary} href="#method">
            Revisar método <span aria-hidden="true">↑</span>
          </a>
        </div>
        <p className={styles.disclaimer}>
          Para relajación, reflexión y exploración personal.
          <br />
          No sustituye atención médica profesional.
        </p>
      </section>
      <footer className={styles.footer}>
        <span>∿ &nbsp; FREQUENCY HEALER</span>
        <p>
          Matemáticas. Experiencia. Observación. Interpretación.
          <br />
          Conectadas por curiosidad; separadas por diseño.
        </p>
        <a href="#">Volver arriba ↑</a>
      </footer>
    </div>
  );
}
