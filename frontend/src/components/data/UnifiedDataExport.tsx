"use client";
import { useState } from 'react';
import { createUnifiedExport, verifyUnifiedExport, type UnifiedExportV1 } from '@/lib/dataExport';
import { FHSurface } from '@/components/ui/FHLayout';

function download(value:UnifiedExportV1){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`frequency-healer-export-v1-${value.exportedAt.slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);}
export default function UnifiedDataExport(){
  const [value,setValue]=useState<UnifiedExportV1|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const prepare=async()=>{setBusy(true);setError('');try{const next=await createUnifiedExport(localStorage);await verifyUnifiedExport(next);setValue(next);}catch(e){setValue(null);setError((e as Error).message);}finally{setBusy(false);}};
  return <FHSurface variant="subtle" className="p-5"><p className="fh-label">Datos y exportación</p><h2 className="mt-2 font-medium text-[var(--fh-text)]">Exportación unificada V1</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--fh-text-muted)]">Reúne únicamente los datos de Frequency Healer permitidos por la lista explícita. Conserva los datos inválidos sin repararlos y verifica integridad y procedencia de Seed Selection V1 antes de descargar.</p>
    <div className="mt-4 flex flex-wrap gap-3"><button className="fh-action fh-action--secondary" type="button" disabled={busy} onClick={()=>void prepare()}>{busy?'Verificando…':'Preparar exportación unificada'}</button>{value&&<button className="fh-action fh-action--primary" type="button" onClick={()=>download(value)}>Descargar exportación V1</button>}</div>
    {value&&<p className="mt-3 text-sm text-[var(--fh-text-secondary)]" role="status">Exportación verificada · {value.namespaces.filter(x=>x.status==='valid').length} válidos · {value.namespaces.filter(x=>x.status==='absent').length} ausentes · {value.namespaces.filter(x=>x.status==='invalid').length} inválidos preservados.</p>}{error&&<p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
  </FHSurface>;
}
