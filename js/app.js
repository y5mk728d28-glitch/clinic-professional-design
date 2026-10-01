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
  booking: { filterDoctorId: '', selectedDate: null, selectedSlot: null, treatmentId: '' },
  adminUI: { reassignOpenFor: null, rescheduleOpenFor: null, expandedDoctorId: null },
  ratingOpenFor: null,
  changeRequestedIds: new Set(),
  install: { os: 'android', step: 0 },
};

function formatMoney(amount) {
  const code = db.getCurrency();
  const symbol = (CURRENCIES[code] && CURRENCIES[code].symbol) || '$';
  return `${symbol}${amount}`;
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
  render();
});

// ---------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------
function render() {
  const app = document.getElementById('app');
  const session = db.getSession();
  const route = currentRoute();

  const notice = S.notice;
  S.notice = null;

  let body;
  if (route === '/welcome') body = viewWelcome();
  else if (route === '/login') body = viewLogin();
  else if (route === '/role-select') body = viewRoleSelect();
  else if (route.startsWith('/register/')) body = viewRegister(route.split('/')[2]);
  else if (route === '/intake') body = session ? viewIntake(session) : viewWelcome();
  else if (route === '/dashboard') body = session ? viewDashboard(session) : viewWelcome();
  else body = viewWelcome();

  if (!session && route === '/dashboard') goto('#/welcome');

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar__brand"><span class="dot"></span> ${BUSINESS.name}</div>
      <div style="display:flex; align-items:center; gap:14px;">
        ${session ? `<button class="btn btn-deny btn-sm" data-action="logout">${t('nav.logout')}</button>` : ''}
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
        <button class="btn btn-brand btn-block" data-action="goto" data-route="#/role-select">${t('welcome.btn_create')}</button>
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

  return `
    <div class="install-guide">
      <div class="btn-row" style="justify-content:center;">
        <button class="btn btn-sm ${os === 'android' ? 'btn-brand' : ''}" data-action="set-install-os" data-os="android">${t('install.os_android')}</button>
        <button class="btn btn-sm ${os === 'ios' ? 'btn-brand' : ''}" data-action="set-install-os" data-os="ios">${t('install.os_ios')}</button>
      </div>
      <div class="install-step-card">
        <div class="install-step-icon">${icon}</div>
        <p class="install-step-text">${steps[step]}</p>
      </div>
      <div class="btn-row" style="justify-content:space-between; align-items:center;">
        <button class="btn btn-sm" data-action="install-prev" ${step === 0 ? 'disabled' : ''}>${t('install.btn_prev')}</button>
        <span class="muted">${t('install.step_label')} ${step + 1} ${t('install.of')} ${steps.length}</span>
        <button class="btn btn-sm" data-action="install-next" ${step === steps.length - 1 ? 'disabled' : ''}>${t('install.btn_next')}</button>
      </div>
    </div>
  `;
}

function viewLogin() {
  return `
    <div class="card">
      <h1>${t('login.title')}</h1>
      <form data-form="login">
        <label>${t('login.username_label')}
          <input type="text" name="username" required />
        </label>
        <p class="muted">${t('login.username_hint')}</p>
        <label>${t('login.password_label')}
          <input type="password" name="password" required />
        </label>
        <p class="muted">${t('login.password_hint')}</p>
        <div class="btn-row" style="margin-top:8px;">
          <button type="submit" class="btn btn-accept btn-block">${t('login.btn_submit')}</button>
          <button type="button" class="btn btn-block" data-action="goto" data-route="#/welcome">${t('login.btn_back')}</button>
        </div>
      </form>
      <button class="link-btn" data-action="goto" data-route="#/role-select">${t('login.no_account')}</button>
    </div>
  `;
}

function viewRoleSelect() {
  const roles = [
    { key: 'patient', label: t('role.patient'), initial: 'P' },
    { key: 'doctor', label: t('role.doctor'), initial: 'D' },
    { key: 'admin', label: t('role.admin'), initial: 'A' },
  ];
  return `
    <div class="card" style="align-items:center; text-align:center;">
      <h1>${t('roleselect.title')}</h1>
      <p>${t('roleselect.subtitle')}</p>
    </div>
    <div class="role-grid">
      ${roles
        .map(
          (r) => `
        <div class="role-card" data-action="goto" data-route="#/register/${r.key}">
          <div class="role-card__icon">${r.initial}</div>
          <strong>${r.label}</strong>
        </div>`
        )
        .join('')}
    </div>
    <button class="btn" data-action="goto" data-route="#/welcome">${t('roleselect.btn_back')}</button>
  `;
}

