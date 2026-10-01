// Capa de persistencia simulada (localStorage). El día que exista backend real,
// solo esta capa se reemplaza por llamadas fetch/API — el resto de la app no debe cambiar.

const KEYS = {
  users: 'cpd_users',
  session: 'cpd_session',
  treatments: 'cpd_treatments',
  bookings: 'cpd_bookings',
  intake: 'cpd_intake',
  ratings: 'cpd_ratings',
  changeRequests: 'cpd_change_requests',
  currency: 'cpd_currency',
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Users ----------

export function getUsers() {
  return read(KEYS.users, []);
}

export function getUsersByRole(role) {
  return getUsers().filter((u) => u.role === role);
}

export function getUserById(id) {
  return getUsers().find((u) => u.id === id) || null;
}

export function saveUser(user) {
  const users = getUsers();
  const record = { id: uid('user'), createdAt: Date.now(), ...user };
  users.push(record);
  write(KEYS.users, users);
  return record;
}

export function updateUser(id, patch) {
  const users = getUsers().map((u) => (u.id === id ? { ...u, ...patch } : u));
  write(KEYS.users, users);
  return getUserById(id);
}

// ---------- Session ----------

export function getSession() {
  return read(KEYS.session, null);
}

export function setSession(session) {
  write(KEYS.session, session);
}

export function clearSession() {
  localStorage.removeItem(KEYS.session);
}

// ---------- Treatments (catálogo del admin) ----------

export function getTreatments() {
  return read(KEYS.treatments, []);
}

export function addTreatment(treatment) {
  const list = getTreatments();
  const record = { id: uid('tx'), ...treatment };
  list.push(record);
  write(KEYS.treatments, list);
  return record;
}

// ---------- Bookings ----------

export function getBookings() {
  return read(KEYS.bookings, []);
}

export function getBookingsForPatient(patientId) {
  return getBookings().filter((b) => b.patientId === patientId);
}

export function getBookingsForDoctor(doctorId) {
  return getBookings().filter((b) => b.doctorId === doctorId);
}

export function addBooking(booking) {
  const list = getBookings();
  const record = { id: uid('bk'), status: 'pendiente', createdAt: Date.now(), ...booking };
  list.push(record);
  write(KEYS.bookings, list);
  return record;
}

export function updateBooking(id, patch) {
  const list = getBookings().map((b) => (b.id === id ? { ...b, ...patch } : b));
  write(KEYS.bookings, list);
  return getBookings().find((b) => b.id === id);
}

// ---------- Intake (cuestionario de salud del paciente) ----------

export function getIntake(patientId) {
  const all = read(KEYS.intake, {});
  return all[patientId] || null;
}

export function saveIntake(patientId, data) {
  const all = read(KEYS.intake, {});
  all[patientId] = data;
  write(KEYS.intake, all);
}

// ---------- Ratings ----------

export function getRatingsForDoctor(doctorId) {
  return read(KEYS.ratings, []).filter((r) => r.doctorId === doctorId);
}

export function addRating(rating) {
  const list = read(KEYS.ratings, []);
  const record = { id: uid('rt'), createdAt: Date.now(), ...rating };
  list.push(record);
  write(KEYS.ratings, list);
  return record;
}

// ---------- Change requests (doctor pide cancelar/reprogramar) ----------

export function getChangeRequests() {
  return read(KEYS.changeRequests, []);
}

export function addChangeRequest(req) {
  const list = getChangeRequests();
  const record = { id: uid('cr'), status: 'pendiente', createdAt: Date.now(), ...req };
  list.push(record);
  write(KEYS.changeRequests, list);
  return record;
}

export function updateChangeRequest(id, patch) {
  const list = getChangeRequests().map((r) => (r.id === id ? { ...r, ...patch } : r));
  write(KEYS.changeRequests, list);
  return getChangeRequests().find((r) => r.id === id);
}

// ---------- Moneda de la clínica ----------

export function getCurrency() {
  return read(KEYS.currency, 'USD');
}

export function setCurrency(code) {
  write(KEYS.currency, code);
}
