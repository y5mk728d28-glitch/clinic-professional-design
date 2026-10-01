# Clinic Professional Design

Plataforma web multi-rol para clínicas de salud (caso base: clínica dental).
Diseñada como una base reutilizable: el motor (agenda, cuentas, catálogo de
tratamientos, notificaciones) es genérico; lo que cambia por negocio vive en
`js/config.js` y en la paleta de `css/styles.css`.

Estado actual: **backend real conectado** (Supabase — base de datos +
autenticación). Login real con correo/contraseña, con verificación de correo
automática al registrarse. Los datos se sincronizan entre cualquier
dispositivo que abra la app, ya no viven solo en el navegador.

## Cómo probarla

No requiere instalación ni build. Sirve los archivos estáticos con cualquier
servidor local, por ejemplo:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

También funciona desde GitHub Pages o cualquier hosting estático.

**Importante**: no la pruebes dentro de una vista previa tipo "Artifact" de
Claude — ese entorno bloquea las conexiones salientes al backend real
(Supabase), así que el login y los datos no van a funcionar ahí. Usa un
servidor local o la URL publicada.

### Configurar el backend (una sola vez)

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan gratis)
2. En el **SQL Editor** del proyecto, pega y ejecuta todo el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) — crea las tablas, la
   seguridad a nivel de fila (RLS) y el trigger que arma el perfil de cada
   usuario al registrarse
3. En **Settings → API**, copia el "Project URL" y la clave "anon public" /
   "publishable" (nunca la "service_role", esa es secreta)
4. Pégalos en `js/supabaseClient.js` (`SUPABASE_URL` y
   `SUPABASE_PUBLISHABLE_KEY`)

### Primer uso

En la pantalla de bienvenida: "Crear cuenta" → elige rol → completa el
formulario (el correo y la contraseña son las credenciales reales de login).
Según la configuración del proyecto de Supabase, puede pedir confirmar el
correo antes de poder iniciar sesión. "¿Olvidaste tu contraseña?" en el login
envía un correo de recuperación.

## Roles

- **Paciente**: calendario de disponibilidad (azul = disponible, rojo =
  completo, blanco = no disponible, verde = día en que fue atendido),
  navegación entre meses pasados/futuros, filtro por doctor, selección de
  tratamiento con precio/duración estimados, historial de citas y
  calificación al doctor tras la cita.
- **Doctor**: agenda con sus citas (sincronizada con las reservas de
  pacientes — un horario ocupado no puede volver a reservarse), solicitud de
  cambio/cancelación hacia el administrador (solo si el admin se lo habilitó
  primero), lista de pacientes atendidos y su calificación promedio.
- **Administrador / Recepcionista**: catálogo de tratamientos (nombre,
  duración, precio) con moneda configurable, roster de doctores con su
  agenda y el permiso de "puede cancelar/reprogramar" por doctor, cola de
  solicitudes de citas (aprobar, denegar, reasignar doctor, reprogramar —
  también sobre citas ya aprobadas), listado de pacientes editable (sin
  contraseñas).

Cada rol comparte una pestaña de **Ajustes** (nombre, teléfono, idioma —
el correo no es editable ahí porque es la credencial de login real).

## Idiomas

Español (predeterminado), inglés y alemán. Todos los textos de la interfaz
salen de `js/i18n.js` — nunca están escritos directo en el HTML/JS, para
poder agregar idiomas sin tocar el resto del código.

## Paleta de marca

- Verde esmeralda + blanco (degradado) — identidad visual de marca.
- Azul zafiro — acciones de aceptar/aprobar/confirmar.
- Rojo — acciones de denegar/cancelar/salir.
- Bordes gris-negro — botones neutros/generales.

Los tokens están centralizados en `css/styles.css` (`:root`).

## Estructura

```
index.html             Shell de la app (SPA con enrutado por hash)
css/styles.css          Paleta, componentes, layout
js/app.js               Vistas, enrutado y lógica de UI (async, Supabase)
js/i18n.js              Traducciones (es/en/de)
js/db.js                Acceso a datos — Supabase (auth + base de datos)
js/supabaseClient.js    Credenciales de conexión al proyecto de Supabase
js/calendar.js          Generación de calendario y franjas horarias
js/config.js            Configuración por negocio (nombre, moneda, íconos)
supabase/schema.sql     Tablas, seguridad (RLS) y trigger de registro
manifest.json, sw.js    Soporte PWA (instalar en pantalla de inicio)
```

## Próximos pasos

- Video real de instalación (reemplazar la simulación animada por una
  grabación de pantalla real, Android y iPhone).
- Envío de SMS (requiere conectar una cuenta de Twilio).
- Catálogo de servicios visible a todos, con permisos por paciente sobre
  cuáles puede solicitar (pendiente de definir con la clínica).
- Formulario de intake "real" de la clínica, con historial de versiones si
  se permite que el paciente lo edite.
- Sección de preguntas y respuestas.
- Posible 4to rol por encima del administrador (dueño/jefe).
