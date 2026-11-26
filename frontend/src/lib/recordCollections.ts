import { VoiceStore } from "./voice/storage";
import { readMarinaRecords } from "./marina/model";
import { readCrystalNotebook } from "./crystals/model";
import { readCompositions, readComposerSessions } from "./marina/composer";
import { readGeometryJournal } from "./cymatics/geometryJournal";
import { readCymaticsGallery } from "./cymatics/storage";
import { readCymaticsExperiments } from "./cymatics/experiments";
import { ExperimentStore } from "./experiments/storage";
import { ExperimentStoreV2 } from "./experiments/storageV2";
import { ConstellationStore } from "./harmonic/constellationStorage";
import { readBentovSessions } from "./bentov/storage";
type Reader = Pick<Storage,"getItem">;
export type RecordCollection = {id:string;title:string;description:string;href:string;type:"diarios"|"experimentos"|"recetas";count?:number;error?:string;gated?:"voice"|"harmonic"};
type Source = Omit<RecordCollection,"count"|"error"> & {count?:(store:Storage)=>number|Promise<number>};
const sources:Source[]=[
 {id:"marina",title:"Diario de Marina",description:"Prácticas, intenciones y observaciones posteriores.",href:"/marina-punto-cero/diario",type:"diarios",count:s=>readMarinaRecords(s).length},
 {id:"cristales",title:"Cuaderno de cristales",description:"Preparaciones, sesiones y seguimiento de tus piezas.",href:"/preparacion-cristales/cuaderno",type:"diarios",count:s=>readCrystalNotebook(s).sessions.length},
 {id:"geometria",title:"Diario de geometría e intención",description:"Experiencias, emociones y decisiones de tus recorridos.",href:"/laboratorio-cimatico?area=geometria#diario-geometrico",type:"diarios",count:s=>readGeometryJournal(s).length},
 {id:"compositor-diario",title:"Diario del compositor",description:"Observaciones de las composiciones que decidiste guardar.",href:"/marina-punto-cero/compositor#diario-compositor",type:"diarios",count:s=>readComposerSessions(s).length},
 {id:"guiadas",title:"Sesiones guiadas",description:"Intenciones, observaciones y sesiones guardadas.",href:"/voz#historial-sesiones",type:"diarios",gated:"voice",count:s=>new VoiceStore(s).load().length},
 {id:"respiracion",title:"Respiración y atención",description:"Registros del programa y de tu práctica.",href:"/respiracion-atencion",type:"diarios",count:s=>{const r=readBentovSessions(s);if(r.status==="invalid")throw new Error(r.error);return r.data.length;}},
 {id:"obe",title:"Diario OBE",description:"Recuerdos y experiencias de tus prácticas contemplativas.",href:"/diario",type:"diarios"},
 {id:"galeria",title:"Galería cimática",description:"Figuras y configuraciones guardadas en el laboratorio.",href:"/laboratorio-cimatico#galeria-cimatica",type:"experimentos",count:s=>readCymaticsGallery(s).length},
 {id:"cimaticos",title:"Experimentos de cimática",description:"Protocolos, configuraciones y observaciones de placa.",href:"/laboratorio-cimatico#experimentos-cimaticos",type:"experimentos",count:s=>readCymaticsExperiments(s).length},
 {id:"armonicos",title:"Experimentos armónicos",description:"Tus registros de escucha y comparación.",href:"/laboratorio-armonico#lab-record",type:"experimentos",gated:"harmonic",count:async s=>{const a=new ExperimentStore(s).load(),b=await new ExperimentStoreV2(s).load();return new Set([...a,...b].map(r=>r.id)).size;}},
 {id:"recetas",title:"Mis recetas del compositor",description:"Tus composiciones guardadas para volver a escucharlas.",href:"/marina-punto-cero/compositor#mis-recetas",type:"recetas",count:s=>readCompositions(s).length},
 {id:"constelaciones",title:"Constelaciones armónicas",description:"Estructuras que construiste y guardaste.",href:"/laboratorio-armonico#lab-build",type:"recetas",gated:"harmonic",count:async s=>(await new ConstellationStore(s).load()).length},
];
/** Reads existing validated stores. No migration, repair or record writes are allowed. */
export async function readRecordCollections(reader:Reader):Promise<RecordCollection[]>{
 const reject=()=>{throw new Error("La vista de registros es de solo lectura.");};
 const store:Storage={getItem:key=>reader.getItem(key),setItem:reject,removeItem:reject,clear:reject,key:()=>null,length:0};
 return Promise.all(sources.map(async({count,...source})=>{
  if(!count)return source;
  try{return {...source,count:await count(store)};}
  catch{return {...source,error:"No se pudo leer. El original se conserva."};}
 }));
}
