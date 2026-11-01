# ATENEA · Biblioteca privada de conciencia — primer corte

**Relacionado:** Issue #45. **Estado:** base de código y dos migraciones en PR draft; esquema aplicado únicamente al proyecto `frequency-healer-atenea-staging`; no conectada a Dropbox ni indexa libros reales.

## Implementado en este corte

- Política de admisión de archivos: solo PDF en `/Mis plataformas/`, límites de tamaño y permiso de uso privado expresamente revisado. HTML, archivos eliminados y derechos pendientes quedan excluidos.
- Segmentación de texto extraído con hash del contenido y procedencia por propietario, archivo, revisión, obra, capítulo y página. Cuando el extractor no da una página positiva verificable, la cita se marca como no verificada.
- Búsqueda léxica acotada y un puerto para puntuaciones semánticas inyectadas por un proveedor futuro. El resultado filtra por propietario y ofrece citas; el contexto remitido al modelo tiene límite de caracteres.
- Migraciones versionadas con `supabase migration new` para el esquema privado, claves compuestas que evitan mezclar propietarios, índices de FK, RLS activado y sin políticas de lectura/escritura para clientes `anon`/`authenticated`.
- Pruebas unitarias específicas para admisión, citas/páginas, límites de resultados y separación entre propietarios.

## Límites y bloqueos antes de una integración real

1. La sesión de usuario del producto no ofrece todavía un identificador autenticado que pueda usarse como límite de seguridad. No se expone ningún endpoint RAG hasta enlazar la identidad de ATENEA con políticas RLS verificables.
2. Dropbox requiere una autorización OAuth propia de ATENEA y credenciales de aplicación guardadas solo en servidor. La conexión de Dropbox disponible en ChatGPT no concede acceso al runtime del sitio.
3. Las migraciones se aplicaron y verificaron solo en `frequency-healer-atenea-staging`; no se han aplicado a producción. No se ha creado extensión vectorial ni políticas por usuario: la sesión de ATENEA aún no se traduce a un sujeto JWT verificable por Supabase. Las tablas están bloqueadas para clientes y reservadas al futuro servicio de servidor.
4. No se incorporan PDFs ni se copian textos de libros. La siguiente fase debe usar el conector de lectura, registrar revisión/borrados, añadir extractor PDF aislado y probar con fixtures autorizados antes de permitir documentos reales.
5. La puntuación semántica no está activa. Este corte no llama a OpenAI, ElevenLabs ni otros proveedores.

## Esquema lógico propuesto para revisión

| Tabla privada | Campos clave | Regla de aislamiento |
|---|---|---|
| `knowledge_sources` | `id`, `owner_id` (hash del issuer + `sub` verificados), `provider`, `dropbox_file_id`, `path`, `revision`, `content_hash`, `rights_status`, `last_seen_at`, `ingestion_status` | No guardar correo ni el `sub` original; el dueño solo ve sus fuentes autorizadas. |
| `knowledge_documents` | `id`, `source_id`, `owner_id`, `title`, `author`, `edition`, `language`, `source_revision`, `deleted_at` | `owner_id` debe coincidir con el dueño de la fuente mediante clave compuesta. |
| `knowledge_chunks` | `id`, `document_id`, `owner_id`, `chapter`, `page_number`, `page_verified`, `content`, `content_hash`, `embedding` futuro | RLS por propietario; contenido nunca público. |
| `knowledge_ingestion_runs` | `id`, `source_id`, `owner_id`, `started_at`, `finished_at`, `status`, `error_code`, `indexed_count` | No guardar tokens OAuth, textos completos ni audio en logs. |
| `knowledge_permissions` | `owner_id`, `app_user_id`, `scope`, `granted_at`, `revoked_at` | Revocación invalida acceso y elimina/inhabilita índice asociado. |

**Condición de diseño:** PR #41 contiene un verificador de token y sesión revocable que produce un identificador pseudónimo, pero su login Auth0 sigue documentado como pendiente. La futura búsqueda debe recibir del servidor ese identificador validado, jamás un `owner_id` elegido por el navegador. RLS está habilitado y no hay políticas para acceso de clientes; el servicio futuro usará credenciales solo servidor y deberá filtrar por propietario en cada consulta. Ninguna clave de servidor en cliente. El advisor de Supabase informa `RLS Enabled No Policy` para estas tablas; es el resultado esperado del bloqueo completo hasta instalar autenticación y un modelo RLS verificable.

## Criterio para el siguiente corte

Primero terminar el login Auth0 ya descrito en PR #41 y definir políticas RLS por sujeto verificado; luego registrar Dropbox OAuth (scope mínimo de lectura, URI de retorno y refresh token en secret manager), construir el conector incremental con revocación/borrados, extractor de PDF con páginas verificables y búsqueda híbrida con citas. Mantener el feature flag apagado y no desplegar a producción.


## Revisión complementaria (01-nov-2026)

- **Migraciones de staging:** el SQL de esta biblioteca fue aplicado al proyecto `frequency-healer-atenea-staging` y su historial utiliza versiones `20261101230640` y `20261101230730`. El comentario inicial del archivo SQL dice «not applied» y representa el estado en que se redactó originalmente; **ya no refleja el estado de staging**. Se conserva el contenido de las migraciones aplicadas para no alterar su historial; esta nota es la aclaración vigente.
- **Control defensivo:** el adaptador puro `searchAuthorizedKnowledge` comprueba permisos, propiedad, vigencia de revisión, derechos y eliminación. No autentica por sí mismo: las identidades y el estado de archivos deben provenir de consultas verificadas del servidor. No hay endpoint ni OAuth conectados. `service_role` puede omitir RLS; ninguna llamada debe aceptar identidad de un navegador.
- **Páginas:** un entero positivo no prueba referencia exacta. La procedencia se marca solo si el extractor de PDF suministra índice físico, identidad y revisión coincidentes. Las citas indican **página física del PDF**, no página impresa; hasta validar el extractor, no se publicarán referencias como verificadas.
- **Seguridad:** este corte conserva flags OFF, sin lectura real de Dropbox, sin libros indexados y sin modificaciones en producción.
