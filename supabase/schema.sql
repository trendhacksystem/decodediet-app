-- ============================================================
-- DecodeDiet ぷよぷよちゃん データベース定義
-- Supabase の SQL Editor にこのファイル全体を貼り付けて Run してください
-- ============================================================

-- ---------- テーブル ----------

-- 患者・カウンセラーのプロフィール
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  role text not null default 'patient' check (role in ('patient', 'counselor')),
  points integer not null default 0,
  goal_text text,
  goal_date date,
  created_at timestamptz not null default now()
);

-- 日々の体組成・行動記録（1人1日1行）
create table public.daily_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  record_date date not null,
  weight numeric(5,2),
  fat numeric(5,2),
  muscle numeric(5,2),
  water numeric(5,2),
  habits text[] not null default '{}',
  meal_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, record_date)
);

-- 食事写真（実体は Storage、ここはメタデータ）
create table public.meal_photos (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  record_date date not null,
  storage_path text not null,
  taken_at timestamptz not null default now()
);

-- カウンセラーからのお手紙
create table public.letters (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.daily_records (user_id, record_date desc);
create index on public.meal_photos (user_id, record_date desc);
create index on public.letters (patient_id, created_at desc);

-- ---------- サインアップ時にプロフィールを自動作成 ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- カウンセラー判定関数 ----------

create or replace function public.is_counselor()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'counselor'
  );
$$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.daily_records enable row level security;
alter table public.meal_photos enable row level security;
alter table public.letters enable row level security;

-- profiles: 本人は読み書き、カウンセラーは全員分を閲覧可
create policy "own profile select" on public.profiles
  for select using (auth.uid() = id or public.is_counselor());
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = 'patient' or public.is_counselor());

-- daily_records: 本人は読み書き、カウンセラーは閲覧のみ
create policy "own records all" on public.daily_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "counselor records select" on public.daily_records
  for select using (public.is_counselor());

-- meal_photos: 本人は読み書き、カウンセラーは閲覧のみ
create policy "own photos all" on public.meal_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "counselor photos select" on public.meal_photos
  for select using (public.is_counselor());

-- letters: 患者は自分宛を閲覧・既読化、カウンセラーは作成・全閲覧
create policy "patient letters select" on public.letters
  for select using (auth.uid() = patient_id or public.is_counselor());
create policy "patient letters read" on public.letters
  for update using (auth.uid() = patient_id) with check (auth.uid() = patient_id);
create policy "counselor letters insert" on public.letters
  for insert with check (public.is_counselor() and sender_id = auth.uid());

-- ---------- 食事写真用ストレージ ----------

insert into storage.buckets (id, name, public) values ('meals', 'meals', false);

-- パスの1階層目が自分の uid のフォルダにだけ書き込める
create policy "own meals write" on storage.objects
  for insert with check (
    bucket_id = 'meals' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own meals read" on storage.objects
  for select using (
    bucket_id = 'meals'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_counselor())
  );
create policy "own meals delete" on storage.objects
  for delete using (
    bucket_id = 'meals' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================
-- 実行後の手動設定：
-- 1. Authentication → Sign In / Up で Email を有効のままに
--    （テスト中は「Confirm email」をオフにすると確認メールなしで試せます）
-- 2. カウンセラー権限の付与（ゆうき先生のアカウント作成後に実行）：
--    update public.profiles set role = 'counselor'
--    where id = (select id from auth.users where email = 'ゆうき先生のメールアドレス');
-- ============================================================
