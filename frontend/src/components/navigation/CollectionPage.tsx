import Link from "next/link";
import { destinations, type Destination } from "@/lib/navigation";
import { VOICE_ENABLED, HARMONIC_ENABLED } from "@/lib/voice/feature";
import { FavoriteButton } from "./Favorites";
export default function CollectionPage({group,title,description}:{group:Destination["group"];title:string;description:string}){
 const rows=destinations.filter(d=>d.group===group&&(!d.gated||(d.gated==="voice"?VOICE_ENABLED:HARMONIC_ENABLED)));
 return <div className="rl-collection"><header className="rl-collection-header"><p className="rl-kicker">Sonido, estructura y exploración</p><h1>{title}</h1><p>{description}</p></header><ul className="rl-destination-list">{rows.map(r=><li key={r.id}><Link href={r.href} className="rl-destination"><h2>{r.title}</h2><p>{r.description}</p></Link><FavoriteButton id={r.id} title={r.title}/></li>)}</ul><p className="rl-collection-note">Marca una estrella para abrir ese módulo directamente desde Inicio.</p></div>;
}
