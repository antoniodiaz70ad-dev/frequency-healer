# Evidencia de verificación — ATENEA PR #46

Fecha de comprobación: **2026-11-01**. Este informe registra lo comprobado en el código del PR y en el proyecto aislado de Supabase; no certifica integración Dropbox ni indexación real.

## Código y pruebas repetidas

- Revisión probada: `a097b059ed5775b2eacae6039e47b5c03790ee43` (`codex/atenea-consciousness-rag-foundation`).
- Hora de la repetición local: `2026-11-01T23:14:40Z`.
- Runtime: Node `v22.23.4`; npm `11.9.0`.
- `npm test`: **270 passed, 0 failed**.
- `npm run typecheck`: **exit 0**.
- `npm run lint`: **exit 0**.

Los tres comandos se ejecutaron desde `frontend/`, usando Node 22 en el `PATH`. Los nuevos tests de conocimiento cubren admisión de PDFs, permisos pendientes, páginas verificadas/no verificadas, separación de propietarios y límites de resultados/contexto.

## Migraciones y staging

Proyecto: `frequency-healer-atenea-staging` (`rayebpxdfatsnkbderot`). Las dos migraciones aplicadas y registradas por Supabase son:

| Versión registrada | Migración | Resultado |
|---|---|---|
| `20261101230640` | `atenea_consciousness_library` | Aplicada |
| `20261101230730` | `atenea_knowledge_fk_indexes` | Aplicada |

Los nombres de archivo del PR se alinean con esos números de versión para que `supabase migration list` reconozca el historial aplicado.

### Consulta de tablas y RLS

Consulta ejecutada en staging:

```sql
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced,
       (select count(*) from pg_policies p
        where p.schemaname = n.nspname and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'atenea_private'
order by c.relname;
```

Resultado: cinco tablas (`knowledge_sources`, `knowledge_documents`, `knowledge_chunks`, `knowledge_ingestion_runs`, `knowledge_permissions`); en todas `rls_enabled=true`, `rls_forced=true`, `policy_count=0`.

### Comprobación de privilegios de esquema

```sql
select role_name,
       has_schema_privilege(role_name, 'atenea_private', 'USAGE') as schema_usage
from unnest(array['anon','authenticated','service_role']) as role_name
order by role_name;
```

Resultado: `anon=false`, `authenticated=false`, `service_role=true`. La ausencia de políticas es un bloqueo deliberado y temporal: el login Auth0 y la identidad verificable aún no están implementados. No existe endpoint de lectura que use `service_role`.

### Historial y rendimiento

Lectura de `supabase_migrations.schema_migrations` confirmó las dos versiones y nombres de arriba. El advisor de rendimiento ya no reporta claves foráneas sin índice; las alertas de índices no usados son esperables porque la biblioteca está vacía.

El advisor de seguridad también informa que las cinco tablas tienen RLS sin políticas, como bloqueo intencional. En el proyecto había además hallazgos ajenos a estas migraciones: `atenea_ops.reaper_runs` sin políticas, `pg_net` en `public` y protección de contraseñas filtradas desactivada. Este PR no modifica esos elementos.

## Límites de esta evidencia

- Las migraciones solo se aplicaron a staging; no a producción.
- No se conectó OAuth de Dropbox, no se leyeron PDFs y no hay documentos indexados.
- No se habilitaron embeddings, endpoint RAG ni consulta desde voz.
- El verificador/sesión revocable de PR #41 existe en su rama draft; las rutas de login Auth0 siguen pendientes.
