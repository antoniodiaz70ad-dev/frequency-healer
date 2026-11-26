import assert from "node:assert/strict";
import test from "node:test";
import { destinations, navigationGroup, parseFavorites } from "../src/lib/navigation";
import { readRecordCollections } from "../src/lib/recordCollections";
import { MARINA_STORAGE_KEY } from "../src/lib/marina/model";
test("navigation preserves direct access to cymatics, Marina and all original tools",()=>{
 for(const href of ["/laboratorio-cimatico","/marina-punto-cero","/preparacion-cristales","/laboratorio-armonico","/marina-punto-cero/compositor","/generador","/respiracion-atencion","/biblioteca","/protocolos","/sesion-nueva","/voz"])assert.ok(destinations.some(r=>r.href===href),href);
 assert.equal(navigationGroup("/laboratorio-cimatico"),"/experimentar");
 assert.equal(navigationGroup("/marina-punto-cero/estudio"),"/estudiar");
 assert.equal(navigationGroup("/marina-punto-cero/diario"),"/mis-registros");
 assert.equal(navigationGroup("/marina-punto-cero/compositor"),"/experimentar");
 assert.equal(navigationGroup("/marina-punto-cero"),"/practicar");
});
test("favorites accept only known destinations without changing malformed input",()=>{
 assert.deepEqual(parseFavorites(null),[]);
 assert.deepEqual(parseFavorites('["marina","cimatica","marina"]'),["marina","cimatica"]);
 for(const value of ['{"marina":true}','["unknown"]','bad-json'])assert.throws(()=>parseFavorites(value));
});
test("record overview can read empty stores with no writable storage interface",async()=>{
 const reader={getItem:()=>null},rows=await readRecordCollections(reader);
 assert.ok(rows.length>8);
 assert.ok(rows.every(row=>!row.error));
 assert.ok(rows.filter(row=>row.count!==undefined).every(row=>row.count===0));
 assert.ok(rows.some(r=>r.id==="marina"&&r.href.endsWith("/diario")));
 assert.ok(rows.some(r=>r.id==="galeria"));
});
test("one corrupt diary is unavailable, not empty; other collections remain readable",async()=>{
 const raw=new Map([[MARINA_STORAGE_KEY,'{corrupt']]),before=[...raw];
 const rows=await readRecordCollections({getItem:key=>raw.get(key)??null});
 const marina=rows.find(r=>r.id==="marina")!;
 assert.ok(marina.error);assert.equal(marina.count,undefined);
 assert.equal(rows.find(r=>r.id==="cristales")!.count,0);
 assert.deepEqual([...raw],before);
});
test("blocked browser storage shows unavailable collections without attempted repairs",async()=>{
 const rows=await readRecordCollections({getItem(){throw new Error("blocked");}});
 assert.ok(rows.filter(r=>r.id!=="obe").every(r=>r.error&&r.count===undefined));
});
