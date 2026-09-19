import type { Metadata } from "next";
import Link from "next/link";
import HeroVideo from "@/components/landing/HeroVideo";
import styles from "@/components/landing/landing.module.css";
import { HARMONIC_ENABLED } from "@/lib/voice/feature";

export const metadata: Metadata = {
  title: "Frequency Healer — Explore sound as a personal experiment",
  description:
    "A personal harmonic exploration platform. Explore acoustic relationships, structure intentional sessions and record your subjective response.",
};

const principles = [
  [
    "Relationships, not isolated tones",
    "Start with a seed frequency and explore harmonic ratios as reproducible structures. Octaves extend the same mathematical idea.",
  ],
  [
    "Intention before session",
    "Define what you want to explore before pressing play, so each session has context.",
  ],
  [
    "Measure your response",
    "Record your expectation before listening. Track clarity, tension, focus, energy and mood before and after.",
  ],
  [
    "Learn from your own pattern",
    "Keep a record of repeated sessions. Compare your observations over time, without assuming that association proves cause.",
  ],
];
const steps = [
  ["Set your intention", "Choose what you want to explore."],
  ["Choose your session", "Start with a seed and an existing harmonic ratio."],
  [
    "Listen and observe",
    "Use the session flow and playback tools at your own pace.",
  ],
  [
    "Record your response",
    "Capture how you felt before and after. Save when you choose.",
  ],
  [
    "Look for repetition",
    "Compare your records over time. Automated harmonic patterns are a future step.",
  ],
];
const modules = [
  [
    "Intention Engine",
    "Available in sessions",
    "Define the purpose of a session before the sound begins.",
  ],
  [
    "Belief Mirror",
    "Planned exploration",
    "Surface a possible interpretation and consider an alternative. A reflective tool, not a diagnosis.",
  ],
  [
    "Probability Lab",
    "Planned exploration",
    "Compare how possible decisions and scenarios feel. Personal reflection, not probability prediction.",
  ],
  [
    "Experience Journal",
    "Available in sessions",
    "Record insights, reflections and subjective observations as part of your personal learning process.",
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
    <div className={styles.landing} lang="en">
      <a className={styles.skip} href="#method">
        Skip to the method
      </a>
      <section className={styles.hero} aria-labelledby="hero-title">
        <HeroVideo />
        <header className={styles.header}>
          <a
            href="#"
            className={styles.brand}
            aria-label="Frequency Healer, top of page"
          >
            <span className={styles.brandMark} aria-hidden="true">
              ∿
            </span>{" "}
            FREQUENCY HEALER
          </a>
          <nav aria-label="Landing navigation">
            <a href="#method">The method</a>
            <Link href="/" prefetch={false}>
              Enter the app <Arrow />
            </Link>
          </nav>
        </header>
        <div className={styles.heroCopy}>
          <Label>
            <span className={styles.signal} /> A personal harmonic exploration
            platform
          </Label>
          <h1 id="hero-title">
            Explore sound
            <br />
            as a <em>personal</em>
            <br />
            experiment<span className={styles.coral}>.</span>
          </h1>
          <p className={styles.heroDescription}>
            Go beyond isolated frequencies. Explore harmonic relationships,
            track your response, and discover what is consistently associated
            with useful states for you.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#method">
              Explore the Method <span aria-hidden="true">↓</span>
            </a>
            <Link className={styles.secondary} href="/" prefetch={false}>
              Enter Frequency Healer <Arrow />
            </Link>
          </div>
          {HARMONIC_ENABLED && (
            <Link
              className={styles.labLink}
              href="/laboratorio-armonico"
              prefetch={false}
            >
              See Harmonic Lab <Arrow />
            </Link>
          )}
        </div>
        <div className={styles.heroFooter}>
          <span>Sound, with a method.</span>
          <span>01 / BEGIN WITH CURIOSITY</span>
        </div>
      </section>

      <section
        className={`${styles.section} ${styles.method}`}
        id="method"
        aria-labelledby="method-title"
      >
        <div className={styles.sectionIntro}>
          <Label>01 — THE METHOD</Label>
          <h2 id="method-title">
            A frequency is not
            <br />
            the whole experiment.
          </h2>
          <p>
            Frequency Healer combines harmonic relationships, intentional
            sessions and personal measurement so you can explore what actually
            repeats in your own experience.
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
            <Label>02 — THE MATHEMATICS OF RELATIONSHIP</Label>
            <h2 id="relationships-title">
              From tone
              <br />
              to constellation
            </h2>
          </div>
          <p>
            A single frequency can become a harmonic family through exact
            mathematical relationships. Explore relationships, not just isolated
            numbers.
          </p>
        </div>
        <div
          className={styles.ratioStrip}
          aria-label="All ratios are relative to the 432 hertz seed"
        >
          {[
            ["432", "1:1", "SEED"],
            ["540", "5:4", "MAJOR THIRD"],
            ["648", "3:2", "PERFECT FIFTH"],
            ["864", "2:1", "OCTAVE"],
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
            One seed. Exact ratios. Every relationship above is relative to 432
            Hz.
            <br />
            These structures form the foundation for reproducible
            constellations.
          </p>
          <a
            className={styles.textLink}
            href={HARMONIC_ENABLED ? "/laboratorio-armonico" : "#process"}
          >
            See the relationships <Arrow />
          </a>
        </div>
        <p className={styles.note}>
          Mathematical illustration. A dedicated constellation editor and
          playback flow are planned.
        </p>
        <ol
          className={styles.progression}
          aria-label="The platform's progression"
        >
          {[
            "Frequency",
            "Relationship",
            "Octave",
            "Constellation",
            "Experience",
            "Personal pattern",
          ].map((word) => (
            <li key={word}>{word}</li>
          ))}
        </ol>
      </section>

      <section
        className={styles.section}
        id="process"
        aria-labelledby="process-title"
      >
        <Label>03 — A REPEATABLE PRACTICE</Label>
        <h2 id="process-title">
          Turn listening into
          <br />a repeatable observation
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
        aria-labelledby="consciousness-title"
      >
        <div className={styles.sectionIntro}>
          <Label>04 — CONSCIOUSNESS LAB</Label>
          <h2 id="consciousness-title">
            Explore the inner context
            <br />
            around the sound
          </h2>
          <p>
            Optional reflective tools help structure intention, beliefs and
            possibilities while keeping personal interpretation separate from
            scientific claims.
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
        className={`${styles.section} ${styles.mapSection}`}
        aria-labelledby="map-title"
      >
        <div className={styles.sectionIntro}>
          <Label>05 — PERSONAL HARMONIC MAP / FUTURE DIRECTION</Label>
          <h2 id="map-title">
            Your history
            <br />
            becomes a map
          </h2>
          <p>
            With enough comparable sessions, the aim is to reveal which seeds,
            ratios, octaves and constellations are most consistently associated
            with the states you record.
          </p>
          <p>
            This map is an illustration of that direction. Automated mapping of
            Harmonic Lab experiments is not available yet.
          </p>
          <ul className={styles.chips}>
            <li>Observation</li>
            <li>Association</li>
            <li>Not automatic causation</li>
          </ul>
        </div>
        <figure className={styles.map}>
          <svg
            viewBox="0 0 540 500"
            role="img"
            aria-labelledby="map-illustration-title"
          >
            <title id="map-illustration-title">
              Illustrative connections between a seed frequency, harmonic ratios
              and subjective observations. Not personal data.
            </title>
            <defs>
              <radialGradient id="map-glow">
                <stop stopColor="#A9C7D9" stopOpacity=".12" />
                <stop offset="1" stopColor="#A9C7D9" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="270" cy="250" r="230" fill="url(#map-glow)" />
            <g fill="none" stroke="#59627A" strokeWidth=".7">
              <circle cx="270" cy="250" r="72" />
              <circle cx="270" cy="250" r="145" />
              <circle cx="270" cy="250" r="210" strokeDasharray="2 7" />
              <path d="M270 40V460M60 250H480" strokeOpacity=".4" />
              <path d="M270 250L160 155L348 128L413 280L225 388L102 315L160 155M270 250L348 128M270 250L413 280M270 250L225 388M270 250L102 315M160 155L413 280L102 315L348 128L225 388Z" />
            </g>
            <g fill="#A9C7D9">
              {[
                [160, 155],
                [348, 128],
                [413, 280],
                [225, 388],
                [102, 315],
              ].map(([cx, cy]) => (
                <circle key={cx} cx={cx} cy={cy} r="5" />
              ))}
            </g>
            <circle cx="270" cy="250" r="8" fill="#F05C5C" />
            <circle
              cx="270"
              cy="250"
              r="20"
              fill="none"
              stroke="#F05C5C"
              strokeOpacity=".5"
            />
            <g fill="#F4F2EC" fontFamily="monospace" fontSize="12">
              <text x="290" y="244">
                SEED
              </text>
              <text x="113" y="137">
                CLARITY
              </text>
              <text x="361" y="121">
                3:2
              </text>
              <text x="426" y="285">
                FOCUS
              </text>
              <text x="235" y="416">
                2:1
              </text>
              <text x="57" y="342">
                CONTEXT
              </text>
            </g>
          </svg>
          <figcaption>ILLUSTRATIVE MAP · NO PERSONAL DATA</figcaption>
        </figure>
      </section>

      <section
        className={`${styles.section} ${styles.closing}`}
        aria-labelledby="closing-title"
      >
        <Label>EXPLORE. MEASURE. LEARN.</Label>
        <h2 id="closing-title">
          Build a relationship with sound
          <br />
          that is personal, reproducible
          <br />
          and <em>honest.</em>
        </h2>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/" prefetch={false}>
            Enter Frequency Healer <Arrow />
          </Link>
          <a className={styles.secondary} href="#method">
            Explore the Method <span aria-hidden="true">↑</span>
          </a>
        </div>
        <p className={styles.disclaimer}>
          For relaxation, reflection and personal exploration.
          <br />
          Not a substitute for professional medical care.
        </p>
      </section>
      <footer className={styles.footer}>
        <span>∿ &nbsp; FREQUENCY HEALER</span>
        <p>
          Mathematics. Experience. Observation. Interpretation.
          <br />
          Connected by curiosity. Kept distinct by design.
        </p>
        <a href="#">Back to top ↑</a>
      </footer>
    </div>
  );
}
