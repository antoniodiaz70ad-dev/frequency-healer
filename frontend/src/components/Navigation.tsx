"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GearSix, WaveSine } from "@phosphor-icons/react";
import { primaryNavigation, navigationGroup } from "@/lib/navigation";
export default function Navigation() {
 const pathname=usePathname(), active=navigationGroup(pathname);
 return <header className="rl-header">
  <Link href="/inicio" className="rl-brand" aria-label="Resonance Lab · Inicio"><WaveSine size={54} weight="light" aria-hidden="true"/><span>Resonance Lab</span></Link>
  <nav aria-label="Navegación principal" className="rl-nav">{primaryNavigation.map(item=><Link key={item.href} href={item.href} aria-current={active===item.href?"page":undefined}>{item.label}</Link>)}</nav>
  <Link href="/ajustes" className="rl-settings" aria-label="Ajustes" aria-current={pathname==="/ajustes"?"page":undefined}><GearSix size={30} weight="regular" aria-hidden="true"/></Link>
 </header>;
}
