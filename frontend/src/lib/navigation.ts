/** Presentation-only destinations. Existing module routes and storage remain canonical. */
export type Destination = { id: string; title: string; description: string; href: string; group: "practicar" | "estudiar" | "experimentar"; gated?: "voice" | "harmonic" };
export const destinations: Destination[] = [
 { id:"sesion-guiada", title:"Sesión guiada", description:"Parte de una intención y revisa una propuesta antes de escuchar.", href:"/voz", group:"practicar", gated:"voice" },
 { id:"marina", title:"Marina · Punto Cero", description:"Explora sonido, emoción e imagen con tus prácticas de 12 y 24 minutos.", href:"/marina-punto-cero", group:"practicar" },
 { id:"cristales", title:"Preparación de cristales", description:"Prepara tu pieza, define una intención y recorre la guía de sonido.", href:"/preparacion-cristales", group:"practicar" },
 { id:"respiracion", title:"Respiración y atención", description:"Practica a tu ritmo o sigue el programa de observación de 14 días.", href:"/respiracion-atencion", group:"practicar" },
 { id:"obe", title:"Exploración OBE", description:"Preparación contemplativa avanzada y registro de experiencias subjetivas.", href:"/sesion-nueva", group:"practicar" },
 { id:"documentos", title:"Mis documentos", description:"Consulta los textos que has incorporado a tu biblioteca.", href:"/biblioteca?tab=documentos", group:"estudiar" },
 { id:"atlas", title:"Atlas de frecuencias", description:"Explora referencias acústicas, musicales e históricas con su procedencia.", href:"/biblioteca", group:"estudiar" },
 { id:"marina-estudio", title:"Estudiar a Marina Jacobi", description:"Lee los principios y fuentes del cuaderno, separados de nuestra adaptación sonora.", href:"/marina-punto-cero/estudio", group:"estudiar" },
 { id:"geometria", title:"Geometría y proporciones", description:"Comprende relaciones musicales, construcciones geométricas y sus fuentes.", href:"/laboratorio-cimatico?area=geometria", group:"estudiar" },
 { id:"historicos", title:"Archivo de protocolos históricos", description:"Consulta secuencias heredadas y distingue su contexto de su respaldo.", href:"/protocolos", group:"estudiar" },
 { id:"cimatica", title:"Laboratorio de Cimática", description:"Observa placas y membranas virtuales, explora resonancias y compara variables.", href:"/laboratorio-cimatico", group:"experimentar" },
 { id:"armonico", title:"Laboratorio Armónico", description:"Escucha relaciones exactas, construye constelaciones y registra experimentos.", href:"/laboratorio-armonico", group:"experimentar", gated:"harmonic" },
 { id:"compositor", title:"Compositor de sonido", description:"Combina hasta tres capas de tonos, pulsos y diferencias binaurales.", href:"/marina-punto-cero/compositor", group:"experimentar" },
 { id:"geometria-practica", title:"Geometría e intención", description:"Explora trazados y proporciones, realiza un recorrido y registra lo observado.", href:"/laboratorio-cimatico?area=geometria", group:"experimentar" },
 { id:"generador", title:"Generador manual", description:"Configura directamente una señal cuando necesites los controles avanzados.", href:"/generador", group:"experimentar" },
];
export const primaryNavigation = [
 {href:"/inicio",label:"Inicio"}, {href:"/practicar",label:"Practicar"},
 {href:"/estudiar",label:"Estudiar"}, {href:"/experimentar",label:"Experimentar"},
 {href:"/mis-registros",label:"Mis registros"},
] as const;
export function navigationGroup(path: string) {
 if (path.startsWith("/marina-punto-cero/estudio") || ["/biblioteca","/protocolos"].some(p=>path.startsWith(p))) return "/estudiar";
 if (path.startsWith("/marina-punto-cero/diario") || path.startsWith("/preparacion-cristales/cuaderno") || path==="/diario") return "/mis-registros";
 if (path.startsWith("/marina-punto-cero/compositor") || ["/laboratorio-cimatico","/laboratorio-armonico","/generador"].some(p=>path.startsWith(p))) return "/experimentar";
 if (["/voz","/marina-punto-cero","/preparacion-cristales","/respiracion-atencion","/sesion-nueva"].some(p=>path.startsWith(p))) return "/practicar";
 return path;
}
export const FAVORITES_KEY = "fh.navigation.favorites.v1";
export function parseFavorites(raw: string | null): string[] {
 if(raw===null)return [];
 const value:unknown=JSON.parse(raw);
 if(!Array.isArray(value)||value.length>destinations.length||value.some(id=>typeof id!=="string"||!destinations.some(d=>d.id===id)))throw new Error("No se pudieron leer tus favoritos. Los datos originales se conservan.");
 return [...new Set(value)] as string[];
}
