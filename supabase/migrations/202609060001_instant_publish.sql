alter table public.memories
  alter column status set default 'approved';

comment on column public.memories.status is
  'approved entries are visible; rejected entries are hidden and recoverable; pending is retained only for legacy records';
