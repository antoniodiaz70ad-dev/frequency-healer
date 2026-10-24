"use client";
import { useState } from 'react';
import { createUnifiedExport, verifyUnifiedExport, type UnifiedExportV2 } from '@/lib/dataExport';
import { FHSurface } from '@/components/ui/FHLayout';

function download(value:UnifiedExportV2){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`frequency-healer-export-v2-${value.exportedAt.slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);}
export default function UnifiedDataExport(){
  const [value,setValue]=useState<UnifiedExportV2|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const prepare=async()=>{setBusy(true);setError('');try{const next=await createUnifiedExport(localStorage);await verifyUnifiedExport(next);setValue(next);}catch(e){setValue(null);setError((e as Error).message);}finally{setBusy(false);}};
  return <FHSurface variant="subtle" className="p-5"><p className="fh-label">Datos y exportación</p><h2 className="mt-2 font-medium text-[var(--fh-text)]">Exportación unificada V2</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fh-text-muted)]">Reúne únicamente los datos de Resonance Lab permitidos por la lista explícita, incluidos los programas y sesiones de Respiración y atención. Conserva los datos inválidos sin repararlos y mantiene verificación compatible con exportaciones V1.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button className="fh-action fh-action--secondary" type="button" disabled={busy} onClick={()=>void prepare()}>{busy?'Verificando…':'Preparar exportación unificada'}</button>{value&&<button className="fh-action fh-action--primary" type="button" onClick={()=>download(value)}>Descargar exportación V2</button>}</div>
    {value&&<p className="mt-3 text-sm text-[var(--fh-text-secondary)]" role="status">Exportación verificada · {value.namespaces.filter(x=>x.status==='valid').length} válidos · {value.namespaces.filter(x=>x.status==='absent').length} ausentes · {value.namespaces.filter(x=>x.status==='invalid').length} inválidos preservados.</p>}{error&&<p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
  </FHSurface>;
}
