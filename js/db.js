// Capa de acceso a datos — ahora respaldada por Supabase (backend real) en
// vez de localStorage. El resto de la app (app.js) no sabe ni le importa que
// esto sea Supabase: solo llama a estas funciones.
import { supabase } from './supabaseClient.js';

// ---------- Mapeo snake_case (DB) <-> camelCase (app) ----------

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    role: row.role,
    nombre: row.nombre,
    apellidos: row.apellidos,
    telefono: row.telefono,
    email: row.email,
    especialidad: row.especialidad,
    edad: row.edad,
    clienteTipo: row.cliente_tipo,
    canRequestChanges: row.can_request_changes,
    isActive: row.is_active,
    requestedRole: row.requested_role,
    extraDoctor: row.extra_doctor,
    createdAt: row.created_at,
  };
}

function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    treatmentId: row.treatment_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    ratedByPatient: row.rated_by_patient,
  };
}

function mapTreatment(row) {
  if (!row) return null;
  return { id: row.id, nombre: row.nombre, duracionMin: row.duracion_min, precio: row.precio };
}

function mapIntake(row) {
  if (!row) return null;
  return {
    edad: row.edad,
    condiciones: row.condiciones,
    fuma: row.fuma,
    alergias: row.alergias,
    medicamentos: row.medicamentos,
  };
}

function mapChangeRequest(row) {
  if (!row) return null;
  return { id: row.id, bookingId: row.booking_id, doctorId: row.doctor_id, status: row.status };
}

function mapRating(row) {
  if (!row) return null;
  return {
    id: row.id,
    doctorId: row.doctor_id,
    bookingId: row.booking_id,
    patientId: row.patient_id,
    stars: row.stars,
    note: row.note,
    anonymous: row.anonymous,
  };
}

function throwIfError(error) {
  if (error) throw new Error(error.message);
}

// ---------- Autenticación ----------

export async function signUp({ email, password, role, nombre, apellidos, telefono, especialidad, edad, clienteTipo, requestedRole }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { role, nombre, apellidos, telefono, especialidad, edad, clienteTipo, requestedRole } },
  });
  throwIfError(error);
  return data; // data.session es null si falta confirmar el correo
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  throwIfError(error);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  throwIfError(error);
}

// Devuelve true si el código era válido (y ya ascendió a la cuenta actual a
// admin), false si estaba mal o ya se había usado.
export async function claimAdmin(code) {
  const { data, error } = await supabase.rpc('claim_admin', { input_code: code });
  throwIfError(error);
  return !!data;
}

// callback(session | null) — se llama de inmediato con el estado actual y
// luego cada vez que cambia (login, logout, confirmación de correo, etc).
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

// ---------- Perfiles ----------

export async function getUserById(id) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) return null;
  return mapProfile(data);
}

export async function getUsersByRole(role) {
  // Un "doctor" no es solo quien tiene role='doctor' — un admin puede además
  // tener habilitado extra_doctor (ver claim de "también soy doctor" en
  // Ajustes), así que para esta lista en particular hay que incluirlo.
  const query = supabase.from('profiles').select('*');
  const { data, error } = role === 'doctor' ? await query.or('role.eq.doctor,extra_doctor.eq.true') : await query.eq('role', role);
  throwIfError(error);
  return (data || []).map(mapProfile);
}

export async function updateUser(id, patch) {
  const dbPatch = {};
  if (patch.nombre !== undefined) dbPatch.nombre = patch.nombre;
  if (patch.apellidos !== undefined) dbPatch.apellidos = patch.apellidos;
  if (patch.telefono !== undefined) dbPatch.telefono = patch.telefono;
  if (patch.edad !== undefined) dbPatch.edad = patch.edad === '' ? null : Number(patch.edad);
  if (patch.canRequestChanges !== undefined) dbPatch.can_request_changes = patch.canRequestChanges;
  if (patch.role !== undefined) dbPatch.role = patch.role;
  if (patch.especialidad !== undefined) dbPatch.especialidad = patch.especialidad || null;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.requestedRole !== undefined) dbPatch.requested_role = patch.requestedRole;
  if (patch.extraDoctor !== undefined) dbPatch.extra_doctor = patch.extraDoctor;
  const { data, error } = await supabase.from('profiles').update(dbPatch).eq('id', id).select().single();
  throwIfError(error);
  return mapProfile(data);
}

// ---------- Tratamientos ----------

export async function getTreatments() {
  const { data, error } = await supabase.from('treatments').select('*').order('created_at');
  throwIfError(error);
  return (data || []).map(mapTreatment);
}

export async function addTreatment({ nombre, duracionMin, precio }) {
  const { data, error } = await supabase
    .from('treatments')
    .insert({ nombre, duracion_min: Number(duracionMin), precio: Number(precio) })
    .select()
    .single();
  throwIfError(error);
  return mapTreatment(data);
}

