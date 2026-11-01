# ATENEA · Biblioteca privada de conciencia — primer corte

**Relacionado:** Issue #45. **Estado:** base de código draft; no conectada a Dropbox, no indexa libros reales y no está desplegada.

## Implementado en este corte

- Política de admisión de archivos: solo PDF en `/Mis plataformas/`, límites de tamaño y permiso de uso privado expresamente revisado. HTML, archivos eliminados y derechos pendientes quedan excluidos.
- Segmentación de texto extraído con hash del contenido y procedencia por propietario, archivo, revisión, obra, capítulo y página. Cuando el extractor no da una página positiva verificable, la cita se marca como no verificada.
- Búsqueda léxica acotada y un puerto para puntuaciones semánticas inyectadas por un proveedor futuro. El resultado filtra por propietario y ofrece citas; el contexto remitido al modelo tiene límite de caracteres.
- Pruebas unitarias específicas para admisión, citas/páginas, límites de resultados y separación entre propietarios.

## Límites y bloqueos antes de una integración real

1. La sesión de usuario del producto no ofrece todavía un identificador autenticado que pueda usarse como límite de seguridad. No se expone ningún endpoint RAG hasta enlazar la identidad de ATENEA con políticas RLS verificables.
2. Dropbox requiere una autorización OAuth propia de ATENEA y credenciales de aplicación guardadas solo en servidor. La conexión de Dropbox disponible en ChatGPT no concede acceso al runtime del sitio.
3. El repositorio aún no contiene una capa Supabase para biblioteca. Este documento define el modelo a revisar; no crea ni aplica migración, tablas, extensión vectorial o políticas en una base.
4. No se incorporan PDFs ni se copian textos de libros. La siguiente fase debe usar el conector de lectura, registrar revisión/borrados, añadir extractor PDF aislado y probar con fixtures autorizados antes de permitir documentos reales.
5. La puntuación semántica no está activa. Este corte no llama a OpenAI, ElevenLabs ni otros proveedores.

## Esquema lógico propuesto para revisión

| Tabla privada | Campos clave | Regla de aislamiento |
|---|---|---|
| `knowledge_sources` | `id`, `owner_id`, `provider`, `dropbox_file_id`, `path`, `revision`, `content_hash`, `rights_status`, `last_seen_at`, `ingestion_status` | El dueño solo ve sus fuentes autorizadas. |
| `knowledge_documents` | `id`, `source_id`, `owner_id`, `title`, `author`, `edition`, `language`, `source_revision`, `deleted_at` | `owner_id` debe coincidir con el dueño de la fuente. |
| `knowledge_chunks` | `id`, `document_id`, `owner_id`, `chapter`, `page_number`, `page_verified`, `content`, `content_hash`, `embedding` futuro | RLS por propietario; contenido nunca público. |
| `knowledge_ingestion_runs` | `id`, `source_id`, `owner_id`, `started_at`, `finished_at`, `status`, `error_code`, `indexed_count` | No guardar tokens OAuth, textos completos ni audio en logs. |
| `knowledge_permissions` | `owner_id`, `app_user_id`, `scope`, `granted_at`, `revoked_at` | Revocación invalida acceso y elimina/inhabilita índice asociado. |

**Condición de diseño:** no escribir políticas basadas en `auth.uid()` hasta acordar cómo la sesión vigente del sitio se traduce a un sujeto verificable de Supabase. RLS en todas las tablas; ninguna clave `service_role` en cliente; funciones de búsqueda en esquema no expuesto o endpoint server-only con autorización explícita.

## Criterio para el siguiente corte

Primero resolver autenticación de ATENEA y registrar Dropbox OAuth (scope mínimo de lectura, URI de retorno y almacenamiento de refresh token en secret manager); después crear migración revisable para un proyecto staging aislado, construir el conector incremental con revocación/borrados, extractor de PDF con páginas verificables y búsqueda híbrida con citas. Mantener el feature flag apagado y no desplegar a producción.
