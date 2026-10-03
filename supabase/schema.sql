-- ============================================================
-- Clinic Professional Design — esquema de base de datos real
-- Ejecutar completo en: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Perfiles (extiende auth.users con los datos de la app) ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('patient','doctor','admin')),
  nombre text not null default '',
  apellidos text not null default '',
  telefono text,
  email text,
  especialidad text,
  edad int,
  cliente_tipo text,
  can_request_changes boolean not null default false,
  is_active boolean not null default true,
  requested_role text,
  extra_doctor boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Función helper: evita recursión al consultar el propio rol dentro de las políticas.
create or replace function public.current_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Crea el perfil automáticamente cuando alguien se registra (signUp).
-- El rol SIEMPRE nace como 'patient', sin importar qué mande el cliente en
-- raw_user_meta_data — si no, cualquiera podría autoasignarse 'admin' con
-- una llamada directa a supabase.auth.signUp() desde la consola del
-- navegador. El admin asciende a Doctor/Administrador manualmente desde el
-- panel (o un admin ya existente lo hace por SQL).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, nombre, apellidos, telefono, email, especialidad, edad, cliente_tipo, requested_role)
  values (
    new.id,
    'patient',
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellidos', ''),
    new.raw_user_meta_data->>'telefono',
    new.email,
    new.raw_user_meta_data->>'especialidad',
    nullif(new.raw_user_meta_data->>'edad', '')::int,
    new.raw_user_meta_data->>'clienteTipo',
    new.raw_user_meta_data->>'requestedRole'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create policy "read own profile" on public.profiles
  for select using (auth.uid() = id);
-- "doctor" para efectos de reserva no es solo role='doctor' — un admin puede
-- además marcarse extra_doctor = true (Ajustes → "también soy doctor") para
-- atender pacientes sin dejar de ser admin.
create policy "read doctor profiles" on public.profiles
  for select using (role = 'doctor' or extra_doctor = true);
-- Un admin o doctor puede reservar una cita para sí mismo como paciente
-- (patient_id = su propio id, sin importar su rol principal — ver política
-- de bookings más abajo), así que el personal necesita poder leer
-- cualquier perfil, no solo los de role='patient'.
create policy "staff reads any profile" on public.profiles
  for select using (public.current_role() in ('admin','doctor'));
create policy "admin full read" on public.profiles
  for select using (public.current_role() = 'admin');
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "admin updates any profile" on public.profiles
  for update using (public.current_role() = 'admin');

-- ---------- Tratamientos (catálogo del admin) ----------

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  duracion_min int not null,
  precio numeric not null,
  created_at timestamptz not null default now()
);

alter table public.treatments enable row level security;

create policy "authenticated reads treatments" on public.treatments
  for select using (auth.role() = 'authenticated');
create policy "admin manages treatments" on public.treatments
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---------- Citas ----------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id),
  doctor_id uuid not null references public.profiles(id),
  treatment_id uuid references public.treatments(id),
  date date not null,
  start_time text not null,
  end_time text not null,
  status text not null default 'pendiente',
  rated_by_patient boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "patient reads own bookings" on public.bookings
  for select using (patient_id = auth.uid());
create policy "doctor reads own bookings" on public.bookings
  for select using (doctor_id = auth.uid());
create policy "admin reads all bookings" on public.bookings
  for select using (public.current_role() = 'admin');
create policy "patient creates own booking" on public.bookings
  for insert with check (patient_id = auth.uid());
create policy "patient updates own booking" on public.bookings
  for update using (patient_id = auth.uid());
create policy "doctor updates own booking" on public.bookings
  for update using (doctor_id = auth.uid());
create policy "admin updates any booking" on public.bookings
  for update using (public.current_role() = 'admin');

-- ---------- Cuestionario de salud ----------

create table public.intake (
  patient_id uuid primary key references public.profiles(id),
  edad int,
  condiciones text,
  fuma text,
  alergias text,
  medicamentos text,
  updated_at timestamptz not null default now()
);

alter table public.intake enable row level security;

create policy "patient manages own intake" on public.intake
  for all using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy "staff reads intake" on public.intake
  for select using (public.current_role() in ('admin','doctor'));

