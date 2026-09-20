import type { ReactNode } from "react";

export default function FHMetric({ label, value, context }: { label: ReactNode; value: ReactNode; context?: ReactNode }) {
  return <div className="fh-metric"><span className="fh-metric__label">{label}</span><strong className="fh-metric__value">{value}</strong>{context && <span className="fh-metric__context">{context}</span>}</div>;
}
