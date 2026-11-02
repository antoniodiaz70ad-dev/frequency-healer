-- Dropbox App Folder API paths are relative to the app's private root, so a
-- copied pilot PDF is exposed as `/filename.pdf`, not `/Mis plataformas/...`.
-- Forward-only correction: preserve migration history and all existing rows.
alter table atenea_private.knowledge_sources
  drop constraint knowledge_sources_path_check;

alter table atenea_private.knowledge_sources
  add constraint knowledge_sources_app_folder_path_check
  check (
    path ~ '^/[^/]+(/[^/]+)*$'
    and path !~ '(^|/)\.{1,2}(/|$)'
    and position(E'\\' in path) = 0
    and path !~ '[[:cntrl:]]'
    and lower(path) like '%.pdf'
  );
