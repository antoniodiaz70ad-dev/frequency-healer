import type { ReactNode } from "react";

export default function FHDisclosure({ summary, children, open = false }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return <details className="fh-disclosure" open={open}><summary>{summary}</summary><div>{children}</div></details>;
}