function viewRegister(role) {
  if (!['patient', 'doctor', 'admin'].includes(role)) role = 'patient';
  const roleLabel = role === 'patient' ? t('role.patient') : role === 'doctor' ? t('role.doctor') : t('role.admin');

  let extraFields = '';
  if (role === 'doctor') {
    extraFields = `
      <label>${t('register.specialty')}
        <input type="text" name="especialidad" required />
      </label>`;
  } else if (role === 'patient') {
    extraFields = `
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
      </div>`;
  }

  return `
    <div class="card">
      <h1>${t('register.title')} · ${roleLabel}</h1>
      <form data-form="register" data-role="${role}">
        <div class="field-row">
          <label>${t('register.firstname')}
            <input type="text" name="nombre" required />
          </label>
          <label>${t('register.lastname')}
            <input type="text" name="apellidos" required />
          </label>
        </div>
        <div class="field-row">
          <label>${t('register.phone')}
            <input type="tel" name="telefono" required />
          </label>
          <label>${t('register.email')}
            <input type="email" name="email" required />
          </label>
        </div>
        ${extraFields}
        <label>${t('register.password')}
          <input type="password" name="password" required />
        </label>
        <div class="btn-row" style="margin-top:8px;">
          <button type="submit" class="btn btn-accept btn-block">${t('register.btn_submit')}</button>
          <button type="button" class="btn btn-deny btn-block" data-action="goto" data-route="#/role-select">${t('register.btn_cancel')}</button>
        </div>
      </form>
      <button class="link-btn" data-action="goto" data-route="#/login">${t('register.have_account')}</button>
    </div>
  `;
}

