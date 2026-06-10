-- ETAPA 71 A3: lentila „test mâine" — focus temporar pe concepte.
create table if not exists user_focus (
  user_id uuid primary key references auth.users(id) on delete cascade,
  concept_ids uuid[] not null default '{}',
  label text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table user_focus enable row level security;
drop policy if exists user_focus_select_own on user_focus;
create policy user_focus_select_own on user_focus for select using (auth.uid() = user_id);
drop policy if exists user_focus_insert_own on user_focus;
create policy user_focus_insert_own on user_focus for insert with check (auth.uid() = user_id);
drop policy if exists user_focus_update_own on user_focus;
create policy user_focus_update_own on user_focus for update using (auth.uid() = user_id);
drop policy if exists user_focus_delete_own on user_focus;
create policy user_focus_delete_own on user_focus for delete using (auth.uid() = user_id);
grant select, insert, update, delete on user_focus to authenticated;
grant all on user_focus to service_role;