// ---------- Citas ----------

export async function getBookings() {
  const { data, error } = await supabase.from('bookings').select('*');
  throwIfError(error);
  return (data || []).map(mapBooking);
}

export async function getBookingsForPatient(patientId) {
  const { data, error } = await supabase.from('bookings').select('*').eq('patient_id', patientId);
  throwIfError(error);
  return (data || []).map(mapBooking);
}

export async function getBookingsForDoctor(doctorId) {
  const { data, error } = await supabase.from('bookings').select('*').eq('doctor_id', doctorId);
  throwIfError(error);
  return (data || []).map(mapBooking);
}

export async function addBooking({ patientId, doctorId, treatmentId, date, startTime, endTime }) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      treatment_id: treatmentId,
      date,
      start_time: startTime,
      end_time: endTime,
      status: 'pendiente',
    })
    .select()
    .single();
  throwIfError(error);
  return mapBooking(data);
}

export async function updateBooking(id, patch) {
  const dbPatch = {};
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.doctorId !== undefined) dbPatch.doctor_id = patch.doctorId;
  if (patch.date !== undefined) dbPatch.date = patch.date;
  if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime;
  if (patch.ratedByPatient !== undefined) dbPatch.rated_by_patient = patch.ratedByPatient;
  const { data, error } = await supabase.from('bookings').update(dbPatch).eq('id', id).select().single();
  throwIfError(error);
  return mapBooking(data);
}

// ---------- Cuestionario de salud (intake) ----------

export async function getIntake(patientId) {
  const { data, error } = await supabase.from('intake').select('*').eq('patient_id', patientId).maybeSingle();
  if (error) return null;
  return mapIntake(data);
}

export async function getAllIntakes() {
  const { data, error } = await supabase.from('intake').select('*');
  throwIfError(error);
  const map = {};
  (data || []).forEach((row) => {
    map[row.patient_id] = mapIntake(row);
  });
  return map;
}

// ---------- Notas internas del admin (invisibles para doctor/paciente) ----------

export async function getAllAdminNotes() {
  const { data, error } = await supabase.from('admin_notes').select('*');
  throwIfError(error);
  const map = {};
  (data || []).forEach((row) => {
    map[row.profile_id] = row.note;
  });
  return map;
}

export async function setAdminNote(profileId, note) {
  const { error } = await supabase.from('admin_notes').upsert({
    profile_id: profileId,
    note,
    updated_at: new Date().toISOString(),
  });
  throwIfError(error);
}

export async function saveIntake(patientId, { edad, condiciones, fuma, alergias, medicamentos }) {
  const { error } = await supabase.from('intake').upsert({
    patient_id: patientId,
    edad: edad === '' || edad == null ? null : Number(edad),
    condiciones,
    fuma,
    alergias,
    medicamentos,
    updated_at: new Date().toISOString(),
  });
  throwIfError(error);
}

// ---------- Calificaciones ----------

export async function getRatingsForDoctor(doctorId) {
  const { data, error } = await supabase.from('ratings').select('*').eq('doctor_id', doctorId);
  throwIfError(error);
  return (data || []).map(mapRating);
}

export async function addRating({ doctorId, bookingId, patientId, stars, note, anonymous }) {
  const { error } = await supabase.from('ratings').insert({
    doctor_id: doctorId,
    booking_id: bookingId,
    patient_id: patientId,
    stars: Number(stars),
    note,
    anonymous: !!anonymous,
  });
  throwIfError(error);
}

// ---------- Solicitudes de cambio ----------

export async function getChangeRequests() {
  const { data, error } = await supabase.from('change_requests').select('*');
  throwIfError(error);
  return (data || []).map(mapChangeRequest);
}

export async function addChangeRequest({ bookingId, doctorId }) {
  const { error } = await supabase.from('change_requests').insert({ booking_id: bookingId, doctor_id: doctorId });
  throwIfError(error);
}

export async function updateChangeRequest(id, patch) {
  const { error } = await supabase.from('change_requests').update(patch).eq('id', id);
  throwIfError(error);
}

// ---------- Moneda de la clínica ----------

export async function getCurrency() {
  const { data } = await supabase.from('clinic_settings').select('currency').eq('id', 1).maybeSingle();
  return data?.currency || 'USD';
}

export async function setCurrency(code) {
  const { error } = await supabase.from('clinic_settings').update({ currency: code }).eq('id', 1);
  throwIfError(error);
}

export async function isHealthIntakeEnabled() {
  const { data } = await supabase.from('clinic_settings').select('health_intake_enabled').eq('id', 1).maybeSingle();
  return !!data?.health_intake_enabled;
}

export async function setHealthIntakeEnabled(enabled) {
  const { error } = await supabase.from('clinic_settings').update({ health_intake_enabled: enabled }).eq('id', 1);
  throwIfError(error);
}
