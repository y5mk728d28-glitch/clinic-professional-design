import { t, getLang, setLang, LANGS, getInstallSteps } from './i18n.js';
import { BUSINESS, LOCALE_MAP, CURRENCIES, INSTALL_ICONS } from './config.js';
import * as db from './db.js';
import * as cal from './calendar.js';

// ---------------------------------------------------------------
// Estado transitorio de UI (no persistido) — selecciones en curso,
// pestaña activa, avisos temporales, etc.
// ---------------------------------------------------------------
const S = {
  activeTab: {},
  notice: null,
  booking: {
    filterDoctorId: '',
    selectedDate: null,
    selectedSlot: null,
    treatmentId: '',
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
  },
  adminUI: { reassignOpenFor: null, rescheduleOpenFor: null, expandedDoctorId: null, editingPatientId: null, editingDoctorNotesId: null },
  ratingOpenFor: null,
  install: { os: 'android', step: 0 },
};

// Usuario real autenticado (perfil de la tabla `profiles`), mantenido en
// sincronía por el listener de Supabase Auth. null = no ha iniciado sesión.
let authUser = null;
let authReady = false;

// Fechas en formato largo ("10 de octubre de 2026") para evitar la ambigüedad
// del formato numérico (MM/DD vs DD/MM) entre países.
function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(LOCALE_MAP[getLang()], { day: 'numeric', month: 'long', year: 'numeric' });
}

function goto(route) {
  location.hash = route;
}

function currentRoute() {
  return (location.hash || '#/welcome').slice(1);
}

// ---------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  app.addEventListener('click', onClick);
  app.addEventListener('change', onChange);
  app.addEventListener('submit', onSubmit);
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/welcome';
  startInstallAutoplay();

  db.onAuthChange(async (session) => {
    const profile = session ? await db.getUserById(session.user.id) : null;
    if (profile && profile.isActive === false) {
      await db.signOut();
      authUser = null;
      S.notice = t('login.account_deactivated');
    } else {
      authUser = profile;
    }
    authReady = true;
    render();
  });
});

// Reproduce la guía de instalación sola, como un video en loop,
// mientras el usuario esté en la pantalla de bienvenida.
function startInstallAutoplay() {
  setInterval(() => {
    if (currentRoute() !== '/welcome') return;
    const total = getInstallSteps(S.install.os).length;
    S.install.step = (S.install.step + 1) % total;
    render();
  }, 2800);
}

