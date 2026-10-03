# CLAUDE.md

Guía para asistentes de programación que trabajen en este repositorio.

## Qué es

Compliance AI: aplicación web (TFM) para gestionar el cumplimiento del RGPD y del ENS
(RD 311/2022) de una organización. El **sistema de información** es el eje: RAT, riesgos,
incidentes, derechos, evaluaciones ENS y procesos BIA se asocian a un sistema o son transversales.

## Stack

Node.js (≥ 20.19) · Express 5 · EJS · Tailwind CSS 4 · Alpine.js (CDN) · Passport (local) +
express-session · Prisma 7 con `@prisma/adapter-pg` · PostgreSQL (Neon) · multer · pdfkit · bcryptjs.

## Comandos

```bash
npm install                        # dependencias + prisma generate
npm run dev                        # servidor con recarga (http://localhost:3000)
npm start                          # servidor sin recarga
npm run build:css                  # compila Tailwind (output.css no se versiona)
npm run prisma:migrate             # nueva migración en desarrollo (prisma migrate dev)
npx prisma migrate deploy          # aplicar migraciones pendientes
npm run seed                       # admin inicial + 12 controles básicos (no borra nada)
npm run db:ejemplo -- --confirmar  # BORRA los datos y carga la empresa de ejemplo
npm run db:copia                   # copia de seguridad en backups/
npm test                           # pruebas funcionales (app en marcha + datos de ejemplo)
```

Credenciales de demostración (solo tras `db:ejemplo`): `admin@test.com` / `admin1234`
(Administrador) y `carmen.vidal@labfarmareunidos.example` / `Ejemplo2026` (Usuario).

## Estructura

```text
app.js          entrada: middlewares globales, montaje de rutas, 404 y manejador de errores
config/         passport.js (login y sesión), roles.js, baseLegal.js, legal.js (datos ficticios de las páginas legales)
middlewares/    auth.js (ensureAuthenticated, ensureAdmin, ensureGuest), seguridad.js
routes/         un router por módulo, montado en app.js con su prefijo (/rat, /riesgos…)
controllers/    <modulo>Controller.js
lib/            reglas de negocio y utilidades (plazos, % ENS, riesgo, panel, PDF, subidas…)
views/<modulo>/ index.ejs (listado), show.ejs (ficha), form.ejs (alta/edición); partials/ comunes
prisma/         schema.prisma, migrations/, seed.js, seed-ejemplo.js, scripts de copia/restauración
tests/          ejecutar.js (copia → batería → restaura) y pruebas-funcionales.js
docs/           PRD.md, ARQUITECTURA.md, PLAN.md
```

## Convenciones que ya sigue el código

- **Idioma:** español en identificadores, comentarios, mensajes y commits (`leerFormulario`, `fecha_limite`, `esAdmin`).
- **Nombres:**
  - camelCase en JavaScript;
  - snake_case en los campos de Prisma/BD (`sistema_id`, `created_at`);
  - modelos en PascalCase singular, tablas en plural con `@@map`.
- **Patrón:** ruta → controlador → (lib) → vista.
  - Funciones habituales de un controlador: `buscar`, `leerFormulario`, `validar`, `renderFormulario`, `list`, `show`, `newForm`, `create`, `editForm`, `update`, `remove`.
  - Exportan solo las acciones.
- **Validación:**
  - si hay errores, se vuelve a pintar el formulario con estado **400** y la lista de errores;
  - si todo va bien, `req.session.flash = { tipo, mensaje }` y **redirección** (patrón PRG);
  - si no existe, página `error` con **404**.
- **Ids** de URL y formularios: `idValido` / `idDeFormulario` (`lib/permisos.js`), que limitan a INTEGER y evitan errores 500.
- **Textos:** longitudes máximas en `lib/validacion.js` (servidor) y `maxlength` en los formularios.
- **Fechas:**
  - siempre en hora de España con `lib/formato.js`;
  - los campos `date` y `datetime-local` se leen con `desdeInputFecha` / `desdeInputFechaHora`, que rechazan fechas imposibles.
