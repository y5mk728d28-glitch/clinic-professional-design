# Clinic Professional Design

Plataforma web multi-rol para clínicas de salud (caso base: clínica dental).
Diseñada como una base reutilizable: el motor (agenda, cuentas, catálogo de
tratamientos, notificaciones) es genérico; lo que cambia por negocio vive en
`js/config.js` y en la paleta de `css/styles.css`.

Estado actual: **maqueta funcional con datos simulados** (todo se guarda en
`localStorage` del navegador). No hay backend ni login real todavía —
es la fase de diseño/UX antes de conectar un servidor.

## Cómo probarla

No requiere instalación ni build. Sirve los archivos estáticos con cualquier
servidor local, por ejemplo:

```bash
python3 -m http.server 8080
# abre http://localhost:8080
```

(Abrir `index.html` directamente con doble clic también funciona, salvo el
Service Worker que necesita http/https).

### Login de prueba (mock)

En la pantalla de "Iniciar sesión", el usuario decide el rol:

| Usuario | Rol                        |
|---------|-----------------------------|
| `1`     | Paciente                    |
| `2`     | Doctor                      |
| `3`     | Administrador / Recepcionista |

La contraseña acepta cualquier valor. Si no hay una cuenta registrada de ese
rol, se crea automáticamente una cuenta demo para poder navegar el dashboard.

## Roles

- **Paciente**: calendario de disponibilidad (azul = disponible, rojo =
  completo, blanco = no disponible), filtro por doctor, selección de
  tratamiento con precio/duración estimados, historial de citas y
  calificación al doctor tras la cita.
- **Doctor**: agenda con sus citas (sincronizada con las reservas de
  pacientes — un horario ocupado no puede volver a reservarse), solicitud de
  cambio/cancelación hacia el administrador, lista de pacientes atendidos y
  su calificación promedio.
- **Administrador / Recepcionista**: catálogo de tratamientos (nombre,
  duración, precio), roster de doctores con su agenda, cola de solicitudes
  de citas (aprobar, denegar, reasignar doctor, reprogramar), listado de
  pacientes y sus datos (sin contraseñas).

Cada rol comparte una pestaña de **Ajustes** (nombre, correo, teléfono,
idioma, edad, mantener sesión iniciada).

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
index.html          Shell de la app (SPA con enrutado por hash)
css/styles.css       Paleta, componentes, layout
js/app.js            Vistas, enrutado y lógica de UI
js/i18n.js           Traducciones (es/en/de)
js/db.js             Persistencia simulada (localStorage) — capa a
                     reemplazar por API real cuando exista backend
js/calendar.js       Generación de calendario y franjas horarias
js/config.js         Configuración por negocio (nombre, textos variables)
manifest.json, sw.js Soporte PWA (instalar en pantalla de inicio)
```

## Próximos pasos

- Video explicativo de instalación PWA en la pantalla de bienvenida.
- Backend real + autenticación (reemplazar `js/db.js`).
- Sección de preguntas y respuestas.
- Posible 4to rol por encima del administrador (dueño/jefe).
