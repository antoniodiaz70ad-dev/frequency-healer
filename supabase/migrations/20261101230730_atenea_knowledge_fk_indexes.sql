-- Cover the owner-linked foreign keys identified by Supabase performance advisors.
create index knowledge_documents_fk_source_owner_idx
  on atenea_private.knowledge_documents (source_id, owner_id);

create index knowledge_chunks_fk_document_source_owner_idx
  on atenea_private.knowledge_chunks (document_id, source_id, owner_id);

create index knowledge_ingestion_runs_fk_source_owner_idx
  on atenea_private.knowledge_ingestion_runs (source_id, owner_id);
