alter table public.memories
  add column if not exists city text check (char_length(city) <= 100),
  add column if not exists region_name text check (char_length(region_name) <= 100),
  add column if not exists country_code text check (country_code ~ '^[A-Z]{2}$');

create index if not exists memories_country_region_city_idx
  on public.memories (country_code, region_name, city)
  where status = 'approved';
