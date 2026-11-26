"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Navigation from "./Navigation";
import { navigationGroup, primaryNavigation } from "@/lib/navigation";
export default function AppFrame({ children }: { children: React.ReactNode }) {
 const pathname=usePathname();
 if(pathname==="/"||pathname==="/landing")return <main>{children}</main>;
 const parent=primaryNavigation.find(n=>n.href===navigationGroup(pathname));
 const hub=primaryNavigation.some(n=>n.href===pathname)||pathname==="/ajustes";
 return <div className="rl-frame"><a href="#contenido" className="rl-skip">Ir al contenido</a><Navigation/>
 <main id="contenido" className={`rl-main ${hub?"rl-main--hub":"rl-main--module"}`}>
 {!hub&&parent&&<div className="rl-module-location"><Link href={parent.href}>Volver a {parent.label.toLocaleLowerCase("es")}</Link></div>}
 {children}</main></div>;
}
