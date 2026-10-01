// Capa de configuración por negocio. Para adaptar esta base a otra clínica
// (ej. veterinaria) solo se edita este archivo — el resto del código no cambia.

export const BUSINESS = {
  name: 'Clínica Dental Sonrisa',
  patientLabel: { es: 'Paciente', en: 'Patient', de: 'Patient' },
};

export const LOCALE_MAP = { es: 'es-ES', en: 'en-US', de: 'de-DE' };

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCIES = {
  USD: { symbol: '$', label: 'USD ($)' },
  EUR: { symbol: '€', label: 'EUR (€)' },
  GBP: { symbol: '£', label: 'GBP (£)' },
  MXN: { symbol: '$', label: 'MXN ($)' },
  DOP: { symbol: 'RD$', label: 'DOP (RD$)' },
  COP: { symbol: '$', label: 'COP ($)' },
  ARS: { symbol: '$', label: 'ARS ($)' },
};

// Iconos por paso de instalación (no dependen del idioma).
export const INSTALL_ICONS = {
  android: ['📷', '🔗', '⋮', '➕', '✅', '🏠'],
  ios: ['📷', '🔗', '⬆️', '➕', '✅', '🏠'],
};