- **Etiquetas y colores** de cada enum en `lib/<modulo>.js`. Las clases de Tailwind van completas, porque Tailwind escanea esos archivos.
- **Comentarios:**
  - JSDoc breve en cada función;
  - en controladores, «MÉTODO ruta · rol»;
  - en línea, solo el porqué y las reglas de negocio.

## Autenticación, roles y organización

- **Login:**
  - Passport local con email y contraseña (bcrypt);
  - en la sesión solo se guarda el id;
  - `deserializeUser` añade `req.user.sistemaIds`.
  - Un usuario desactivado no entra y pierde la sesión.
- **Roles:**
  - `ADMIN`: gestiona la estructura (sistemas, catálogo, políticas, proveedores, usuarios, empresa) y elimina;
  - `USUARIO`: trabaja sobre lo suyo.
- **Permisos en dos niveles:**
  - en la ruta, `ensureAuthenticated` / `ensureAdmin`;
  - en el controlador, «Administrador o responsable» (`esAdminOResponsable`) para incidentes, derechos, BIA, documentos de proveedores y controles ENS;
  - RAT y riesgos: un Usuario solo ve los suyos (`ambitoActividad` / `ambitoRiesgo`).
- **CSRF:** `middlewares/seguridad.js` añade el token a todo `<form method="POST">` al renderizar. Un POST desde JavaScript tendría que enviar `_csrf`.
- **Organización:** una sola fila en `organizacion` (no es multiempresa), cacheada 1 minuto (`lib/organizacion.js`).

## Páginas públicas y pie legal

- **Rutas públicas:** `/login` y las páginas legales (`/aviso-legal`, `/privacidad`, `/cookies`, en `routes/legal.js`), que no exigen sesión.
- **Datos del titular, DPD, encargados, plazos y cookies:** están en `config/legal.js`; no se escriben en las vistas.
- **Toda vista nueva** debe incluir `partials/pie` antes de `</body>`.
- **Cookies:** solo hay técnicas (`sid` y almacenamiento local de los plegables). Una cookie o un script de terceros nuevo exige actualizar `/cookies` y `/privacidad` y, si no es técnico, pedir consentimiento.

## Lo que NO se debe hacer

- Leer, mostrar, modificar o subir `.env`. Las variables nuevas se documentan en `.env.example`.
- Editar o borrar una migración ya aplicada: Prisma detecta el cambio de checksum y pide resetear la base de datos. Siempre migración nueva.
- Ejecutar `db:ejemplo`, `db:restaurar` o `npm test` contra producción: borran o sustituyen datos.
- Subir `uploads/` o `backups/` (contienen datos personales) ni `public/css/output.css`.
- Escribir contraseñas en el código. Solo `seed-ejemplo.js` las tiene, a propósito y bloqueado en producción.
- Pintar datos del usuario con `<%- %>`: siempre `<%= %>`. `<%-` solo para `include()` e `icono()`.
- Quitar la protección CSRF de un formulario o crear rutas POST multipart que no sean de subida.
- Calcular el nivel de riesgo, los plazos o el % ENS en las vistas: van en `lib/`.

## Errores habituales vistos en este código

- **Prisma sin regenerar:** tras cambiar `schema.prisma` hay que ejecutar `npx prisma generate`; si no, `prisma.<modelo>` es `undefined`. En Windows, con el servidor parado (EPERM).
- **Ids enormes:** un id mayor que INTEGER sin `idValido` provoca un error P2020 (500).
- **Migraciones con CRLF:** Git en Windows puede convertir los saltos de línea y cambiar el checksum. `.gitattributes` fija LF en `prisma/migrations`.
- **Web sin estilos tras clonar:** falta `npm run build:css`.
- **Reinicios espontáneos de `npm run dev`:** `node --watch` en Windows a veces detecta cambios falsos y reinicia. Si una petición falla con ECONNREFUSED, espera un segundo.
- **Evaluaciones como foto:**
  - cada evaluación guarda sus propios controles (`crearFilasEvaluacion`);
  - un control nuevo del catálogo solo entra en la evaluación vigente de cada sistema;
  - el % se calcula sobre las filas de la evaluación, no sobre el catálogo.
- **Pendientes conocidos:** ver la lista de fallos de la revisión de comentarios en [docs/PLAN.md](docs/PLAN.md) (MemoryStore de sesiones, plazos en días hábiles, etc.).
