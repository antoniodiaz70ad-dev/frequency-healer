-- ATENEA private knowledge library schema proposal.
-- This migration is review-only; it has NOT been applied to any Supabase project.
-- No policies grant access to anon/authenticated. The future server adapter must
-- verify the ATENEA session and derived owner_id before using server-only service_role.

create schema if not exists atenea_private;
revoke all on schema atenea_private from public, anon, authenticated;
grant usage on schema atenea_private to service_role;

create table atenea_private.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  -- SHA-256 of the validated issuer + sub from the server auth adapter; never raw sub/email.
  owner_id text not null check (owner_id ~ '^[0-9a-f]{64}$'),
  provider text not null check (provider = 'dropbox'),
  provider_file_id text not null check (length(provider_file_id) between 1 and 512),
  path text not null check (path like '/Mis plataformas/%'),
  revision text not null check (length(revision) between 1 and 255),
  content_hash text,
  rights_status text not null default 'pending'
    check (rights_status in ('pending', 'owner-authorized-private-use', 'restricted')),
  ingestion_status text not null default 'discovered'
    check (ingestion_status in ('discovered', 'blocked-rights', 'indexed', 'changed', 'deleted', 'failed')),
  last_seen_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, provider, provider_file_id),
  unique (id, owner_id)
);

create table atenea_private.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  owner_id text not null check (owner_id ~ '^[0-9a-f]{64}$'),
  title text not null check (length(title) between 1 and 500),
  author text not null default 'Unknown' check (length(author) <= 300),
  edition text,
  language text,
  source_revision text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (source_id, owner_id)
    references atenea_private.knowledge_sources(id, owner_id) on delete cascade,
  unique (source_id, source_revision),
  unique (id, source_id, owner_id)
);

create table atenea_private.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  source_id uuid not null,
  owner_id text not null check (owner_id ~ '^[0-9a-f]{64}$'),
  chunk_index integer not null check (chunk_index >= 0),
  chapter text,
  page_number integer check (page_number is null or page_number > 0),
  page_verified boolean not null default false,
  content text not null check (length(content) between 1 and 1200),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (document_id, source_id, owner_id)
    references atenea_private.knowledge_documents(id, source_id, owner_id) on delete cascade,
  check (page_verified = (page_number is not null)),
  unique (document_id, chunk_index)
);

create table atenea_private.knowledge_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  owner_id text not null check (owner_id ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  error_code text check (error_code is null or length(error_code) <= 80),
  indexed_count integer not null default 0 check (indexed_count >= 0),
  foreign key (source_id, owner_id)
    references atenea_private.knowledge_sources(id, owner_id) on delete cascade,
  unique (id, source_id, owner_id)
);

create table atenea_private.knowledge_permissions (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null check (owner_id ~ '^[0-9a-f]{64}$'),
  app_user_id text not null check (app_user_id ~ '^[0-9a-f]{64}$'),
  scope text not null check (scope in ('read-private-library')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (owner_id, app_user_id, scope)
);

create index knowledge_sources_owner_status_idx
  on atenea_private.knowledge_sources (owner_id, ingestion_status);
create index knowledge_documents_owner_idx
  on atenea_private.knowledge_documents (owner_id, source_id);
create index knowledge_chunks_owner_doc_idx
  on atenea_private.knowledge_chunks (owner_id, document_id, chunk_index);
create index knowledge_ingestion_runs_source_idx
  on atenea_private.knowledge_ingestion_runs (owner_id, source_id, started_at desc);

alter table atenea_private.knowledge_sources enable row level security;
alter table atenea_private.knowledge_documents enable row level security;
alter table atenea_private.knowledge_chunks enable row level security;
alter table atenea_private.knowledge_ingestion_runs enable row level security;
alter table atenea_private.knowledge_permissions enable row level security;

alter table atenea_private.knowledge_sources force row level security;
alter table atenea_private.knowledge_documents force row level security;
alter table atenea_private.knowledge_chunks force row level security;
alter table atenea_private.knowledge_ingestion_runs force row level security;
alter table atenea_private.knowledge_permissions force row level security;

revoke all on all tables in schema atenea_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema atenea_private to service_role;
