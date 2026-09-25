import type { ReactNode } from "react";

const slug = (value: string) => value.toLowerCase().replaceAll("_", "-");

export function FHEvidenceBadge({ category, children }: { category: string; children?: ReactNode }) {
  return <span className={`fh-badge fh-badge--evidence-${slug(category)}`}>{children ?? category}</span>;
}

export function FHStateBadge({ state, children }: { state: string; children?: ReactNode }) {
  return <span className="fh-badge fh-badge--state">{children ?? state}</span>;
}