// ---------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------
async function render() {
  const app = document.getElementById('app');

  if (!authReady) {
    app.innerHTML = `<div class="view"><p class="muted">…</p></div>`;
    return;
  }

  const route = currentRoute();

  // Con sesión activa, las pantallas de bienvenida/login/registro siempre
  // mandan al dashboard — nunca se queda "pegado" en la última pantalla.
  const loggedOutOnlyRoute = route === '/welcome' || route === '/login' || route === '/register';
  if (authUser && loggedOutOnlyRoute) {
    goto('#/dashboard');
    return;
  }

  const notice = S.notice;
  S.notice = null;

  let body;
  if (route === '/welcome') body = viewWelcome();
  else if (route === '/login') body = viewLogin();
  else if (route === '/register') body = viewRegister();
  else if (route === '/intake') body = authUser ? viewIntake() : viewWelcome();
  else if (route === '/dashboard') body = authUser ? await viewDashboard() : viewWelcome();
  else body = viewWelcome();

  if (!authUser && route === '/dashboard') {
    goto('#/welcome');
    return;
  }

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar__brand"><span class="dot"></span> ${BUSINESS.name}</div>
      <div style="display:flex; align-items:center; gap:14px;">
        ${authUser ? `<button class="btn btn-deny btn-sm" data-action="logout">${t('nav.logout')}</button>` : ''}
        <div class="lang-switch">
          ${LANGS.map((l) => `<button data-action="set-lang" data-lang="${l}" class="${l === getLang() ? 'active' : ''}">${l.toUpperCase()}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="view">
      ${notice ? `<div class="notice" style="max-width:920px; width:100%;">${notice}</div>` : ''}
      ${body}
    </div>
    <div class="footer-watermark">@ Vincent</div>
  `;
}

// ---------------------------------------------------------------
// Vistas: onboarding / auth
// ---------------------------------------------------------------
function viewWelcome() {
  return `
    <div class="card">
      <h1>${t('welcome.title')}</h1>
      <p>${t('welcome.subtitle')}</p>
      <div class="btn-row">
        <button class="btn btn-brand btn-block" data-action="goto" data-route="#/register">${t('welcome.btn_create')}</button>
        <button class="btn btn-block" data-action="goto" data-route="#/login">${t('welcome.btn_login')}</button>
      </div>
    </div>
    <div class="card">
      <h2>${t('welcome.install_title')}</h2>
      <p>${t('welcome.install_text')}</p>
      ${installGuide()}
    </div>
  `;
}

function installGuide() {
  const os = S.install.os;
  const steps = getInstallSteps(os);
  const step = Math.min(S.install.step, steps.length - 1);
  const icon = INSTALL_ICONS[os][step];
  // Pasos con el dedo tocando (interacción); en los demás el dedo no aparece.
  const showFinger = [1, 2, 3, 4].includes(step);

  return `
    <div class="install-guide">
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-sm ${os === 'android' ? 'btn-brand' : ''}" data-action="set-install-os" data-os="android">${t('install.os_android')}</button>
        <button class="btn btn-sm ${os === 'ios' ? 'btn-brand' : ''}" data-action="set-install-os" data-os="ios">${t('install.os_ios')}</button>
      </div>
      <div class="install-phone">
        <div class="install-phone-screen">
          <div class="install-phone-icon">${icon}</div>
        </div>
        ${showFinger ? '<div class="install-finger">👆</div>' : ''}
      </div>
      <p class="install-step-text install-step-text--dark">${steps[step]}</p>
      <div class="install-dots">
        ${steps.map((_, i) => `<span class="install-dot ${i === step ? 'active' : ''}"></span>`).join('')}
      </div>
      <div class="btn-row" style="justify-content:space-between; align-items:center;">
        <button class="btn btn-sm" data-action="install-prev" ${step === 0 ? 'disabled' : ''}>${t('install.btn_prev')}</button>
        <span class="muted">${t('install.step_label')} ${step + 1} ${t('install.of')} ${steps.length}</span>
        <button class="btn btn-sm" data-action="install-next" ${step === steps.length - 1 ? 'disabled' : ''}>${t('install.btn_next')}</button>
      </div>
    </div>
  `;
}

// Campo de contraseña con ícono para mostrar/ocultar lo que se escribe
// (SVG en vez de emoji, para que se vea como un control serio).
const EYE_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a21.8 21.8 0 0 1 5.06-5.94M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a21.8 21.8 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function passwordField(name, label, extraAttrs = '') {
  return `
    <label>${label}
      <div class="password-field">
        <input type="password" name="${name}" ${extraAttrs} />
        <button type="button" class="password-toggle" data-action="toggle-password" title="${t('common.toggle_password')}">${EYE_ICON}</button>
      </div>
    </label>
  `;
}

// Teléfono con código de país — bandera + nombre + código, agrupados por
// continente. Se guarda como un solo texto ("+34 612345678"); esto es solo
// la lista del menú, no toca Supabase para nada.
const COUNTRY_GROUPS = [
  {
    continent: 'register.continent_europe',
    countries: [
      { flag: '🇪🇸', name: 'España', code: '+34' },
      { flag: '🇩🇪', name: 'Deutschland', code: '+49' },
      { flag: '🇫🇷', name: 'France', code: '+33' },
      { flag: '🇮🇹', name: 'Italia', code: '+39' },
      { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
      { flag: '🇵🇹', name: 'Portugal', code: '+351' },
      { flag: '🇳🇱', name: 'Nederland', code: '+31' },
      { flag: '🇧🇪', name: 'België', code: '+32' },
      { flag: '🇨🇭', name: 'Schweiz', code: '+41' },
    ],
  },
  {
    continent: 'register.continent_america',
    countries: [
      { flag: '🇺🇸', name: 'United States', code: '+1' },
      { flag: '🇨🇦', name: 'Canada', code: '+1' },
      { flag: '🇲🇽', name: 'México', code: '+52' },
      { flag: '🇩🇴', name: 'República Dominicana', code: '+1' },
      { flag: '🇵🇷', name: 'Puerto Rico', code: '+1' },
      { flag: '🇬🇹', name: 'Guatemala', code: '+502' },
      { flag: '🇨🇷', name: 'Costa Rica', code: '+506' },
      { flag: '🇵🇦', name: 'Panamá', code: '+507' },
      { flag: '🇨🇴', name: 'Colombia', code: '+57' },
      { flag: '🇻🇪', name: 'Venezuela', code: '+58' },
      { flag: '🇪🇨', name: 'Ecuador', code: '+593' },
      { flag: '🇵🇪', name: 'Perú', code: '+51' },
      { flag: '🇨🇱', name: 'Chile', code: '+56' },
      { flag: '🇦🇷', name: 'Argentina', code: '+54' },
      { flag: '🇧🇷', name: 'Brasil', code: '+55' },
    ],
  },
];
const ALL_COUNTRIES = COUNTRY_GROUPS.flatMap((g) => g.countries);

function phoneField(label, value = '') {
  let number = value || '';
  // Ordenado de código más largo a más corto para que "+507" no se confunda
  // con "+5" de otro país al comparar prefijos.
  const sortedByLength = [...ALL_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  const match = sortedByLength.find((c) => number.startsWith(c.code));
  const selected = match || ALL_COUNTRIES.find((c) => c.name === 'United States');
  if (match) number = number.slice(match.code.length).trim();

  return `
    <label>${label}
      <div class="phone-field">
        <select name="telefono_code">
          ${COUNTRY_GROUPS.map(
            (group) => `
            <optgroup label="${t(group.continent)}">
              ${group.countries
                .map((c) => `<option value="${c.code}" ${c === selected ? 'selected' : ''}>${c.flag} ${c.name} (${c.code})</option>`)
                .join('')}
            </optgroup>`
          ).join('')}
        </select>
        <input type="tel" name="telefono_number" value="${number}" required />
      </div>
    </label>
  `;
}

function combinedPhone(data) {
  return `${data.telefono_code} ${data.telefono_number}`.trim();
}

function viewLogin() {
  return `
    <div class="card">
      <h1>${t('login.title')}</h1>
      <form data-form="login">
        <label>${t('login.email_label')}
          <input type="email" name="email" required />
        </label>
        ${passwordField('password', t('login.password_label'), 'required')}
        <div class="btn-row" style="margin-top:8px;">
          <button type="submit" class="btn btn-accept btn-block">${t('login.btn_submit')}</button>
          <button type="button" class="btn btn-block" data-action="goto" data-route="#/welcome">${t('login.btn_back')}</button>
        </div>
      </form>
      <button class="link-btn" data-action="goto" data-route="#/register">${t('login.no_account')}</button>
      <button class="link-btn" data-action="forgot-password">${t('login.forgot_password')}</button>
    </div>
  `;
}

// El registro público solo crea cuentas de Paciente — es la única forma
// segura de autoregistro sin backend propio (ver README, "Modelo de
// seguridad"). Para que alguien tenga acceso de Doctor, un admin lo asciende
// después desde Panel de Admin → Pacientes, una vez ya tiene su cuenta.
function viewRegister() {
  return `
    <div class="card">
      <h1>${t('register.title')}</h1>
      <form data-form="register">
        <div class="field-row">
          <label>${t('register.firstname')}
            <input type="text" name="nombre" required />
          </label>
          <label>${t('register.lastname')}
            <input type="text" name="apellidos" required />
          </label>
        </div>
        <div class="field-row">
          ${phoneField(t('register.phone'))}
          <label>${t('register.email')}
            <input type="email" name="email" required />
          </label>
        </div>
        <div class="field-row">
          <label>${t('register.age')}
            <input type="number" name="edad" min="0" max="120" required />
          </label>
          <label>${t('register.client_type')}
            <select name="clienteTipo">
              <option value="nuevo">${t('register.client_new')}</option>
              <option value="antiguo">${t('register.client_returning')}</option>
            </select>
          </label>
        </div>
        <label>${t('register.specialty')} <span class="muted">(${t('register.specialty_hint')})</span>
          <input type="text" name="especialidad" />
        </label>
        ${passwordField('password', t('register.password'), 'required minlength="6"')}
        <div class="btn-row" style="margin-top:8px;">
          <button type="submit" class="btn btn-accept btn-block">${t('register.btn_submit')}</button>
          <button type="button" class="btn btn-deny btn-block" data-action="goto" data-route="#/welcome">${t('register.btn_cancel')}</button>
        </div>
      </form>
      <button class="link-btn" data-action="goto" data-route="#/login">${t('register.have_account')}</button>
    </div>
  `;
}

function viewIntake() {
  const user = authUser;
  return `
    <div class="card">
      <h1>${t('intake.title')}</h1>
      <p>${t('intake.subtitle')}</p>
      <form data-form="intake">
        <label>${t('intake.age')}
          <input type="number" name="edad" min="0" max="120" value="${user?.edad ?? ''}" required />
        </label>
        <label>${t('intake.conditions')}
          <textarea name="condiciones" rows="2" placeholder="${t('intake.conditions_ph')}"></textarea>
        </label>
        <label>${t('intake.smoker')}
          <select name="fuma">
            <option value="no">${t('intake.smoker_no')}</option>
            <option value="si">${t('intake.smoker_yes')}</option>
          </select>
        </label>
        <label>${t('intake.allergies')}
          <textarea name="alergias" rows="2" placeholder="${t('intake.allergies_ph')}"></textarea>
        </label>
        <label>${t('intake.medications')}
          <textarea name="medicamentos" rows="2" placeholder="${t('intake.medications_ph')}"></textarea>
        </label>
        <button type="submit" class="btn btn-accept btn-block">${t('intake.btn_save')}</button>
      </form>
    </div>
  `;
}

// ---------------------------------------------------------------
// Dashboard router por rol
// ---------------------------------------------------------------
async function viewDashboard() {
  const user = authUser;
  if (user.role === 'patient') {
    const intake = await db.getIntake(user.id);
    if (!intake) {
      goto('#/intake');
      return '';
    }
    return dashboardPatient(user);
  }
  if (user.role === 'doctor') return dashboardDoctor(user);
  return dashboardAdmin(user);
}

function tabsBar(role, tabs) {
  const active = S.activeTab[role] || tabs[0].key;
  S.activeTab[role] = active;
  return `
    <div class="tabs">
      ${tabs
        .map(
          (tb) => `<button class="tab-btn ${tb.key === active ? 'active' : ''}" data-action="set-tab" data-role="${role}" data-tab="${tb.key}">${tb.label}</button>`
        )
        .join('')}
    </div>
  `;
}

// ---------------------------------------------------------------
// PACIENTE
// ---------------------------------------------------------------
async function dashboardPatient(user) {
  const tabs = [
    { key: 'booking', label: t('patient.tab_booking') },
    { key: 'appointments', label: t('patient.tab_appointments') },
    { key: 'settings', label: t('patient.tab_settings') },
  ];
  const active = S.activeTab.patient || 'booking';
  let content = '';
  if (active === 'booking') content = await patientBookingTab(user);
  else if (active === 'appointments') content = await patientAppointmentsTab(user);
  else content = settingsTab(user);

  return `
    <div class="card card--wide">
      ${tabsBar('patient', tabs)}
      ${content}
    </div>
  `;
}

async function patientBookingTab(user) {
  const [allDoctors, bookings, currency] = await Promise.all([db.getUsersByRole('doctor'), db.getBookings(), db.getCurrency()]);
  const doctors = allDoctors.filter((d) => d.isActive !== false);
  const filterId = S.booking.filterDoctorId;
  const viewYear = S.booking.viewYear;
  const viewMonth = S.booking.viewMonth;
  const weeks = cal.getMonthMatrix(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(LOCALE_MAP[getLang()], { month: 'long', year: 'numeric' });
  const weekdayLabels = weeks[1].map((d) => d.toLocaleDateString(LOCALE_MAP[getLang()], { weekday: 'short' }));

  const doctorIds = doctors.map((d) => d.id);

  const dayCells = weeks
    .flat()
    .map((date) => {
      const inMonth = date.getMonth() === viewMonth;
      const status = cal.getDayStatus({ date, doctorIds, bookings, filterDoctorId: filterId || null, patientId: user.id });
      const dateKey = cal.dateToKey(date);
      const selected = S.booking.selectedDate === dateKey ? 'selected' : '';
      const clickable = status === 'available' && inMonth;
      return `<div class="calendar-day ${inMonth ? status : 'unavailable'} ${selected}"
                ${clickable ? `data-action="pick-day" data-date="${dateKey}"` : ''}
                style="${inMonth ? '' : 'opacity:0.25;'}">${date.getDate()}</div>`;
    })
    .join('');

  let slotsBlock = '';
  if (S.booking.selectedDate) {
    const candidateDoctors = filterId ? [filterId] : doctorIds;
    const slots = cal.generateSlotStarts();
    const slotButtons = slots
      .map((start) => {
        const free = candidateDoctors.some((docId) => cal.isSlotFreeForDoctor(bookings, docId, S.booking.selectedDate, start, cal.DEFAULT_CHECK_DURATION));
        const selected = S.booking.selectedSlot === start ? 'selected' : '';
        return `<button type="button" class="slot-btn ${selected}" ${free ? '' : 'disabled'} data-action="pick-slot" data-slot="${start}">${cal.minutesToTime(start)}</button>`;
      })
      .join('');
    slotsBlock = `
      <h3>${t('booking.choose_time')}</h3>
      <div class="slot-grid">${slotButtons}</div>
    `;
  }

  let treatmentBlock = '';
  if (S.booking.selectedDate && S.booking.selectedSlot != null) {
    const treatments = await db.getTreatments();
    treatmentBlock = `
      <label>${t('booking.choose_service')}
        <select data-onchange="select-treatment">
          <option value="">--</option>
          ${treatments.map((tx) => `<option value="${tx.id}" ${S.booking.treatmentId === tx.id ? 'selected' : ''}>${tx.nombre}</option>`).join('')}
        </select>
      </label>
    `;

    if (S.booking.treatmentId) {
      const tx = treatments.find((x) => x.id === S.booking.treatmentId);
      if (tx) {
        const candidateDoctors = filterId ? [filterId] : doctorIds;
        const fits = candidateDoctors.some((docId) =>
          cal.isSlotFreeForDoctor(bookings, docId, S.booking.selectedDate, S.booking.selectedSlot, Number(tx.duracionMin))
        );
        const symbol = (CURRENCIES[currency] && CURRENCIES[currency].symbol) || '$';
        treatmentBlock += `
          <p><strong>${t('booking.estimated_duration')}:</strong> ${tx.duracionMin} ${t('booking.minutes')} · <strong>${t('booking.estimated_price')}:</strong> ${symbol}${tx.precio}</p>
          ${fits
            ? `<button class="btn btn-accept btn-block" data-action="confirm-booking">${t('booking.btn_confirm')}</button>`
            : `<p class="notice">${t('booking.no_slot_selected')}</p>`}
        `;
      }
    }
  }

  return `
    <label style="max-width:280px;">${t('booking.doctor_filter_label')}
      <select data-onchange="filter-doctor">
        <option value="">${t('booking.doctor_any')}</option>
        ${doctors.map((d) => `<option value="${d.id}" ${filterId === d.id ? 'selected' : ''}>${d.nombre} ${d.apellidos}</option>`).join('')}
      </select>
    </label>

    <div class="btn-row" style="justify-content:space-between; align-items:center; width:100%;">
      <button class="btn btn-sm" data-action="month-prev">‹</button>
      <h2 style="text-transform:capitalize;">${monthLabel}</h2>
      <button class="btn btn-sm" data-action="month-next">›</button>
    </div>
    <div class="calendar-grid">
      ${weekdayLabels.map((w) => `<div class="muted" style="text-align:center; text-transform:capitalize;">${w}</div>`).join('')}
      ${dayCells}
    </div>
    <div class="legend">
      <span><span class="legend-swatch" style="background:var(--sapphire-500)"></span>${t('booking.legend_available')}</span>
      <span><span class="legend-swatch" style="background:var(--red-500)"></span>${t('booking.legend_full')}</span>
      <span><span class="legend-swatch" style="background:var(--white); border:1px solid var(--gray-400);"></span>${t('booking.legend_unavailable')}</span>
      <span><span class="legend-swatch" style="background:var(--emerald-600)"></span>${t('booking.legend_attended')}</span>
    </div>

    ${slotsBlock}
    ${treatmentBlock}
  `;
}

async function patientAppointmentsTab(user) {
  const [bookingsRaw, treatments, doctors] = await Promise.all([
    db.getBookingsForPatient(user.id),
    db.getTreatments(),
    db.getUsersByRole('doctor'),
  ]);
  const bookings = bookingsRaw.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  if (bookings.length === 0) return `<p class="muted">${t('appointments.empty')}</p>`;

  return bookings
    .map((b) => {
      const doctor = doctors.find((d) => d.id === b.doctorId);
      const tx = treatments.find((x) => x.id === b.treatmentId);
      const badgeClass = { pendiente: 'badge-pending', reasignada: 'badge-pending', aprobada: 'badge-approved', rechazada: 'badge-denied', cancelada: 'badge-denied', completada: 'badge-done' }[b.status];

      let ratingBlock = '';
      if (b.status === 'completada' && !b.ratedByPatient) {
        if (S.ratingOpenFor === b.id) {
          ratingBlock = `
            <form data-form="rate" data-booking="${b.id}" data-doctor="${b.doctorId}" style="margin-top:8px;">
              <label>${t('patients.ratings')}
                <select name="stars">
                  ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</option>`).join('')}
                </select>
              </label>
              <label><input type="checkbox" name="anonymous" style="width:auto;" /> ${t('appointments.anonymous')}</label>
              <textarea name="note" rows="2" placeholder="${t('appointments.note_ph')}"></textarea>
              <button type="submit" class="btn btn-accept btn-sm">${t('appointments.btn_rate')}</button>
            </form>`;
        } else {
          ratingBlock = `<button class="btn btn-sm" data-action="open-rating" data-booking="${b.id}">${t('appointments.rate_doctor')}</button>`;
        }
      } else if (b.ratedByPatient) {
        ratingBlock = `<p class="muted">${t('appointments.rating_saved')}</p>`;
      }

      return `
        <div class="card" style="max-width:none;">
          <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <strong>${formatDate(b.date)} · ${b.startTime}–${b.endTime}</strong>
            <span class="badge ${badgeClass}">${t('appointments.status_' + b.status)}</span>
          </div>
          <p>${tx ? tx.nombre : ''} — Dr(a). ${doctor ? doctor.nombre + ' ' + doctor.apellidos : '—'}</p>
          ${ratingBlock}
        </div>
      `;
    })
    .join('');
}

// ---------------------------------------------------------------
// DOCTOR
// ---------------------------------------------------------------
async function dashboardDoctor(user) {
  const tabs = [
    { key: 'agenda', label: t('doctor.tab_agenda') },
    { key: 'patients', label: t('doctor.tab_patients') },
    { key: 'settings', label: t('doctor.tab_settings') },
  ];
  const active = S.activeTab.doctor || 'agenda';
  let content = '';
  if (active === 'agenda') content = await doctorAgendaTab(user);
  else if (active === 'patients') content = await doctorPatientsTab(user);
  else content = settingsTab(user);

  return `
    <div class="card card--wide">
      ${tabsBar('doctor', tabs)}
      ${content}
    </div>
  `;
}

async function doctorAgendaTab(user) {
  const [bookingsRaw, treatments, openRequests, patients] = await Promise.all([
    db.getBookingsForDoctor(user.id),
    db.getTreatments(),
    db.getChangeRequests(),
    db.getUsersByRole('patient'),
  ]);
  const bookings = bookingsRaw.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  if (bookings.length === 0) return `<p class="muted">${t('agenda.empty')}</p>`;

  return `
    <h2>${t('agenda.title')}</h2>
    <table>
      <thead><tr><th>${t('booking.title')}</th><th>${t('treatments.name')}</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${bookings
          .map((b) => {
            const patient = patients.find((p) => p.id === b.patientId);
            const tx = treatments.find((x) => x.id === b.treatmentId);
            const badgeClass = { pendiente: 'badge-pending', reasignada: 'badge-pending', aprobada: 'badge-approved', rechazada: 'badge-denied', cancelada: 'badge-denied', completada: 'badge-done' }[b.status];
            const hasOpenRequest = openRequests.some((r) => r.bookingId === b.id && r.status === 'pendiente');
            let actions = '';
            if (b.status === 'aprobada') {
              actions += `<button class="btn btn-accept btn-sm" data-action="mark-attended" data-booking="${b.id}">✓</button> `;
            }
            if (['pendiente', 'aprobada'].includes(b.status)) {
              if (hasOpenRequest) {
                actions += `<span class="muted">${t('agenda.request_sent')}</span>`;
              } else if (user.canRequestChanges) {
                actions += `<button class="btn btn-deny btn-sm" data-action="request-change" data-booking="${b.id}">${t('agenda.btn_request_change')}</button>`;
              } else {
                actions += `<span class="muted">${t('agenda.permission_required')}</span>`;
              }
            }
            return `<tr>
              <td>${formatDate(b.date)} ${b.startTime}–${b.endTime}<br/><span class="muted">${patient ? patient.nombre + ' ' + patient.apellidos : ''}</span></td>
              <td>${tx ? tx.nombre : ''}</td>
              <td><span class="badge ${badgeClass}">${t('appointments.status_' + b.status)}</span></td>
              <td>${actions}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

async function doctorPatientsTab(user) {
  const [bookings, ratings, patients] = await Promise.all([
    db.getBookingsForDoctor(user.id),
    db.getRatingsForDoctor(user.id),
    db.getUsersByRole('patient'),
  ]);
  const patientIds = [...new Set(bookings.map((b) => b.patientId))];
  const avg = ratings.length ? (ratings.reduce((s, r) => s + Number(r.stars), 0) / ratings.length).toFixed(1) : null;

  const ratingsSummary = `<p><strong>${t('patients.ratings')}:</strong> ${avg ? `${avg} / 5 (${ratings.length})` : '—'}</p>`;

  if (patientIds.length === 0) return `${ratingsSummary}<p class="muted">${t('patients.empty')}</p>`;

  const rows = patientIds
    .map((pid) => {
      const p = patients.find((x) => x.id === pid);
      if (!p) return '';
      return `<tr><td>${p.nombre} ${p.apellidos}</td><td>${p.edad ?? '—'}</td><td>${p.telefono}</td><td>${p.email}</td></tr>`;
    })
    .join('');

  const notesRows = ratings
    .map((r) => {
      const patient = patients.find((x) => x.id === r.patientId);
      const who = r.anonymous ? '—' : patient ? patient.nombre : '—';
      return `<tr><td>${'★'.repeat(Number(r.stars))}</td><td>${who}</td><td>${r.note || ''}</td></tr>`;
    })
    .join('');

  return `
    ${ratingsSummary}
    <h2>${t('patients.title')}</h2>
    <table>
      <thead><tr><th>${t('settings.name')}</th><th>${t('settings.age')}</th><th>${t('settings.phone')}</th><th>${t('settings.email')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${ratings.length ? `<table style="margin-top:14px;"><thead><tr><th>${t('patients.ratings')}</th><th>Paciente</th><th>Nota</th></tr></thead><tbody>${notesRows}</tbody></table>` : ''}
  `;
}

// ---------------------------------------------------------------
// ADMIN
// ---------------------------------------------------------------
async function dashboardAdmin(user) {
  const tabs = [
    { key: 'treatments', label: t('admin.tab_treatments') },
    { key: 'doctors', label: t('admin.tab_doctors') },
    { key: 'requests', label: t('admin.tab_requests') },
    { key: 'patients', label: t('admin.tab_patients') },
    { key: 'settings', label: t('admin.tab_settings') },
  ];
  const active = S.activeTab.admin || 'treatments';
  let content = '';
  if (active === 'treatments') content = await adminTreatmentsTab();
  else if (active === 'doctors') content = await adminDoctorsTab();
  else if (active === 'requests') content = await adminRequestsTab();
  else if (active === 'patients') content = await adminPatientsTab();
  else content = settingsTab(user);

  return `
    <div class="card card--wide">
      ${tabsBar('admin', tabs)}
      ${content}
    </div>
  `;
}

async function adminTreatmentsTab() {
  const [treatments, currentCurrency] = await Promise.all([db.getTreatments(), db.getCurrency()]);
  return `
    <h2>${t('treatments.title')}</h2>
    <label style="max-width:220px;">${t('treatments.currency')}
      <select data-onchange="set-currency">
        ${Object.entries(CURRENCIES)
          .map(([code, c]) => `<option value="${code}" ${currentCurrency === code ? 'selected' : ''}>${c.label}</option>`)
          .join('')}
      </select>
    </label>
    <form data-form="add-treatment" class="field-row" style="align-items:flex-end;">
      <label>${t('treatments.name')}<input type="text" name="nombre" required /></label>
      <label>${t('treatments.duration')}<input type="number" name="duracionMin" min="5" step="5" required /></label>
      <label>${t('treatments.price')}<input type="number" name="precio" min="0" step="1" required /></label>
      <button type="submit" class="btn btn-accept">${t('treatments.btn_add')}</button>
    </form>
    ${
      treatments.length === 0
        ? `<p class="muted">${t('treatments.list_empty')}</p>`
        : `<table>
            <thead><tr><th>${t('treatments.name')}</th><th>${t('treatments.duration')}</th><th>${t('treatments.price')}</th></tr></thead>
            <tbody>${treatments
              .map((tx) => {
                const symbol = (CURRENCIES[currentCurrency] && CURRENCIES[currentCurrency].symbol) || '$';
                return `<tr><td>${tx.nombre}</td><td>${tx.duracionMin} ${t('booking.minutes')}</td><td>${symbol}${tx.precio}</td></tr>`;
              })
              .join('')}</tbody>
          </table>`
    }
  `;
}

async function adminDoctorsTab() {
  const [doctors, treatments, patients, allBookings, notesMap] = await Promise.all([
    db.getUsersByRole('doctor'),
    db.getTreatments(),
    db.getUsersByRole('patient'),
    db.getBookings(),
    db.getAllAdminNotes(),
  ]);
  if (doctors.length === 0) return `<p class="muted">${t('doctors.list_empty')}</p>`;
  const slots = cal.generateSlotStarts();
  const ctx = { doctors, patients, treatments, slots };

  return `
    <h2>${t('doctors.title')}</h2>
    <table>
      <thead><tr><th>${t('settings.name')}</th><th>${t('register.specialty')}</th><th>${t('settings.phone')}</th><th>${t('settings.email')}</th><th>${t('doctors.allow_changes')}</th><th></th><th></th><th></th></tr></thead>
      <tbody>
        ${doctors
          .map((d) => {
            const expanded = S.adminUI.expandedDoctorId === d.id;
            const editingNotes = S.adminUI.editingDoctorNotesId === d.id;
            const active = d.isActive !== false;
            let agendaBlock = '';
            if (expanded) {
              const bookings = allBookings
                .filter((b) => b.doctorId === d.id && ['pendiente', 'reasignada', 'aprobada'].includes(b.status))
                .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
              agendaBlock = bookings.length
                ? `<table>
                    <thead><tr><th>Paciente</th><th>Doctor</th><th>${t('treatments.name')}</th><th>${t('booking.title')}</th><th>Status</th><th></th></tr></thead>
                    <tbody>${bookings.map((b) => renderBookingRow(b, ctx)).join('')}</tbody>
                  </table>`
                : `<p class="muted">${t('agenda.empty')}</p>`;
            }
            const notesBlock = editingNotes
              ? `<tr><td colspan="8">
                  <form data-form="edit-doctor-notes" data-doctor="${d.id}" class="field-row" style="align-items:flex-end;">
                    <label style="flex-basis:100%;">${t('adminusers.notes_label')}
                      <textarea name="adminNote" rows="2" placeholder="${t('adminusers.notes_placeholder')}">${notesMap[d.id] || ''}</textarea>
                    </label>
                    <button type="submit" class="btn btn-accept btn-sm">${t('common.save')}</button>
                    <button type="button" class="btn btn-sm" data-action="toggle-doctor-notes" data-doctor="${d.id}">${t('common.cancel')}</button>
                  </form>
                </td></tr>`
              : '';
            return `
              <tr ${active ? '' : 'style="opacity:0.55;"'}>
                <td>${d.nombre} ${d.apellidos} ${active ? '' : `<span class="badge badge-denied">${t('adminusers.badge_deactivated')}</span>`}</td>
                <td>${d.especialidad || ''}</td><td>${d.telefono}</td><td>${d.email}</td>
                <td><input type="checkbox" data-onchange="toggle-doctor-permission" data-doctor="${d.id}" style="width:auto;" ${d.canRequestChanges ? 'checked' : ''} /></td>
                <td><button class="btn btn-sm" data-action="toggle-doctor-agenda" data-doctor="${d.id}">${t('doctors.view_agenda')}</button></td>
                <td><button class="btn btn-sm" data-action="toggle-doctor-notes" data-doctor="${d.id}">${t('adminusers.btn_notes')}</button></td>
                <td><button class="btn btn-deny btn-sm" data-action="toggle-active-user" data-user="${d.id}" data-active="${active}">${active ? t('adminusers.btn_deactivate') : t('adminusers.btn_reactivate')}</button></td>
              </tr>
              ${expanded ? `<tr><td colspan="8">${agendaBlock}</td></tr>` : ''}
              ${notesBlock}
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

// Fila reutilizable de una cita, con sus acciones según el estado —
// usada tanto en la cola de solicitudes como en la agenda expandida de un doctor.
// (Totalmente sincrónica: doctors/patients/treatments ya vienen pre-cargados en ctx.)
function renderBookingRow(b, { doctors, patients, treatments, slots }) {
  const patient = patients.find((p) => p.id === b.patientId);
  const doctor = doctors.find((d) => d.id === b.doctorId);
  const tx = treatments.find((x) => x.id === b.treatmentId);
  const badgeClass = { pendiente: 'badge-pending', reasignada: 'badge-pending', aprobada: 'badge-approved', rechazada: 'badge-denied', cancelada: 'badge-denied', completada: 'badge-done' }[b.status];
  const reassignOpen = S.adminUI.reassignOpenFor === b.id;
  const rescheduleOpen = S.adminUI.rescheduleOpenFor === b.id;

  let actions = '';
  if (['pendiente', 'reasignada'].includes(b.status)) {
    actions += `<button class="btn btn-accept btn-sm" data-action="approve-booking" data-booking="${b.id}">${t('requests.btn_approve')}</button>`;
    actions += `<button class="btn btn-deny btn-sm" data-action="deny-booking" data-booking="${b.id}">${t('requests.btn_deny')}</button>`;
  }
  if (b.status === 'aprobada') {
    actions += `<button class="btn btn-deny btn-sm" data-action="cancel-booking" data-booking="${b.id}">${t('requests.btn_cancel')}</button>`;
  }
  if (['pendiente', 'reasignada', 'aprobada'].includes(b.status)) {
    actions += `<button class="btn btn-sm" data-action="toggle-reassign" data-booking="${b.id}">${t('requests.btn_reassign')}</button>`;
    actions += `<button class="btn btn-sm" data-action="toggle-reschedule" data-booking="${b.id}">${t('requests.btn_reschedule')}</button>`;
  }

  const mainRow = `
    <tr>
      <td>${patient ? patient.nombre + ' ' + patient.apellidos : ''}</td>
      <td>${doctor ? doctor.nombre + ' ' + doctor.apellidos : '—'}</td>
      <td>${tx ? tx.nombre : ''}</td>
      <td>${formatDate(b.date)} ${b.startTime}–${b.endTime}</td>
      <td><span class="badge ${badgeClass}">${t('appointments.status_' + b.status)}</span></td>
      <td class="btn-row">${actions}</td>
    </tr>`;

  const reassignRow = reassignOpen
    ? `<tr><td colspan="6">
        <div class="btn-row" style="align-items:center;">
          <select data-select="reassign-doctor" data-booking="${b.id}">
            ${doctors.map((d) => `<option value="${d.id}" ${d.id === b.doctorId ? 'selected' : ''}>${d.nombre} ${d.apellidos}</option>`).join('')}
          </select>
          <button class="btn btn-accept btn-sm" data-action="confirm-reassign" data-booking="${b.id}">${t('common.save')}</button>
        </div>
      </td></tr>`
    : '';

  const rescheduleRow = rescheduleOpen
    ? `<tr><td colspan="6">
        <div class="btn-row" style="align-items:center;">
          <input type="date" data-select="reschedule-date" data-booking="${b.id}" value="${b.date}" />
          <select data-select="reschedule-time" data-booking="${b.id}">
            ${slots.map((s) => `<option value="${s}" ${cal.minutesToTime(s) === b.startTime ? 'selected' : ''}>${cal.minutesToTime(s)}</option>`).join('')}
          </select>
          <button class="btn btn-accept btn-sm" data-action="confirm-reschedule" data-booking="${b.id}">${t('common.save')}</button>
        </div>
      </td></tr>`
    : '';

  return mainRow + reassignRow + rescheduleRow;
}

async function adminRequestsTab() {
  const [allBookings, doctors, patients, treatments, changeRequestsRaw] = await Promise.all([
    db.getBookings(),
    db.getUsersByRole('doctor'),
    db.getUsersByRole('patient'),
    db.getTreatments(),
    db.getChangeRequests(),
  ]);
  const slots = cal.generateSlotStarts();
  const ctx = { doctors, patients, treatments, slots };
  const activeBookings = allBookings.filter((b) => ['pendiente', 'reasignada', 'aprobada'].includes(b.status));

  const pendingRows = activeBookings.length
    ? activeBookings.map((b) => renderBookingRow(b, ctx)).join('')
    : `<tr><td colspan="6" class="muted">${t('requests.empty')}</td></tr>`;

  const changeRequests = changeRequestsRaw.filter((r) => r.status === 'pendiente');
  const changeRows = changeRequests.length
    ? changeRequests
        .map((r) => {
          const booking = allBookings.find((b) => b.id === r.bookingId);
          const doctor = doctors.find((d) => d.id === r.doctorId);
          return `<tr>
            <td>${doctor ? doctor.nombre + ' ' + doctor.apellidos : ''}</td>
            <td>${booking ? formatDate(booking.date) + ' ' + booking.startTime : '—'}</td>
            <td class="btn-row">
              <button class="btn btn-accept btn-sm" data-action="approve-change" data-request="${r.id}">${t('requests.btn_approve')}</button>
              <button class="btn btn-deny btn-sm" data-action="deny-change" data-request="${r.id}">${t('requests.btn_deny')}</button>
            </td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="3" class="muted">${t('requests.empty')}</td></tr>`;

  // Personas que se registraron pidiendo acceso de Doctor (llenaron
  // "Especialidad" al crear su cuenta) — siguen siendo "patient" hasta que
  // el admin las aprueba aquí.
  const doctorRequests = patients.filter((p) => p.requestedRole === 'doctor');
  const doctorRequestRows = doctorRequests.length
    ? doctorRequests
        .map(
          (p) => `<tr>
            <td>${p.nombre} ${p.apellidos}</td>
            <td>${p.especialidad || '—'}</td>
            <td>${p.email}</td>
            <td class="btn-row">
              <button class="btn btn-accept btn-sm" data-action="approve-doctor-request" data-user="${p.id}">${t('requests.btn_approve')}</button>
              <button class="btn btn-deny btn-sm" data-action="deny-doctor-request" data-user="${p.id}">${t('requests.btn_deny')}</button>
            </td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" class="muted">${t('requests.empty')}</td></tr>`;

  return `
    <h2>${t('requests.doctor_requests_title')}</h2>
    <table>
      <thead><tr><th>${t('settings.name')}</th><th>${t('register.specialty')}</th><th>${t('settings.email')}</th><th></th></tr></thead>
      <tbody>${doctorRequestRows}</tbody>
    </table>

    <h2 style="margin-top:20px;">${t('requests.title')}</h2>
    <table>
      <thead><tr><th>Paciente</th><th>Doctor</th><th>${t('treatments.name')}</th><th>${t('booking.title')}</th><th>Status</th><th></th></tr></thead>
      <tbody>${pendingRows}</tbody>
    </table>
    <h2 style="margin-top:20px;">${t('requests.change_requests_title')}</h2>
    <table>
      <thead><tr><th>Doctor</th><th>${t('booking.title')}</th><th></th></tr></thead>
      <tbody>${changeRows}</tbody>
    </table>
  `;
}

async function adminPatientsTab() {
  const [patients, intakeMap, notesMap] = await Promise.all([
    db.getUsersByRole('patient'),
    db.getAllIntakes(),
    db.getAllAdminNotes(),
  ]);
  if (patients.length === 0) return `<p class="muted">${t('adminpatients.empty')}</p>`;
  return `
    <h2>${t('adminpatients.title')}</h2>
    <table>
      <thead><tr><th>${t('settings.name')}</th><th>${t('settings.age')}</th><th>${t('settings.phone')}</th><th>${t('settings.email')}</th><th>${t('intake.smoker')}</th><th>${t('intake.conditions')}</th><th></th><th></th></tr></thead>
      <tbody>
        ${patients
          .map((p) => {
            const intake = intakeMap[p.id];
            const editing = S.adminUI.editingPatientId === p.id;
            const active = p.isActive !== false;
            const row = `<tr ${active ? '' : 'style="opacity:0.55;"'}>
              <td>${p.nombre} ${p.apellidos} ${active ? '' : `<span class="badge badge-denied">${t('adminusers.badge_deactivated')}</span>`}</td>
              <td>${p.edad ?? '—'}</td><td>${p.telefono}</td><td>${p.email}</td>
              <td>${intake ? (intake.fuma === 'si' ? t('intake.smoker_yes') : t('intake.smoker_no')) : '—'}</td>
              <td>${intake?.condiciones || '—'}</td>
              <td><button class="btn btn-sm" data-action="toggle-edit-patient" data-patient="${p.id}">${t('adminpatients.btn_edit')}</button></td>
              <td><button class="btn btn-deny btn-sm" data-action="toggle-active-user" data-user="${p.id}" data-active="${active}">${active ? t('adminusers.btn_deactivate') : t('adminusers.btn_reactivate')}</button></td>
            </tr>`;
            const editRow = editing
              ? `<tr><td colspan="8">
                  <form data-form="edit-patient" data-patient="${p.id}" class="field-row" style="align-items:flex-end;">
                    <label>${t('register.firstname')}<input type="text" name="nombre" value="${p.nombre}" required /></label>
                    <label>${t('register.lastname')}<input type="text" name="apellidos" value="${p.apellidos}" required /></label>
                    <label>${t('settings.age')}<input type="number" name="edad" value="${p.edad ?? ''}" /></label>
                    ${phoneField(t('settings.phone'), p.telefono)}
                    <label>${t('adminpatients.role_label')}
                      <select name="role">
                        <option value="patient">${t('role.patient')}</option>
                        <option value="doctor">${t('role.doctor')}</option>
                      </select>
                    </label>
                    <label>${t('register.specialty')}<input type="text" name="especialidad" value="${p.especialidad || ''}" placeholder="${t('adminpatients.specialty_if_doctor')}" /></label>
                    <label style="flex-basis:100%;">${t('adminusers.notes_label')}
                      <textarea name="adminNote" rows="2" placeholder="${t('adminusers.notes_placeholder')}">${notesMap[p.id] || ''}</textarea>
                    </label>
                    <button type="submit" class="btn btn-accept btn-sm">${t('common.save')}</button>
                    <button type="button" class="btn btn-sm" data-action="toggle-edit-patient" data-patient="${p.id}">${t('common.cancel')}</button>
                  </form>
                </td></tr>`
              : '';
            return row + editRow;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

// ---------------------------------------------------------------
// Ajustes (compartido por los 3 roles)
// ---------------------------------------------------------------
function settingsTab(user) {
  return `
    <h2>${t('settings.title')}</h2>
    <form data-form="settings">
      <div class="field-row">
        <label>${t('settings.name')}<input type="text" name="nombre" value="${user.nombre} ${user.apellidos}" /></label>
        <label>${t('settings.age')}<input type="number" name="edad" value="${user.edad ?? ''}" /></label>
      </div>
      <div class="field-row">
        <label>${t('settings.email')}<input type="email" value="${user.email}" disabled /></label>
        ${phoneField(t('settings.phone'), user.telefono)}
      </div>
      <label>${t('settings.language')}
        <select name="idioma">
          ${LANGS.map((l) => `<option value="${l}" ${l === getLang() ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}
        </select>
      </label>
      <button type="submit" class="btn btn-accept btn-block">${t('settings.btn_save')}</button>
    </form>
    ${user.role === 'patient' ? `<button class="link-btn" data-action="claim-admin">${t('settings.admin_code_link')}</button>` : ''}
  `;
}

// ---------------------------------------------------------------
// Helpers de negocio
// ---------------------------------------------------------------
function resetBookingFlow() {
  S.booking = {
    filterDoctorId: '',
    selectedDate: null,
    selectedSlot: null,
    treatmentId: '',
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
  };
}

// ---------------------------------------------------------------
// Delegación de eventos
// ---------------------------------------------------------------
async function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'goto') return goto(el.dataset.route);

  if (action === 'toggle-password') {
    const input = el.closest('.password-field')?.querySelector('input');
    if (!input) return;
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    el.innerHTML = hidden ? EYE_OFF_ICON : EYE_ICON;
    return; // manipulación directa del DOM: no re-renderizar o se pierde lo escrito
  }

  if (action === 'set-lang') {
    setLang(el.dataset.lang);
    return render();
  }

  if (action === 'logout') {
    await db.signOut();
    resetBookingFlow();
    return goto('#/welcome');
  }

  if (action === 'forgot-password') {
    const email = prompt(t('login.enter_email_prompt'));
    if (!email) return;
    try {
      await db.resetPassword(email);
      S.notice = t('login.reset_sent');
    } catch (err) {
      S.notice = err.message;
    }
    return render();
  }

  if (action === 'claim-admin') {
    const code = prompt(t('settings.admin_code_prompt'));
    if (!code) return;
    try {
      const ok = await db.claimAdmin(code.trim());
      if (ok) {
        authUser = { ...authUser, role: 'admin' };
        S.notice = t('settings.admin_code_success');
      } else {
        S.notice = t('settings.admin_code_invalid');
      }
    } catch (err) {
      S.notice = err.message;
    }
    return render();
  }

  if (action === 'set-tab') {
    S.activeTab[el.dataset.role] = el.dataset.tab;
    return render();
  }

  if (action === 'pick-day') {
    S.booking.selectedDate = el.dataset.date;
    S.booking.selectedSlot = null;
    S.booking.treatmentId = '';
    return render();
  }

  if (action === 'month-prev' || action === 'month-next') {
    const delta = action === 'month-prev' ? -1 : 1;
    let { viewYear, viewMonth } = S.booking;
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    S.booking.viewYear = viewYear;
    S.booking.viewMonth = viewMonth;
    return render();
  }

  if (action === 'pick-slot') {
    S.booking.selectedSlot = Number(el.dataset.slot);
    return render();
  }

  if (action === 'confirm-booking') return handleConfirmBooking();

  if (action === 'set-install-os') {
    S.install = { os: el.dataset.os, step: 0 };
    return render();
  }

  if (action === 'install-prev') {
    S.install.step = Math.max(0, S.install.step - 1);
    return render();
  }

  if (action === 'install-next') {
    const total = getInstallSteps(S.install.os).length;
    S.install.step = Math.min(total - 1, S.install.step + 1);
    return render();
  }

  if (action === 'open-rating') {
    S.ratingOpenFor = el.dataset.booking;
    return render();
  }

  if (action === 'mark-attended') {
    await db.updateBooking(el.dataset.booking, { status: 'completada' });
    return render();
  }

  if (action === 'request-change') {
    if (!authUser?.canRequestChanges) return render();
    await db.addChangeRequest({ bookingId: el.dataset.booking, doctorId: authUser.id });
    S.notice = t('agenda.request_sent');
    return render();
  }

  if (action === 'toggle-doctor-agenda') {
    S.adminUI.expandedDoctorId = S.adminUI.expandedDoctorId === el.dataset.doctor ? null : el.dataset.doctor;
    return render();
  }

  if (action === 'toggle-doctor-notes') {
    S.adminUI.editingDoctorNotesId = S.adminUI.editingDoctorNotesId === el.dataset.doctor ? null : el.dataset.doctor;
    return render();
  }

  if (action === 'approve-booking') {
    await db.updateBooking(el.dataset.booking, { status: 'aprobada' });
    return render();
  }

  if (action === 'deny-booking') {
    await db.updateBooking(el.dataset.booking, { status: 'rechazada' });
    return render();
  }

  if (action === 'cancel-booking') {
    await db.updateBooking(el.dataset.booking, { status: 'cancelada' });
    return render();
  }

  if (action === 'toggle-edit-patient') {
    S.adminUI.editingPatientId = S.adminUI.editingPatientId === el.dataset.patient ? null : el.dataset.patient;
    return render();
  }

  if (action === 'toggle-active-user') {
    const isCurrentlyActive = el.dataset.active === 'true';
    if (isCurrentlyActive && !confirm(t('adminusers.confirm_deactivate'))) return;
    await db.updateUser(el.dataset.user, { isActive: !isCurrentlyActive });
    return render();
  }

  if (action === 'toggle-reassign') {
    S.adminUI.reassignOpenFor = S.adminUI.reassignOpenFor === el.dataset.booking ? null : el.dataset.booking;
    S.adminUI.rescheduleOpenFor = null;
    return render();
  }

  if (action === 'toggle-reschedule') {
    S.adminUI.rescheduleOpenFor = S.adminUI.rescheduleOpenFor === el.dataset.booking ? null : el.dataset.booking;
    S.adminUI.reassignOpenFor = null;
    return render();
  }

  if (action === 'confirm-reassign') {
    const select = document.querySelector(`[data-select="reassign-doctor"][data-booking="${el.dataset.booking}"]`);
    if (select) await db.updateBooking(el.dataset.booking, { doctorId: select.value, status: 'reasignada' });
    S.adminUI.reassignOpenFor = null;
    return render();
  }

  if (action === 'confirm-reschedule') {
    const dateInput = document.querySelector(`[data-select="reschedule-date"][data-booking="${el.dataset.booking}"]`);
    const timeSelect = document.querySelector(`[data-select="reschedule-time"][data-booking="${el.dataset.booking}"]`);
    if (dateInput && timeSelect) {
      const bookings = await db.getBookings();
      const booking = bookings.find((b) => b.id === el.dataset.booking);
      if (booking) {
        const durationMin = cal.timeToMinutes(booking.endTime) - cal.timeToMinutes(booking.startTime);
        const startMin = Number(timeSelect.value);
        await db.updateBooking(el.dataset.booking, {
          date: dateInput.value,
          startTime: cal.minutesToTime(startMin),
          endTime: cal.minutesToTime(startMin + durationMin),
          status: 'reasignada',
        });
      }
    }
    S.adminUI.rescheduleOpenFor = null;
    return render();
  }

  if (action === 'approve-change') {
    const requests = await db.getChangeRequests();
    const req = requests.find((r) => r.id === el.dataset.request);
    if (req) {
      await db.updateChangeRequest(req.id, { status: 'aprobada' });
      await db.updateBooking(req.bookingId, { status: 'cancelada' });
    }
    return render();
  }

  if (action === 'deny-change') {
    await db.updateChangeRequest(el.dataset.request, { status: 'rechazada' });
    return render();
  }

  if (action === 'approve-doctor-request') {
    await db.updateUser(el.dataset.user, { role: 'doctor', requestedRole: null });
    return render();
  }

  if (action === 'deny-doctor-request') {
    await db.updateUser(el.dataset.user, { requestedRole: null, especialidad: '' });
    return render();
  }
}

async function onChange(e) {
  const el = e.target.closest('[data-onchange]');
  if (!el) return;
  const action = el.dataset.onchange;

  if (action === 'filter-doctor') {
    S.booking.filterDoctorId = el.value;
    S.booking.selectedDate = null;
    S.booking.selectedSlot = null;
    S.booking.treatmentId = '';
    return render();
  }

  if (action === 'select-treatment') {
    S.booking.treatmentId = el.value;
    return render();
  }

  if (action === 'set-currency') {
    await db.setCurrency(el.value);
    return render();
  }

  if (action === 'toggle-doctor-permission') {
    await db.updateUser(el.dataset.doctor, { canRequestChanges: el.checked });
    return render();
  }
}

async function handleConfirmBooking() {
  const treatments = await db.getTreatments();
  const tx = treatments.find((x) => x.id === S.booking.treatmentId);
  if (!tx) return;

  const doctors = (await db.getUsersByRole('doctor')).filter((d) => d.isActive !== false);
  const candidateIds = S.booking.filterDoctorId ? [S.booking.filterDoctorId] : doctors.map((d) => d.id);
  const bookings = await db.getBookings();
  const doctorId = candidateIds.find((docId) =>
    cal.isSlotFreeForDoctor(bookings, docId, S.booking.selectedDate, S.booking.selectedSlot, Number(tx.duracionMin))
  );
  if (!doctorId) {
    S.notice = t('booking.no_slot_selected');
    return render();
  }

  const endMin = S.booking.selectedSlot + Number(tx.duracionMin);
  await db.addBooking({
    patientId: authUser.id,
    doctorId,
    treatmentId: tx.id,
    date: S.booking.selectedDate,
    startTime: cal.minutesToTime(S.booking.selectedSlot),
    endTime: cal.minutesToTime(endMin),
  });

  resetBookingFlow();
  S.notice = t('booking.confirmed_msg');
  S.activeTab.patient = 'appointments';
  return render();
}

async function onSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const type = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());

  if (type === 'login') {
    try {
      await db.signIn({ email: data.email, password: data.password });
      return goto('#/dashboard');
    } catch (err) {
      S.notice = err.message;
      return render();
    }
  }

  if (type === 'register') {
    const especialidad = (data.especialidad || '').trim();
    try {
      const result = await db.signUp({
        email: data.email,
        password: data.password,
        role: 'patient',
        nombre: data.nombre,
        apellidos: data.apellidos,
        telefono: combinedPhone(data),
        edad: data.edad,
        clienteTipo: data.clienteTipo,
        especialidad: especialidad || undefined,
        requestedRole: especialidad ? 'doctor' : undefined,
      });
      if (result.session) return goto('#/dashboard');
      S.notice = t('register.confirm_email_notice');
      return goto('#/login');
    } catch (err) {
      S.notice = err.message;
      return render();
    }
  }

  if (type === 'intake') {
    await db.saveIntake(authUser.id, {
      edad: data.edad,
      condiciones: data.condiciones,
      fuma: data.fuma,
      alergias: data.alergias,
      medicamentos: data.medicamentos,
    });
    await db.updateUser(authUser.id, { edad: data.edad });
    authUser = { ...authUser, edad: Number(data.edad) };
    return goto('#/dashboard');
  }

  if (type === 'add-treatment') {
    await db.addTreatment(data);
    return render();
  }

  if (type === 'edit-patient') {
    await db.updateUser(form.dataset.patient, {
      nombre: data.nombre,
      apellidos: data.apellidos,
      edad: data.edad,
      telefono: combinedPhone(data),
      role: data.role,
      especialidad: data.especialidad,
    });
    await db.setAdminNote(form.dataset.patient, data.adminNote || '');
    S.adminUI.editingPatientId = null;
    S.notice = t('settings.saved_msg');
    return render();
  }

  if (type === 'edit-doctor-notes') {
    await db.setAdminNote(form.dataset.doctor, data.adminNote || '');
    S.adminUI.editingDoctorNotesId = null;
    S.notice = t('settings.saved_msg');
    return render();
  }

  if (type === 'settings') {
    const [nombre, ...rest] = data.nombre.split(' ');
    const apellidos = rest.join(' ');
    const telefono = combinedPhone(data);
    await db.updateUser(authUser.id, { nombre, apellidos, telefono, edad: data.edad });
    authUser = { ...authUser, nombre, apellidos, telefono, edad: Number(data.edad) };
    setLang(data.idioma);
    S.notice = t('settings.saved_msg');
    return render();
  }

  if (type === 'rate') {
    await db.addRating({
      doctorId: form.dataset.doctor,
      bookingId: form.dataset.booking,
      patientId: authUser.id,
      stars: data.stars,
      note: data.note,
      anonymous: !!data.anonymous,
    });
    await db.updateBooking(form.dataset.booking, { ratedByPatient: true });
    S.ratingOpenFor = null;
    S.notice = t('appointments.rating_saved');
    return render();
  }
}
