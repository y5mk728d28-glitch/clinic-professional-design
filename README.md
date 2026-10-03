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

En la pantalla de bienvenida, "Crear cuenta" lleva directo al formulario de
**Paciente** — es la única cuenta que se autoregistra (el correo y la
contraseña son las credenciales reales de login). Según la configuración del
proyecto de Supabase, puede pedir confirmar el correo antes de poder iniciar
sesión. "¿Olvidaste tu contraseña?" en el login envía un correo de
recuperación.

## Modelo de seguridad y roles (leer antes de compartir el link)

El registro público **siempre crea la cuenta como Paciente**, sin excepción
— esto es una decisión deliberada a nivel de base de datos
(`handle_new_user()` en `supabase/schema.sql` ignora cualquier rol que mande
el cliente). Si no fuera así, cualquiera con el link podría autoasignarse
"Administrador" con una simple llamada a `supabase.auth.signUp()` desde la
consola del navegador — el código del frontend siempre es visible, así que
la única capa confiable es la base de datos, no el formulario.

**Cómo se vuelve alguien Doctor o Administrador:**

- **Doctor**: la persona se registra como cualquier paciente (con su correo y
  contraseña reales), opcionalmente llenando "Especialidad" si quiere acceso
  de Doctor. Si lo llena, su solicitud aparece en Panel de Admin →
  Solicitudes → "Solicitudes de acceso como Doctor", donde el admin la
  aprueba o deniega. También se puede ascender manualmente a cualquier
  paciente después, desde Pacientes → Editar → campo "Rol". Sin esa
  aprobación, la persona solo ve el panel de paciente — su cuenta existe
  pero no tiene agenda ni recibe pacientes hasta que el admin la activa.
- **Administrador**: protegido con un **código de activación** único por
  clínica, para que nadie pueda autoasignarse admin sin el permiso del dueño
  real del negocio (ver `supabase/schema.sql`, tabla `admin_activation` y
  función `claim_admin()` — el código vive en una tabla que nadie puede leer
  directo desde el navegador, y se usa una sola vez). Flujo:
  1. Al configurar el Supabase de una clínica, cambia el valor por defecto
     `'CAMBIA-ESTE-CODIGO'` por un código único y privado.
  2. Dáselo en privado SOLO al dueño real de esa clínica.
  3. Esa persona se registra como paciente, va a Ajustes → "¿Tienes un
     código de activación de administrador?", lo escribe, y su cuenta se
     asciende a Administrador automáticamente.

  Alternativa manual (si prefieres hacerlo tú mismo por SQL en vez de usar
  el código):
  ```sql
  update public.profiles set role = 'admin' where email = 'correo-del-dueño@ejemplo.com';
  ```

**Notas internas**: en Panel de Admin → Pacientes (botón "Editar") y
Doctores (botón "Notas"), el admin puede dejarse notas privadas sobre cada
persona (por qué se pausó un doctor, por qué se canceló algo, etc.). Viven
en una tabla aparte que ni el doctor ni el paciente pueden leer — ni
siquiera llamando a la API directamente.

**Quitarle el acceso a alguien**: en Panel de Admin → Pacientes o Doctores,
el botón "Desactivar acceso" bloquea esa cuenta de inmediato (no puede volver
a iniciar sesión) y es reversible ("Reactivar acceso") — sirve igual para
vacaciones del doctor, una revisión en curso, o negarle el acceso sin
borrar su cuenta. Nota técnica: esto no borra la cuenta de login de
Supabase — eso requeriría una pieza de servidor aparte (clave que nunca debe
vivir en el navegador) que no está construida todavía. Para el día a día
esto es lo que importa (la persona pierde acceso por completo); si alguna
vez necesitas borrado permanente real
(por ejemplo, por ley de protección de datos), ese es un paso adicional a
construir cuando haga falta.

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

## Usar esto como plantilla para una clínica nueva

Cada clínica = su propio repo + su propio proyecto de Supabase (no comparten
datos entre sí). Pasos para la clínica #2, #3, etc.:

1. **Marca este repo como plantilla**: en GitHub, `Settings` → `General` →
   marca la casilla "Template repository". Así, cada vez que quieras una
   clínica nueva, entras al repo y le das al botón verde **"Use this
   template"** en vez de clonarlo a mano — te da una copia limpia, sin el
   historial de commits de esta clínica.
2. **Crea un proyecto de Supabase nuevo** para esa clínica (repite los pasos
   de "Configurar el backend" de arriba) — cada clínica necesita su propia
   base de datos, nunca reutilices la misma entre clínicas distintas.
3. En el repo nuevo, actualiza `js/supabaseClient.js` con la URL y clave de
   ESE proyecto.
4. Personaliza `js/config.js` (nombre del negocio) y, si hace falta, la
   paleta en `css/styles.css` (`:root`) para la marca de esa clínica.
5. Activa GitHub Pages en el repo nuevo (`Settings` → `Pages`) para tener su
   URL propia.
6. Sigue los pasos de "Primer uso" y del modelo de seguridad de arriba para
   volverte admin de esa instancia.

Esto es "una instancia estática por clínica", no un único backend
multi-clínica — es lo más simple y seguro mientras sean pocos clientes. Si
en el futuro esto crece a muchas clínicas, ahí sí conviene evolucionar a una
arquitectura multi-tenant de verdad (una sola base de datos compartida con
una columna `clinic_id` en cada tabla), pero es un cambio de arquitectura
grande — no hace falta adelantarlo ahora.

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