-- ---------- Calificaciones ----------

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles(id),
  booking_id uuid references public.bookings(id),
  patient_id uuid not null references public.profiles(id),
  stars int not null check (stars between 1 and 5),
  note text,
  anonymous boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ratings enable row level security;

create policy "patient creates own rating" on public.ratings
  for insert with check (patient_id = auth.uid());
create policy "patient reads own ratings" on public.ratings
  for select using (patient_id = auth.uid());
create policy "staff reads ratings" on public.ratings
  for select using (public.current_role() in ('admin','doctor'));

-- ---------- Solicitudes de cambio (doctor pide cancelar/reprogramar) ----------

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id),
  doctor_id uuid not null references public.profiles(id),
  status text not null default 'pendiente',
  created_at timestamptz not null default now()
);

alter table public.change_requests enable row level security;

create policy "doctor creates own change request" on public.change_requests
  for insert with check (doctor_id = auth.uid());
create policy "doctor reads own change requests" on public.change_requests
  for select using (doctor_id = auth.uid());
create policy "admin manages change requests" on public.change_requests
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- ---------- Configuración de la clínica (moneda, cuestionario de salud) ----------

create table public.clinic_settings (
  id int primary key default 1,
  currency text not null default 'USD',
  health_intake_enabled boolean not null default false,
  check (id = 1)
);

insert into public.clinic_settings (id, currency) values (1, 'USD');

alter table public.clinic_settings enable row level security;

create policy "authenticated reads settings" on public.clinic_settings
  for select using (auth.role() = 'authenticated');
create policy "admin updates settings" on public.clinic_settings
  for update using (public.current_role() = 'admin');

-- ---------- Código de activación de administrador ----------
-- A propósito NO tiene ninguna política de select/update para 'authenticated':
-- nadie puede leer esta tabla directo desde el navegador. Solo las funciones
-- de abajo (que corren con privilegios de servidor) la pueden consultar.
-- Cambia 'CAMBIA-ESTE-CODIGO' por un código único, largo y privado antes de
-- dárselo al dueño real de la clínica — a propósito NO es de un solo uso
-- (el dueño puede usarlo más de una vez, ej. para sí mismo y para alguien de
-- confianza), así que cualquiera que lo consiga puede autoascenderse a
-- Administrador en cualquier momento. Trátalo como una contraseña maestra.
create table public.admin_activation (
  id int primary key default 1,
  code text not null,
  used boolean not null default false,
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  check (id = 1)
);

insert into public.admin_activation (id, code) values (1, 'CAMBIA-ESTE-CODIGO');

alter table public.admin_activation enable row level security;

-- Solo valida el código (sin ascender a nadie) — se llama ANTES de crear la
-- cuenta en el formulario de registro, para que un código incorrecto no
-- cree ninguna cuenta. Se permite desde 'anon' porque el registro todavía
-- no tiene sesión en ese punto.
create or replace function public.check_admin_code(input_code text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admin_activation where id = 1 and code = input_code);
$$;

grant execute on function public.check_admin_code(text) to anon, authenticated;

-- Asciende a admin a la cuenta YA autenticada que llama a esta función. No es
-- de un solo uso a propósito (ver comentario de la tabla arriba).
create or replace function public.claim_admin(input_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored record;
begin
  select * into stored from public.admin_activation where id = 1;
  if stored is null or stored.code <> input_code then
    return false;
  end if;
  update public.profiles set role = 'admin' where id = auth.uid();
  update public.admin_activation set used = true, used_by = auth.uid(), used_at = now() where id = 1;
  return true;
end;
$$;

grant execute on function public.claim_admin(text) to authenticated;

-- ---------- Notas internas del admin sobre un doctor o paciente ----------
-- Tabla aparte (no una columna en profiles) para que ni el doctor ni el
-- paciente puedan leer sus propias notas ni con una llamada directa a la
-- API — solo existe una política de acceso, y es para 'admin'.
create table public.admin_notes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.admin_notes enable row level security;

create policy "admin manages notes" on public.admin_notes
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');
