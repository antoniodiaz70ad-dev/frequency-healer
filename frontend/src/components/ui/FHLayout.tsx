import type { ReactNode } from "react";

export function FHPageShell({ children, width = "default", className = "" }: { children: ReactNode; width?: "narrow" | "default" | "wide"; className?: string }) {
  return <div className={`fh-page-shell fh-page-shell--${width} ${className}`.trim()}>{children}</div>;
}

export function FHPageHeader({ eyebrow, title, description }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode }) {
  return <header className="fh-page-header">{eyebrow && <p className="fh-page-header__eyebrow">{eyebrow}</p>}<h1 className="fh-page-header__title">{title}</h1>{description && <p className="fh-page-header__description">{description}</p>}</header>;
}

export function FHSurface({ children, variant = "default", className = "" }: { children: ReactNode; variant?: "default" | "strong" | "subtle"; className?: string }) {
  return <div className={`fh-surface fh-surface--${variant} ${className}`.trim()}>{children}</div>;
}

export function FHPrimaryCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`fh-primary-card ${className}`.trim()}>{children}</section>;
}

export function FHSection({ children, title, className = "" }: { children: ReactNode; title?: ReactNode; className?: string }) {
  return <section className={`fh-section ${className}`.trim()}>{title && <h2 className="fh-section__title">{title}</h2>}{children}</section>;
}

export function FHEmptyState({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`fh-empty-state ${className}`.trim()}>{children}</div>;
}
