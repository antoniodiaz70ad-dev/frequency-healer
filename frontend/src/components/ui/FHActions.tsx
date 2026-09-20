import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

export function FHPrimaryAction({ children, className = "", ...props }: ActionProps) {
  return <button className={`fh-action fh-action--primary ${className}`.trim()} {...props}>{children}</button>;
}

export function FHSecondaryAction({ children, className = "", ...props }: ActionProps) {
  return <button className={`fh-action fh-action--secondary ${className}`.trim()} {...props}>{children}</button>;
}

export function FHDangerAction({ children, className = "", ...props }: ActionProps) {
  return <button className={`fh-action fh-action--danger ${className}`.trim()} {...props}>{children}</button>;
}
