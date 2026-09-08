-- Friends can now browse the atlas while the site is still counting down.
-- The cinematic reveal experience stays gated by site_settings.revealed in
-- the frontend; this only opens read access to approved moments.

drop policy "Approved memories are publicly readable" on public.memories;

create policy "Approved memories are publicly readable"
on public.memories for select
using (public.is_admin() or status = 'approved');
