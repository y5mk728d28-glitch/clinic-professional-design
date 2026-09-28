// Utilidades de agenda: generación de días del mes, franjas horarias y
// verificación de choques de horario entre paciente/doctor.

export const BUSINESS_START = '08:00';
export const BUSINESS_END = '17:00';
export const SLOT_STEP_MIN = 30;
export const DEFAULT_CHECK_DURATION = 30; // usado para pintar el calendario antes de elegir tratamiento
export const BOOKABLE_DAYS_AHEAD = 45;

const ACTIVE_STATUSES = ['pendiente', 'aprobada', 'reasignada'];

export function timeToMinutes(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function dateToKey(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateSlotStarts() {
  const slots = [];
  const start = timeToMinutes(BUSINESS_START);
  const end = timeToMinutes(BUSINESS_END);
  for (let t = start; t + SLOT_STEP_MIN <= end; t += SLOT_STEP_MIN) {
    slots.push(t);
  }
  return slots;
}

function bookingOverlaps(booking, startMin, durationMin) {
  const bStart = timeToMinutes(booking.startTime);
  const bEnd = timeToMinutes(booking.endTime);
  return startMin < bEnd && bStart < startMin + durationMin;
}

export function isSlotFreeForDoctor(bookings, doctorId, dateKey, startMin, durationMin) {
  const dayBookings = bookings.filter(
    (b) => b.doctorId === doctorId && b.date === dateKey && ACTIVE_STATUSES.includes(b.status)
  );
  return !dayBookings.some((b) => bookingOverlaps(b, startMin, durationMin));
}

export function doctorHasFreeSlotOnDay(bookings, doctorId, dateKey, durationMin = DEFAULT_CHECK_DURATION) {
  return generateSlotStarts().some((start) => isSlotFreeForDoctor(bookings, doctorId, dateKey, start, durationMin));
}

// status: 'available' | 'full' | 'unavailable'
export function getDayStatus({ date, doctorIds, bookings, filterDoctorId }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayCopy = new Date(date);
  dayCopy.setHours(0, 0, 0, 0);

  const isPast = dayCopy < today;
  const dow = dayCopy.getDay(); // 0 = domingo
  const isSunday = dow === 0;
  const diffDays = Math.round((dayCopy - today) / 86400000);
  const tooFar = diffDays > BOOKABLE_DAYS_AHEAD;

  if (isPast || isSunday || tooFar || doctorIds.length === 0) {
    return 'unavailable';
  }

  const dateKey = dateToKey(dayCopy);
  const targetDoctors = filterDoctorId ? [filterDoctorId] : doctorIds;
  const anyFree = targetDoctors.some((docId) => doctorHasFreeSlotOnDay(bookings, docId, dateKey));
  return anyFree ? 'available' : 'full';
}

export function getMonthMatrix(year, month) {
  // month: 0-indexado. Devuelve semanas de 7 días (lun-dom) incluyendo relleno de meses vecinos.
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7; // lunes = 0
  const gridStart = new Date(year, month, 1 - startOffset);

  const weeks = [];
  let cursor = new Date(gridStart);
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
