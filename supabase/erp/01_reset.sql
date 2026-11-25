begin;

do $$
declare
  r record;
begin
  for r in select table_name from information_schema.views where table_schema = 'public' loop
    execute format('drop view if exists public.%I cascade', r.table_name);
  end loop;

  for r in select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' loop
    execute format('drop table if exists public.%I cascade', r.table_name);
  end loop;

  for r in select sequence_name from information_schema.sequences where sequence_schema = 'public' loop
    execute format('drop sequence if exists public.%I cascade', r.sequence_name);
  end loop;

  for r in
    select p.oid::regprocedure as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (
         select 1
           from pg_depend d
          where d.objid = p.oid
            and d.deptype = 'e'
       )
  loop
    execute format('drop function if exists %s cascade', r.fn);
  end loop;

  for r in
    select t.typname
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

commit;