function viewIntake(session) {
  const user = db.getUserById(session.userId);
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
function viewDashboard(session) {
  const user = db.getUserById(session.userId);
  if (!user) {
    db.clearSession();
    goto('#/welcome');
    return '';
  }
  if (session.role === 'patient' && !db.getIntake(user.id)) {
    goto('#/intake');
    return '';
  }
  if (session.role === 'patient') return dashboardPatient(user);
  if (session.role === 'doctor') return dashboardDoctor(user);
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
function dashboardPatient(user) {
  const tabs = [
    { key: 'booking', label: t('patient.tab_booking') },
    { key: 'appointments', label: t('patient.tab_appointments') },
    { key: 'settings', label: t('patient.tab_settings') },
  ];
  const active = S.activeTab.patient || 'booking';
  let content = '';
  if (active === 'booking') content = patientBookingTab(user);
  else if (active === 'appointments') content = patientAppointmentsTab(user);
  else content = settingsTab(user);

  return `
    <div class="card card--wide">
      ${tabsBar('patient', tabs)}
      ${content}
    </div>
  `;
}

function patientBookingTab(user) {
  const doctors = db.getUsersByRole('doctor');
  const bookings = db.getBookings();
  const filterId = S.booking.filterDoctorId;
  const now = new Date();
  const weeks = cal.getMonthMatrix(now.getFullYear(), now.getMonth());
  const monthLabel = now.toLocaleDateString(LOCALE_MAP[getLang()], { month: 'long', year: 'numeric' });
  const weekdayLabels = weeks[1].map((d) => d.toLocaleDateString(LOCALE_MAP[getLang()], { weekday: 'short' }));

  const doctorIds = doctors.map((d) => d.id);

  const dayCells = weeks
    .flat()
    .map((date) => {
      const inMonth = date.getMonth() === now.getMonth();
      const status = cal.getDayStatus({ date, doctorIds, bookings, filterDoctorId: filterId || null });
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
    const treatments = db.getTreatments();
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
        treatmentBlock += `
          <p><strong>${t('booking.estimated_duration')}:</strong> ${tx.duracionMin} ${t('booking.minutes')} · <strong>${t('booking.estimated_price')}:</strong> ${formatMoney(tx.precio)}</p>
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

    <h2 style="text-transform:capitalize;">${monthLabel}</h2>
    <div class="calendar-grid">
      ${weekdayLabels.map((w) => `<div class="muted" style="text-align:center; text-transform:capitalize;">${w}</div>`).join('')}
      ${dayCells}
    </div>
    <div class="legend">
      <span><span class="legend-swatch" style="background:var(--sapphire-500)"></span>${t('booking.legend_available')}</span>
      <span><span class="legend-swatch" style="background:var(--red-500)"></span>${t('booking.legend_full')}</span>
      <span><span class="legend-swatch" style="background:var(--white); border:1px solid var(--gray-400);"></span>${t('booking.legend_unavailable')}</span>
    </div>

    ${slotsBlock}
    ${treatmentBlock}
  `;
}

function patientAppointmentsTab(user) {
  const bookings = db.getBookingsForPatient(user.id).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  if (bookings.length === 0) return `<p class="muted">${t('appointments.empty')}</p>`;

  const treatments = db.getTreatments();

  return bookings
    .map((b) => {
      const doctor = db.getUserById(b.doctorId);
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
            <strong>${b.date} · ${b.startTime}–${b.endTime}</strong>
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
function dashboardDoctor(user) {
  const tabs = [
    { key: 'agenda', label: t('doctor.tab_agenda') },
    { key: 'patients', label: t('doctor.tab_patients') },
    { key: 'settings', label: t('doctor.tab_settings') },
  ];
  const active = S.activeTab.doctor || 'agenda';
  let content = '';
  if (active === 'agenda') content = doctorAgendaTab(user);
  else if (active === 'patients') content = doctorPatientsTab(user);
  else content = settingsTab(user);

  return `
    <div class="card card--wide">
      ${tabsBar('doctor', tabs)}
      ${content}
    </div>
  `;
}

function doctorAgendaTab(user) {
  const bookings = db.getBookingsForDoctor(user.id).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
  if (bookings.length === 0) return `<p class="muted">${t('agenda.empty')}</p>`;
  const treatments = db.getTreatments();
  const openRequests = db.getChangeRequests();

  return `
    <h2>${t('agenda.title')}</h2>
    <table>
      <thead><tr><th>${t('booking.title')}</th><th>${t('treatments.name')}</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${bookings
          .map((b) => {
            const patient = db.getUserById(b.patientId);
            const tx = treatments.find((x) => x.id === b.treatmentId);
            const badgeClass = { pendiente: 'badge-pending', reasignada: 'badge-pending', aprobada: 'badge-approved', rechazada: 'badge-denied', cancelada: 'badge-denied', completada: 'badge-done' }[b.status];
            const hasOpenRequest = openRequests.some((r) => r.bookingId === b.id && r.status === 'pendiente');
            let actions = '';
            if (b.status === 'aprobada') {
              actions += `<button class="btn btn-accept btn-sm" data-action="mark-attended" data-booking="${b.id}">✓</button> `;
            }
            if (['pendiente', 'aprobada'].includes(b.status)) {
              actions += hasOpenRequest
                ? `<span class="muted">${t('agenda.request_sent')}</span>`
                : `<button class="btn btn-deny btn-sm" data-action="request-change" data-booking="${b.id}">${t('agenda.btn_request_change')}</button>`;
            }
            return `<tr>
              <td>${b.date} ${b.startTime}–${b.endTime}<br/><span class="muted">${patient ? patient.nombre + ' ' + patient.apellidos : ''}</span></td>
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

function doctorPatientsTab(user) {
  const bookings = db.getBookingsForDoctor(user.id);
  const patientIds = [...new Set(bookings.map((b) => b.patientId))];
  const ratings = db.getRatingsForDoctor(user.id);
  const avg = ratings.length ? (ratings.reduce((s, r) => s + Number(r.stars), 0) / ratings.length).toFixed(1) : null;

  const ratingsSummary = `<p><strong>${t('patients.ratings')}:</strong> ${avg ? `${avg} / 5 (${ratings.length})` : '—'}</p>`;

  if (patientIds.length === 0) return `${ratingsSummary}<p class="muted">${t('patients.empty')}</p>`;

  const rows = patientIds
    .map((pid) => {
      const p = db.getUserById(pid);
      if (!p) return '';
      return `<tr><td>${p.nombre} ${p.apellidos}</td><td>${p.edad ?? '—'}</td><td>${p.telefono}</td><td>${p.email}</td></tr>`;
    })
    .join('');

  const notesRows = ratings
    .map((r) => {
      const patient = db.getUserById(r.patientId);
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
function dashboardAdmin(user) {
  const tabs = [
    { key: 'treatments', label: t('admin.tab_treatments') },
    { key: 'doctors', label: t('admin.tab_doctors') },
    { key: 'requests', label: t('admin.tab_requests') },
    { key: 'patients', label: t('admin.tab_patients') },
    { key: 'settings', label: t('admin.tab_settings') },
  ];
  const active = S.activeTab.admin || 'treatments';
  let content = '';
  if (active === 'treatments') content = adminTreatmentsTab();
  else if (active === 'doctors') content = adminDoctorsTab();
  else if (active === 'requests') content = adminRequestsTab();
  else if (active === 'patients') content = adminPatientsTab();
  else content = settingsTab(user);

  return `
    <div class="card card--wide">
      ${tabsBar('admin', tabs)}
      ${content}
    </div>
  `;
}

function adminTreatmentsTab() {
  const treatments = db.getTreatments();
  const currentCurrency = db.getCurrency();
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
            <tbody>${treatments.map((tx) => `<tr><td>${tx.nombre}</td><td>${tx.duracionMin} ${t('booking.minutes')}</td><td>${formatMoney(tx.precio)}</td></tr>`).join('')}</tbody>
          </table>`
    }
  `;
}

function adminDoctorsTab() {
  const doctors = db.getUsersByRole('doctor');
  if (doctors.length === 0) return `<p class="muted">${t('doctors.list_empty')}</p>`;

  return `
    <h2>${t('doctors.title')}</h2>
    <table>
      <thead><tr><th>${t('settings.name')}</th><th>${t('register.specialty')}</th><th>${t('settings.phone')}</th><th>${t('settings.email')}</th><th></th></tr></thead>
      <tbody>
        ${doctors
          .map((d) => {
            const expanded = S.adminUI.expandedDoctorId === d.id;
            let agendaRows = '';
            if (expanded) {
              const bookings = db.getBookingsForDoctor(d.id);
              agendaRows = bookings.length
                ? bookings
                    .map((b) => {
                      const patient = db.getUserById(b.patientId);
                      return `<tr><td>${b.date} ${b.startTime}–${b.endTime}</td><td>${patient ? patient.nombre + ' ' + patient.apellidos : ''}</td><td>${t('appointments.status_' + b.status)}</td></tr>`;
                    })
                    .join('')
                : `<tr><td colspan="3" class="muted">${t('agenda.empty')}</td></tr>`;
            }
            return `
              <tr>
                <td>${d.nombre} ${d.apellidos}</td><td>${d.especialidad || ''}</td><td>${d.telefono}</td><td>${d.email}</td>
                <td><button class="btn btn-sm" data-action="toggle-doctor-agenda" data-doctor="${d.id}">${t('doctors.view_agenda')}</button></td>
              </tr>
              ${expanded ? `<tr><td colspan="5"><table>${agendaRows}</table></td></tr>` : ''}
            `;
          })
          .join('')}
      </tbody>
    </table>
  `;
}

function adminRequestsTab() {
  const bookings = db.getBookings().filter((b) => ['pendiente', 'reasignada'].includes(b.status));
  const doctors = db.getUsersByRole('doctor');
  const treatments = db.getTreatments();
  const slots = cal.generateSlotStarts();

  const pendingRows = bookings.length
    ? bookings
        .map((b) => {
          const patient = db.getUserById(b.patientId);
          const doctor = db.getUserById(b.doctorId);
          const tx = treatments.find((x) => x.id === b.treatmentId);
          const reassignOpen = S.adminUI.reassignOpenFor === b.id;
          const rescheduleOpen = S.adminUI.rescheduleOpenFor === b.id;
          return `
            <tr>
              <td>${patient ? patient.nombre + ' ' + patient.apellidos : ''}</td>
              <td>${doctor ? doctor.nombre + ' ' + doctor.apellidos : '—'}</td>
              <td>${tx ? tx.nombre : ''}</td>
              <td>${b.date} ${b.startTime}–${b.endTime}</td>
              <td class="btn-row">
                <button class="btn btn-accept btn-sm" data-action="approve-booking" data-booking="${b.id}">${t('requests.btn_approve')}</button>
                <button class="btn btn-deny btn-sm" data-action="deny-booking" data-booking="${b.id}">${t('requests.btn_deny')}</button>
                <button class="btn btn-sm" data-action="toggle-reassign" data-booking="${b.id}">${t('requests.btn_reassign')}</button>
                <button class="btn btn-sm" data-action="toggle-reschedule" data-booking="${b.id}">${t('requests.btn_reschedule')}</button>
              </td>
            </tr>
            ${
              reassignOpen
                ? `<tr><td colspan="5">
                    <div class="btn-row" style="align-items:center;">
                      <select data-select="reassign-doctor" data-booking="${b.id}">
                        ${doctors.map((d) => `<option value="${d.id}">${d.nombre} ${d.apellidos}</option>`).join('')}
                      </select>
                      <button class="btn btn-accept btn-sm" data-action="confirm-reassign" data-booking="${b.id}">${t('common.save')}</button>
                    </div>
                  </td></tr>`
                : ''
            }
            ${
              rescheduleOpen
                ? `<tr><td colspan="5">
                    <div class="btn-row" style="align-items:center;">
                      <input type="date" data-select="reschedule-date" data-booking="${b.id}" value="${b.date}" />
                      <select data-select="reschedule-time" data-booking="${b.id}">
                        ${slots.map((s) => `<option value="${s}" ${cal.minutesToTime(s) === b.startTime ? 'selected' : ''}>${cal.minutesToTime(s)}</option>`).join('')}
                      </select>
                      <button class="btn btn-accept btn-sm" data-action="confirm-reschedule" data-booking="${b.id}">${t('common.save')}</button>
                    </div>
                  </td></tr>`
                : ''
            }
          `;
        })
        .join('')
    : `<tr><td colspan="5" class="muted">${t('requests.empty')}</td></tr>`;

  const changeRequests = db.getChangeRequests().filter((r) => r.status === 'pendiente');
  const changeRows = changeRequests.length
    ? changeRequests
        .map((r) => {
          const booking = db.getBookings().find((b) => b.id === r.bookingId);
          const doctor = db.getUserById(r.doctorId);
          return `<tr>
            <td>${doctor ? doctor.nombre + ' ' + doctor.apellidos : ''}</td>
            <td>${booking ? booking.date + ' ' + booking.startTime : '—'}</td>
            <td class="btn-row">
              <button class="btn btn-accept btn-sm" data-action="approve-change" data-request="${r.id}">${t('requests.btn_approve')}</button>
              <button class="btn btn-deny btn-sm" data-action="deny-change" data-request="${r.id}">${t('requests.btn_deny')}</button>
            </td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="3" class="muted">${t('requests.empty')}</td></tr>`;

  return `
    <h2>${t('requests.title')}</h2>
    <table>
      <thead><tr><th>Paciente</th><th>Doctor</th><th>${t('treatments.name')}</th><th>${t('booking.title')}</th><th></th></tr></thead>
      <tbody>${pendingRows}</tbody>
    </table>
    <h2 style="margin-top:20px;">${t('requests.change_requests_title')}</h2>
    <table>
      <thead><tr><th>Doctor</th><th>${t('booking.title')}</th><th></th></tr></thead>
      <tbody>${changeRows}</tbody>
    </table>
  `;
}

function adminPatientsTab() {
  const patients = db.getUsersByRole('patient');
  if (patients.length === 0) return `<p class="muted">${t('adminpatients.empty')}</p>`;
  return `
    <h2>${t('adminpatients.title')}</h2>
    <table>
      <thead><tr><th>${t('settings.name')}</th><th>${t('settings.age')}</th><th>${t('settings.phone')}</th><th>${t('settings.email')}</th><th>${t('intake.smoker')}</th><th>${t('intake.conditions')}</th></tr></thead>
      <tbody>
        ${patients
          .map((p) => {
            const intake = db.getIntake(p.id);
            return `<tr>
              <td>${p.nombre} ${p.apellidos}</td><td>${p.edad ?? '—'}</td><td>${p.telefono}</td><td>${p.email}</td>
              <td>${intake ? (intake.fuma === 'si' ? t('intake.smoker_yes') : t('intake.smoker_no')) : '—'}</td>
              <td>${intake?.condiciones || '—'}</td>
            </tr>`;
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
  const session = db.getSession();
  return `
    <h2>${t('settings.title')}</h2>
    <form data-form="settings">
      <div class="field-row">
        <label>${t('settings.name')}<input type="text" name="nombre" value="${user.nombre} ${user.apellidos}" /></label>
        <label>${t('settings.age')}<input type="number" name="edad" value="${user.edad ?? ''}" /></label>
      </div>
      <div class="field-row">
        <label>${t('settings.email')}<input type="email" name="email" value="${user.email}" /></label>
        <label>${t('settings.phone')}<input type="tel" name="telefono" value="${user.telefono}" /></label>
      </div>
      <label>${t('settings.language')}
        <select name="idioma">
          ${LANGS.map((l) => `<option value="${l}" ${l === getLang() ? 'selected' : ''}>${l.toUpperCase()}</option>`).join('')}
        </select>
      </label>
      <label><input type="checkbox" name="keepLogin" style="width:auto;" ${session?.keepLogin ? 'checked' : ''} /> ${t('settings.keep_login')}</label>
      <button type="submit" class="btn btn-accept btn-block">${t('settings.btn_save')}</button>
    </form>
  `;
}

// ---------------------------------------------------------------
// Helpers de negocio
// ---------------------------------------------------------------
function getOrCreateDemoUser(role) {
  const existing = db.getUsersByRole(role);
  if (existing.length > 0) return existing[existing.length - 1];
  const demoNames = { patient: ['Ramón', 'Demo'], doctor: ['Heriberto', 'Demo'], admin: ['Ana', 'Demo'] };
  const [nombre, apellidos] = demoNames[role];
  return db.saveUser({
    role,
    nombre,
    apellidos,
    telefono: '000-0000',
    email: `${role}.demo@example.com`,
    ...(role === 'doctor' ? { especialidad: 'General' } : {}),
    ...(role === 'patient' ? { edad: 30, clienteTipo: 'nuevo' } : {}),
  });
}

function resetBookingFlow() {
  S.booking = { filterDoctorId: '', selectedDate: null, selectedSlot: null, treatmentId: '' };
}

// ---------------------------------------------------------------
// Delegación de eventos
// ---------------------------------------------------------------
function onClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'goto') return goto(el.dataset.route);

  if (action === 'set-lang') {
    setLang(el.dataset.lang);
    return render();
  }

  if (action === 'logout') {
    db.clearSession();
    resetBookingFlow();
    return goto('#/welcome');
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
    db.updateBooking(el.dataset.booking, { status: 'completada' });
    return render();
  }

  if (action === 'request-change') {
    const session = db.getSession();
    db.addChangeRequest({ bookingId: el.dataset.booking, doctorId: session.userId });
    S.notice = t('agenda.request_sent');
    return render();
  }

  if (action === 'toggle-doctor-agenda') {
    S.adminUI.expandedDoctorId = S.adminUI.expandedDoctorId === el.dataset.doctor ? null : el.dataset.doctor;
    return render();
  }

  if (action === 'approve-booking') {
    db.updateBooking(el.dataset.booking, { status: 'aprobada' });
    return render();
  }

  if (action === 'deny-booking') {
    db.updateBooking(el.dataset.booking, { status: 'rechazada' });
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
    if (select) db.updateBooking(el.dataset.booking, { doctorId: select.value, status: 'reasignada' });
    S.adminUI.reassignOpenFor = null;
    return render();
  }

  if (action === 'confirm-reschedule') {
    const dateInput = document.querySelector(`[data-select="reschedule-date"][data-booking="${el.dataset.booking}"]`);
    const timeSelect = document.querySelector(`[data-select="reschedule-time"][data-booking="${el.dataset.booking}"]`);
    const booking = db.getBookings().find((b) => b.id === el.dataset.booking);
    if (dateInput && timeSelect && booking) {
      const durationMin = cal.timeToMinutes(booking.endTime) - cal.timeToMinutes(booking.startTime);
      const startMin = Number(timeSelect.value);
      db.updateBooking(el.dataset.booking, {
        date: dateInput.value,
        startTime: cal.minutesToTime(startMin),
        endTime: cal.minutesToTime(startMin + durationMin),
        status: 'reasignada',
      });
    }
    S.adminUI.rescheduleOpenFor = null;
    return render();
  }

  if (action === 'approve-change') {
    const req = db.getChangeRequests().find((r) => r.id === el.dataset.request);
    if (req) {
      db.updateChangeRequest(req.id, { status: 'aprobada' });
      db.updateBooking(req.bookingId, { status: 'cancelada' });
    }
    return render();
  }

  if (action === 'deny-change') {
    db.updateChangeRequest(el.dataset.request, { status: 'rechazada' });
    return render();
  }
}

function onChange(e) {
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
    db.setCurrency(el.value);
    return render();
  }
}

function handleConfirmBooking() {
  const session = db.getSession();
  const treatments = db.getTreatments();
  const tx = treatments.find((x) => x.id === S.booking.treatmentId);
  if (!tx) return;

  const doctors = db.getUsersByRole('doctor');
  const candidateIds = S.booking.filterDoctorId ? [S.booking.filterDoctorId] : doctors.map((d) => d.id);
  const bookings = db.getBookings();
  const doctorId = candidateIds.find((docId) =>
    cal.isSlotFreeForDoctor(bookings, docId, S.booking.selectedDate, S.booking.selectedSlot, Number(tx.duracionMin))
  );
  if (!doctorId) {
    S.notice = t('booking.no_slot_selected');
    return render();
  }

  const endMin = S.booking.selectedSlot + Number(tx.duracionMin);
  db.addBooking({
    patientId: session.userId,
    doctorId,
    treatmentId: tx.id,
    date: S.booking.selectedDate,
    startTime: cal.minutesToTime(S.booking.selectedSlot),
    endTime: cal.minutesToTime(endMin),
  });

  resetBookingFlow();
  S.notice = t('booking.confirmed_msg');
  S.activeTab.patient = 'appointments';
  render();
}

function onSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const type = form.dataset.form;
  const data = Object.fromEntries(new FormData(form).entries());

  if (type === 'login') {
    const map = { '1': 'patient', '2': 'doctor', '3': 'admin' };
    const role = map[data.username.trim()];
    if (!role) {
      S.notice = t('login.username_hint');
      return render();
    }
    const user = getOrCreateDemoUser(role);
    db.setSession({ userId: user.id, role });
    return goto(role === 'patient' && !db.getIntake(user.id) ? '#/intake' : '#/dashboard');
  }

  if (type === 'register') {
    const role = form.dataset.role;
    const user = db.saveUser({ role, ...data });
    db.setSession({ userId: user.id, role });
    return goto(role === 'patient' ? '#/intake' : '#/dashboard');
  }

  if (type === 'intake') {
    const session = db.getSession();
    db.saveIntake(session.userId, data);
    db.updateUser(session.userId, { edad: data.edad });
    return goto('#/dashboard');
  }

  if (type === 'add-treatment') {
    db.addTreatment(data);
    return render();
  }

  if (type === 'settings') {
    const session = db.getSession();
    const [nombre, ...rest] = data.nombre.split(' ');
    db.updateUser(session.userId, {
      nombre,
      apellidos: rest.join(' '),
      email: data.email,
      telefono: data.telefono,
      edad: data.edad,
    });
    setLang(data.idioma);
    db.setSession({ ...session, keepLogin: !!data.keepLogin });
    S.notice = t('settings.saved_msg');
    return render();
  }

  if (type === 'rate') {
    db.addRating({
      doctorId: form.dataset.doctor,
      bookingId: form.dataset.booking,
      patientId: db.getSession().userId,
      stars: data.stars,
      note: data.note,
      anonymous: !!data.anonymous,
    });
    db.updateBooking(form.dataset.booking, { ratedByPatient: true });
    S.ratingOpenFor = null;
    S.notice = t('appointments.rating_saved');
    return render();
  }
}
