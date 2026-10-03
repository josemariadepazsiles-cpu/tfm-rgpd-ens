# Compliance AI · RGPD + ENS

## 1. Descripción general del proyecto

Compliance AI es una plataforma web para gestionar el cumplimiento del Reglamento General de
Protección de Datos (RGPD) y del Esquema Nacional de Seguridad (ENS) en una organización.

En muchas organizaciones ese cumplimiento se lleva en hojas de cálculo y documentos dispersos,
sin control de los plazos legales ni una visión de conjunto del estado de cada sistema.

Está dirigida a delegados de protección de datos, responsables de seguridad y de cumplimiento, y
administradores de organizaciones sujetas al RGPD y al ENS.

Lo que la distingue:

- **RGPD y ENS en torno al sistema de información:** actividades de tratamiento, riesgos,
  incidentes, solicitudes de derechos, evaluaciones ENS y procesos de continuidad se asocian a un
  sistema o quedan como transversales.
- **Panel de control con las acciones pendientes ordenadas por urgencia**, para toda la
  organización o para un sistema concreto.
- **Avisos automáticos de plazos legales:**
  - 72 horas para notificar una brecha a la AEPD;
  - un mes para responder a los derechos;
  - revisión periódica de las políticas;
  - pruebas de continuidad en los últimos 12 meses.
- **Declaración de Conformidad del ENS** generada a partir de una evaluación, versionada y con su
  documento PDF.

Proyecto desarrollado como Trabajo Fin de Máster. [COMPLETAR: máster, universidad y curso]

## 2. Stack tecnológico utilizado

Versiones instaladas según `package-lock.json`.

### Backend

| Tecnología | Versión | Para qué se usa en este proyecto |
|---|---|---|
| Node.js | ^20.19, ^22.12 o ≥ 24 (`engines`) | Ejecuta el servidor; es la versión mínima que exige Prisma 7. |
| Express | 5.2.1 | Servidor HTTP: un router por módulo, middlewares, archivos estáticos y manejo de errores (`app.js`). |
| multer | 2.4.0 | Recibe en memoria los PDF subidos a proveedores, derechos y políticas, con un máximo de 10 MB (`lib/subidas.js`). |
| pdfkit | 0.20.2 | Genera el PDF de la Declaración de Conformidad (`lib/pdfDeclaracion.js`) y los PDF de ejemplo de las políticas. |
| dotenv | 18.0.4 | Carga la configuración del archivo `.env`: conexión a la base de datos, secreto de sesión… |

### Base de datos y ORM

| Tecnología | Versión | Para qué se usa en este proyecto |
|---|---|---|
| PostgreSQL | — (no fijada en el proyecto) | Base de datos relacional (`provider = "postgresql"` en `prisma/schema.prisma`). |
| Neon | — | Alojamiento de PostgreSQL en la nube. `prisma.config.js` quita el «-pooler» de la URL para que las migraciones no se bloqueen. |
| Prisma (CLI) | 7.10.0 | Esquema de 25 modelos, 21 migraciones, generación del cliente y ejecución del seed. |
| @prisma/client | 7.10.0 | Consultas desde controladores y `lib/`, con un único cliente compartido (`lib/prisma.js`). |
| @prisma/adapter-pg | 7.10.0 | Conecta Prisma 7 a PostgreSQL con el driver `pg` y un pool de hasta 20 conexiones. |

### Frontend

| Tecnología | Versión | Para qué se usa en este proyecto |
|---|---|---|
| EJS | 6.0.1 | Plantillas de las pantallas, renderizadas en el servidor (`views/`). |
| Tailwind CSS | 4.3.3 | Estilos. La configuración está en `src/styles/input.css` y se compila a `public/css/output.css`. |
| Alpine.js | 3.x por CDN (jsDelivr; hoy sirve la 3.17.4) | Interactividad en el navegador: menús desplegables, pestañas, secciones plegables del panel y mostrar u ocultar la contraseña. |
| Lucide (`lucide-static`) | 1.48.0 | Iconos SVG que el servidor incrusta en el HTML (`lib/iconos.js`). |
| Inter (`@fontsource-variable/inter`) | 5.3.0 | Tipografía servida desde el propio servidor en `/fuentes`. |

### Autenticación y seguridad

| Tecnología | Versión | Para qué se usa en este proyecto |
|---|---|---|
| Passport | 0.7.0 | Inicio de sesión y recuperación del usuario en cada petición (`config/passport.js`). |
| passport-local | 1.0.0 | Estrategia de acceso con email y contraseña. |
| express-session | 1.19.0 | Sesión en la cookie `sid`: 8 h, HttpOnly, SameSite=Lax y Secure en producción. |
| bcryptjs | 3.0.3 | Hash de las contraseñas (coste 12) y comprobación en el login. |
| Middleware propio | — | `middlewares/seguridad.js`: cabeceras de seguridad (CSP, X-Frame-Options…), protección CSRF y límite de intentos de login, sin dependencias externas. |

### Herramientas de desarrollo

| Tecnología | Versión | Para qué se usa en este proyecto |
|---|---|---|
| @tailwindcss/cli | 4.3.3 | Compila los estilos (`npm run build:css` y `npm run watch:css`). |
| `node --watch` | la de Node.js | Reinicia el servidor al cambiar el código (`npm run dev`). |
| Pruebas propias (`tests/`) | — | Batería funcional con el `fetch` de Node, sin framework de tests; incluye copia y restauración de los datos (`npm test`). |

El proyecto no tiene configuración de linters, formateadores ni Docker. El despliegue en Render (script `build` y archivo `.node-version`) se explica en el apartado 3.8.

### Entorno de desarrollo y control de versiones

| Herramienta | Para qué se ha usado en este proyecto |
|---|---|
| Visual Studio Code | Editor de código principal: edición, terminal integrada y ejecución de la aplicación en local. |
| Git y GitHub | Control de versiones y alojamiento del repositorio del proyecto. `.gitattributes` fija el fin de línea LF de las migraciones. |

### Herramientas de IA utilizadas

| Herramienta | Para qué se ha usado en este proyecto |
|---|---|
| Claude Code (Anthropic) | Asistente de programación dentro del proyecto: generación y refactorización de código, pruebas de funcionamiento, comentarios del código y redacción de la documentación a partir del código real. |
| Claude (Anthropic) | Apoyo fuera del código: preparación de los prompts de trabajo y de una infografía del funcionamiento de la aplicación. |

Todo el código y la documentación generados con IA han sido revisados y validados por el autor.

## 3. Instalación y ejecución

### 3.1 Requisitos previos

- **Node.js 20.19 o superior** (también valen 22.12+ y 24+; es lo que exige Prisma 7). Comprueba la versión con `node -v`.
- **npm**, que se instala con Node.js.
- **Git**.
- **Una base de datos PostgreSQL** con codificación UTF-8: un proyecto en [Neon](https://neon.tech) o un PostgreSQL instalado en tu equipo. Probado con Neon y con PostgreSQL 18.

### 3.2 Clonar el repositorio

```bash
git clone https://github.com/josemariadepazsiles-cpu/tfm-rgpd-ens.git
cd tfm-rgpd-ens
```

### 3.3 Crear el archivo `.env`

Hazlo **antes** de instalar las dependencias: la instalación ejecuta `prisma generate`, que necesita que exista la variable `DATABASE_URL`.

```bash
cp .env.example .env
```

En Windows, con `cmd`: `copy .env.example .env`.

Después edita `.env` y rellena al menos las dos variables obligatorias:

| Variable | Descripción | Ejemplo (valor falso) | Obligatoria |
|---|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL que usa la aplicación. | `postgresql://usuario:clave@localhost:5432/tfm?schema=public` | Sí |
| `SESSION_SECRET` | Secreto que firma la cookie de sesión; sin él la aplicación no arranca. | `c0b1e5...` (cadena aleatoria larga) | Sí |
| `DIRECT_URL` | Conexión directa para las migraciones. Si se deja vacía, en Neon se calcula quitando «-pooler» de `DATABASE_URL`. | `postgresql://usuario:clave@ep-ejemplo-123.eu-central-1.aws.neon.tech/neondb?sslmode=require` | No |
| `PORT` | Puerto del servidor. | `3000` | No (por defecto 3000) |
| `NODE_ENV` | Entorno. En `production`, la cookie de sesión solo viaja por HTTPS y quedan bloqueados `db:ejemplo` y `npm test`. | `development` | No |
| `UPLOADS_DIR` | Carpeta donde se guardan los PDF subidos. | `uploads` | No (por defecto `uploads/`) |
| `SEED_ADMIN_EMAIL` | Email del administrador que crea `npm run seed`. | `admin@organizacion.es` | No |
| `SEED_ADMIN_PASSWORD` | Contraseña de ese administrador (mínimo 12 caracteres). Si se deja vacía, se genera una y se muestra una vez. | `Cambia-esta-clave-2026` | No |
| `TEST_URL` | Dirección de la aplicación en marcha para `npm test`. | `http://localhost:3000` | No |

**Cadena de conexión:**
- **En Neon:** en el panel del proyecto, botón **Connect**, copia la *connection string*.
- **En un PostgreSQL local:** `postgresql://<usuario>:<contraseña>@localhost:5432/<base_de_datos>`.

**Para generar `SESSION_SECRET`:**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3.4 Instalar las dependencias

```bash
npm install
```

Al terminar, genera automáticamente el cliente de Prisma (`postinstall`). Si más adelante cambias el esquema, regenéralo con `npm run prisma:generate`.

### 3.5 Preparar la base de datos

Crea las tablas aplicando las migraciones:

```bash
npx prisma migrate deploy
```

Carga los datos de prueba: una empresa ficticia con usuarios, sistemas, evaluaciones, incidentes, etc.

```bash
npm run db:ejemplo -- --confirmar
```

`db:ejemplo` **borra los datos que haya** (salvo las cuentas de usuario existentes) antes de cargar el ejemplo. Crea estas cuentas de prueba:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@test.com` | `admin1234` | Administrador |
| `elena.martin@labfarmareunidos.example`, `javier.ortega@…`, `marta.quintero@…` | `Ejemplo2026` | Administrador |
| `carmen.vidal@labfarmareunidos.example`, `andres.pena@…`, `lucia.fernandez@…`, `pablo.rubio@…`, `sergio.navas@…` | `Ejemplo2026` | Usuario |

La empresa de ejemplo («Laboratorios Farmacéuticos Reunidos») y todas las personas son ficticias. Estas credenciales son **solo para pruebas**: no las uses en un entorno real.

Si prefieres empezar sin datos de ejemplo, usa en su lugar:

```bash
npm run seed
```

Crea el administrador de `SEED_ADMIN_EMAIL`, que con el `.env` de ejemplo es `admin@organizacion.es`, con la contraseña de `SEED_ADMIN_PASSWORD` o una aleatoria que se muestra por pantalla. También crea 12 controles ENS básicos.

### 3.6 Arrancar en desarrollo

```bash
npm run build:css
npm run dev
```

Abre **http://localhost:3000** en el navegador: te llevará a la pantalla de acceso.

- El servidor se reinicia solo al cambiar el código.
- Si vas a modificar estilos, deja `npm run watch:css` abierto en otra terminal.

### 3.7 Arrancar en producción

```bash
npm run build:css
npm start
```

Con `NODE_ENV=production` la cookie de sesión exige HTTPS, así que hay que servir la aplicación detrás de un proxy con certificado. Las sesiones se guardan en la memoria del servidor (limitación conocida, ver [docs/PLAN.md](docs/PLAN.md)).

### 3.8 Despliegue en Render

Configuración de un *Web Service* de Node en Render, con la base de datos en Neon:

| Campo | Valor |
|---|---|
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm start` |
| Versión de Node | 24 (fijada en el archivo `.node-version`) |

`npm run build` genera el cliente de Prisma, compila el CSS de Tailwind y aplica las migraciones (`prisma migrate deploy`). Hace falta `--include=dev` porque, con `NODE_ENV=production`, npm no instalaría la CLI de Tailwind, que es una dependencia de desarrollo.

Variables de entorno en Render:
- `DATABASE_URL`: obligatoria. Cadena de conexión de Neon con pooler.
- `SESSION_SECRET`: obligatoria. Cadena aleatoria larga.
- `NODE_ENV=production`: necesaria para que la cookie de sesión sea segura (HTTPS) y la app confíe en el proxy de Render.
- `DIRECT_URL`: opcional. Sin ella, la URL directa para migrar se calcula quitando «-pooler».

Render asigna `PORT` por su cuenta.

Limitaciones del plan gratuito con la versión actual:
- **Sesiones en memoria:** se pierden al reiniciarse el servicio (cada despliegue o cuando la instancia se duerme por inactividad), y hay que volver a iniciar sesión.
- **Archivos subidos:** los PDF se guardan en el disco del servicio, que Render borra en cada reinicio. Los documentos subidos en local no existen en Render; la app muestra «Archivo no disponible» en lugar de fallar.
- **Arranque en frío:** la primera visita tras un rato sin uso tarda unos segundos, mientras la instancia se reactiva.

### 3.9 Problemas frecuentes

| Error | Solución |
|---|---|
| `npm install` falla con `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | Falta el archivo `.env`. Créalo (paso 3.3) y repite `npm install`. |
| La web se ve sin estilos | No se ha compilado el CSS, que no está en el repositorio. Ejecuta `npm run build:css`. |
| `db:ejemplo` falla con `has no equivalent in encoding "WIN1252"` | La base de datos local no está en UTF-8. Créala de nuevo con `CREATE DATABASE tfm ENCODING 'UTF8' TEMPLATE template0;`. |
| `npm install` avisa de vulnerabilidades altas | Vienen de herramientas de Prisma y de Tailwind CLI (paquetes como `mysql2`, `deepmerge-ts` o `braces`), no del código de la aplicación. **No ejecutes `npm audit fix --force`**: bajaría Prisma a la versión 6 y la aplicación dejaría de funcionar. |

## 4. Estructura del proyecto

Solo se muestran los archivos versionados. No aparecen `node_modules/`, `.env`, el CSS compilado (`public/css/`), `uploads/` ni `backups/`.

```text
tfm-rgpd-ens/
├── app.js                    Entrada del servidor: middlewares globales, montaje de las rutas, 404 y errores
├── prisma.config.js          Prisma: esquema, migraciones, comando del seed y URL directa para migrar en Neon
├── package.json              Dependencias y scripts (dev, start, seed, test, db:*)
├── .env.example              Plantilla de las variables de entorno
├── config/                   4 archivos
│   ├── passport.js           Login con email y contraseña; usuario de la sesión con sus sistemas asignados
│   ├── roles.js              Roles ADMIN y USUARIO con su etiqueta
│   ├── baseLegal.js          Bases de licitud del art. 6.1 RGPD para el RAT
│   └── legal.js              Datos ficticios del titular, DPD, encargados y cookies de las páginas legales
├── middlewares/
│   ├── auth.js               ensureAuthenticated, ensureAdmin y ensureGuest
│   └── seguridad.js          Cabeceras (CSP…), token CSRF en los formularios y límite de intentos de login
├── routes/                   Un router por módulo: rat.js, incidentes.js, politicas.js … (17 en total)
├── controllers/              Una acción por pantalla: ratController.js, incidenteController.js … (17 en total)
├── lib/                      Reglas de negocio y utilidades (23 módulos)
│   ├── prisma.js             Cliente único de Prisma con el adaptador pg
│   ├── incidentes.js         Plazo de 72 h para notificar a la AEPD e historial de estados
│   ├── derechos.js           Plazo de un mes, ampliación y urgencia de las solicitudes
│   ├── ens.js                Cálculo del % de cumplimiento ENS por categoría
│   ├── evaluaciones.js       Foto de controles de cada evaluación y guardado con histórico
│   ├── panel.js              Avisos y métricas de cada sistema para el panel de control
│   └── …                     riesgo.js, bia.js, politicas.js, declaraciones.js, pdfDeclaracion.js, subidas.js, formato.js…
├── views/                    Plantillas EJS (42 pantallas y 30 partials)
│   ├── dashboard.ejs         Panel de control
│   ├── error.ejs             Página de error 403, 404 y 500
│   ├── auth/login.ejs        Pantalla de acceso
│   ├── incidentes/           index.ejs (listado), show.ejs (ficha), form.ejs (alta/edición), historial.ejs
│   ├── …                     rat/, riesgos/, derechos/, proveedores/, sistemas/, evaluaciones/… (12 carpetas más)
│   ├── legal/                aviso-legal.ejs, privacidad.ejs y cookies.ejs
│   └── partials/             nav.ejs, head.ejs, pie.ejs, plazo-aepd.ejs … (30 en total)
├── src/styles/input.css      Fuente de Tailwind: tema, componentes (.btn, .card, .tabla…) y archivos que escanea
├── public/img/logo.svg       Logotipo (el CSS se compila en public/css/ y no se versiona)
├── prisma/
│   ├── schema.prisma         Modelo de datos: 25 modelos y 26 enums
│   ├── migrations/           21 migraciones SQL y migration_lock.toml
│   ├── seed.js               Carga mínima: administrador inicial y 12 controles ENS (npm run seed)
│   ├── seed-ejemplo.js       Empresa ficticia completa (npm run db:ejemplo)
│   └── …                     copia-seguridad.js, restaurar-copia.js, utilidades-datos.js, pdfs-politicas.js… (5 scripts más)
├── tests/
│   ├── ejecutar.js           npm test: copia de seguridad, pruebas y restauración
│   └── pruebas-funcionales.js   Unas 260 pruebas con peticiones HTTP reales
├── docs/                     PRD.md, ARQUITECTURA.md y PLAN.md
└── README.md, CHANGELOG.md, INFORME_PRUEBAS.md, CLAUDE.md, AGENTS.md, LICENSE
```

### Dónde está cada cosa

| Capa | Carpeta | Responsabilidad |
|---|---|---|
| Rutas | `routes/` | Asocian cada URL a una acción y aplican los permisos de acceso (`ensureAuthenticated`, `ensureAdmin`). Se montan en `app.js` con su prefijo (`/rat`, `/incidentes`…). |
| Controladores | `controllers/` | Leen y validan la petición, comprueban permisos finos («Administrador o responsable»), consultan los datos y eligen la vista o la redirección. |
| Vistas | `views/`, `src/styles/` | HTML con EJS: listado, ficha y formulario de cada módulo, más piezas comunes en `partials/`. Estilos con Tailwind. |
| Modelos de datos | `prisma/schema.prisma`, `prisma/migrations/` | Tablas, relaciones y valores permitidos (enums). Se accede a ellos con el cliente de `lib/prisma.js`. |
| Autenticación | `config/passport.js`, `middlewares/auth.js`, `controllers/authController.js` | Login, sesión, usuario activo y roles. |
| Seguridad y validación | `middlewares/seguridad.js`, `lib/permisos.js`, `lib/validacion.js` | CSRF, cabeceras, límite de intentos de login, ids válidos, permisos por responsable y longitud de los textos. |
| Lógica de negocio y cálculos | `lib/` | Plazos legales (`incidentes.js`, `derechos.js`, `formato.js`), nivel de riesgo (`riesgo.js`), % ENS (`ens.js`, `evaluaciones.js`), avisos del panel (`panel.js`, `dashboard.js`, `asistente.js`), declaraciones y su PDF. |
| Datos de prueba y mantenimiento | `prisma/*.js`, `tests/` | Seeds, copia y restauración de datos, y pruebas funcionales. |

### Recorrido de una petición

Ejemplo: abrir la ficha de un incidente, `GET /incidentes/7`.

1. **Middlewares globales (`app.js`):**
   - `middlewares/seguridad.js` añade las cabeceras de seguridad;
   - `express-session` y `config/passport.js` (`deserializeUser`) recuperan el usuario de la sesión con sus sistemas.
2. **Ruta:** `app.js` envía `/incidentes` a `routes/incidentes.js`. Ese router exige sesión con `ensureAuthenticated` (`middlewares/auth.js`) y asigna `GET /:id` a `show`.
3. **Controlador:** en `controllers/incidenteController.js`, `show` llama a `buscar`:
   - valida el id con `idValido` (`lib/permisos.js`) y lee el incidente con Prisma (`lib/prisma.js`);
   - calcula el plazo de 72 h con `plazoAepd` (`lib/incidentes.js`) y si el usuario puede gestionarlo.
4. **Vista:** `res.render('incidentes/show')` pinta `views/incidentes/show.ejs` con sus partials (`nav`, `plazo-aepd`, `incidente-badges`, `pie`). Antes de enviar el HTML, `middlewares/seguridad.js` añade el token CSRF a cada formulario.

### Modelo de datos

Los 25 modelos de `prisma/schema.prisma`:

**Organización, usuarios y sistemas**
- **Organizacion**: ficha de la empresa (una sola fila, sin relaciones).
- **Usuario**: persona con acceso (rol, cargo, activo). Es autor o responsable de casi todos los registros.
- **UsuarioSistema**: sistemas en los que trabaja cada usuario (relación Usuario ↔ Sistema).
- **Sistema**: eje de la aplicación.
  - Tiene evaluaciones y declaraciones.
  - Puede estar asociado a actividades RAT, riesgos, incidentes, solicitudes, políticas y procesos BIA.

**ENS**
- **ControlEns**: control del catálogo ENS; se evalúa en `EvaluacionControl`.
- **Evaluacion**: evaluación ENS de un Sistema; tiene sus `EvaluacionControl`.
- **EvaluacionControl**: estado, evidencia y responsable (Usuario) de un control en una evaluación.
- **HistorialEstado**: cada cambio de estado de un `EvaluacionControl`, con su autor.
- **DeclaracionConformidad**: declaración versionada de un Sistema, generada desde una Evaluacion (opcional si esta se borra).
- **DetalleDeclaracionControl**: copia congelada de cada control en una declaración.

**RGPD**
- **ActividadRat**: actividad de tratamiento con un Usuario responsable obligatorio y Sistema opcional; tiene riesgos.
- **Riesgo**: riesgo de una ActividadRat, con nivel calculado y Sistema opcional.
- **Incidente**: incidente o brecha con Sistema opcional, creador y responsable.
- **HistorialIncidente**: cambios de estado de un Incidente.
- **SolicitudDerecho**: solicitud de un interesado con Sistema opcional y responsable.
- **HistorialSolicitudDerecho**: cambios de estado o de plazo de una SolicitudDerecho.
- **DocumentoSolicitudDerecho**: PDF adjuntos a una SolicitudDerecho.
- **Proveedor**: encargado del tratamiento, con creador y responsable.
- **DocumentoProveedor**: PDF adjuntos a un Proveedor.

**Políticas y continuidad**
- **Politica**: documento normativo, General o de un Sistema; con creador y aprobador.
- **ArchivoPolitica**: PDF de cada versión de una Politica.
- **DocumentoPolitica**: adjuntos de una Politica (anexos, plantillas…).
- **AceptacionPolitica**: aceptación de una versión de una Politica por un Usuario.
- **ProcesoNegocio**: proceso del BIA con Sistema opcional y responsable.
- **PruebaContinuidad**: prueba del plan de continuidad de un ProcesoNegocio.

## 5. Funcionalidades principales

### Acceso, usuarios y roles
- Inicia sesión con email y contraseña. Las cuentas desactivadas no pueden entrar y pierden la sesión abierta.
- Gestiona los usuarios (alta, edición, cargo, rol y sistemas en los que trabajan) y los activa o desactiva sin borrar su historial.
- Mantiene los datos de la empresa, cuyo nombre aparece en la cabecera de todas las pantallas.
- Ofrece el aviso legal, la política de privacidad y la de cookies, accesibles sin sesión desde el pie de cada pantalla.

### Inicio (panel de control)
- Resume el estado en cuatro tarjetas: cumplimiento ENS, acciones pendientes, incidentes abiertos y próximo vencimiento.
- Lista las acciones pendientes ordenadas por urgencia, indicando el sistema al que se refiere cada una.
- Filtra todo el panel por un sistema («Ver por sistema») y muestra la actividad reciente de los historiales.

### Sistemas de información
- Registra los sistemas de información con su categoría ENS y descripción.
- Reúne en la ficha de cada sistema sus actividades RAT, riesgos, incidentes, solicitudes, evaluaciones, declaraciones y procesos BIA.
- Crea evaluaciones ENS del sistema, partiendo de cero o copiando la anterior.
- Permite marcar cada control como Implementado, Pendiente o No aplicable, con evidencia y responsable.
- Guarda el histórico de cambios de estado de los controles, filtrable por evaluación y por control.

### RGPD
- **Actividades RAT:** registra las actividades de tratamiento con finalidad, base legal, datos e interesados, destinatarios, conservación, medidas y transferencias.
- **Riesgos:** evalúa cada riesgo de una actividad por probabilidad e impacto y lo filtra por nivel, sistema o actividad.
- **Incidentes / Brechas:** registra incidentes y brechas, su notificación a la AEPD y a los afectados, y guarda su historial de estados.
- **Derechos de los Interesados:** tramita las solicitudes por estados, amplía el plazo o deniega con motivo y adjunta documentos PDF.
- **Proveedores:** registra a los encargados del tratamiento con su contrato, nivel ENS, transferencias internacionales y documentos PDF.
- Filtra los listados por sistema o por «sin sistema» (registros transversales).

### ENS
- **Catálogo de controles:** mantiene los controles del ENS con su categoría y descripción.
- **Declaraciones de Conformidad:** genera la declaración a partir de una evaluación, como foto fija versionada; permite añadir observaciones, emitirla y verla en PDF.
- **Políticas y Documentación:** publica documentos normativos, generales o de un sistema, con versiones en PDF, estados y documentos adjuntos.
- Registra qué usuarios han aceptado cada versión de una política y muestra a cada uno las que tiene pendientes.
- **BIA y Continuidad:** analiza los procesos de negocio (criticidad, impactos, RTO y RPO, estrategia) y registra sus pruebas de continuidad.

### Automatismos
- **Notificación de brechas:** calcula el plazo de 72 h desde la fecha de detección. Avisa cuando está pendiente y lo marca como vencido al superarlo.
- **Solicitudes de derechos:** fija la fecha límite en un mes desde la recepción (mismo día del mes siguiente, 23:59:59 hora de España). La ampliación de 2 meses solo se admite dentro del primer mes.
- **Urgencia de las solicitudes:** verde con más de 10 días, amarillo con 10 o menos y rojo si ha vencido sin resolver.
- **Nivel de riesgo:** probabilidad × impacto, de 1 a 3 cada uno. Bajo de 1 a 2, Medio de 3 a 4 y Alto de 6 a 9.
- **Cumplimiento ENS:** implementados ÷ (controles − No aplicables), redondeado a entero. Por sistema se toma su última evaluación; para la organización, la media de los sistemas evaluados.
- **Pruebas de continuidad:** vigila que los procesos de criticidad Alta o Crítica tengan una prueba en los últimos 12 meses. Avisa 30 días antes de que caduque.
- **Declaraciones de Conformidad:** considera vigente una declaración emitida durante 12 meses. Al generar una versión nueva, las anteriores pasan a «Superada».
- **Revisión de políticas:** avisa 30 días antes de la fecha de revisión y la marca como vencida al pasarla.
- **Proveedores:** avisa de los que no tienen contrato de encargado, de los que tienen la revisión del contrato vencida o a 30 días o menos, y de las transferencias fuera del EEE sin mecanismo de garantía.
- **Panel de control:** ordena las acciones de crítico a atención y a informativo, y destaca el plazo que vence antes.
- **Acceso:** bloquea durante 15 minutos el acceso tras 5 intentos fallidos seguidos con el mismo email. Cierra la sesión a las 8 horas.

### Qué puede hacer cada rol

| Rol | Qué puede hacer |
|---|---|
| Administrador | Todo lo que puede hacer el Usuario, y además:<br>• gestiona sistemas, evaluaciones, catálogo de controles, Declaraciones de Conformidad, políticas, proveedores, procesos BIA, datos de la empresa y usuarios;<br>• asigna responsables;<br>• es el único que elimina registros. |
| Usuario | • Consulta todos los módulos.<br>• Registra actividades RAT y riesgos (solo ve y edita los suyos), incidentes y solicitudes de derechos.<br>• Gestiona lo que tiene asignado como responsable y se asigna controles ENS libres.<br>• Acepta las políticas que le afectan. |
| Sin sesión | Solo accede a la pantalla de inicio de sesión y a las páginas legales. |

## 6. Usuario y contraseña de prueba

Acceso en **http://localhost:3000/login**. Los usuarios se crean al cargar los datos de ejemplo con `npm run db:ejemplo -- --confirmar` (paso [3.5](#35-preparar-la-base-de-datos)). Todos pertenecen a la organización ficticia «Laboratorios Farmacéuticos Reunidos».

| Rol | Email | Contraseña | Qué puede hacer y ver |
|---|---|---|---|
| Administrador | `admin@test.com` | `admin1234` | Todo: gestión de sistemas, evaluaciones, catálogo de controles, declaraciones, políticas, proveedores, BIA, datos de la empresa y usuarios; es el único rol que elimina registros. |
| Administrador | `elena.martin@labfarmareunidos.example` | `Ejemplo2026` | Igual que el anterior. En los datos de ejemplo es la Directora General y Responsable de la Información; no tiene sistema asignado. |
| Administrador | `javier.ortega@labfarmareunidos.example` | `Ejemplo2026` | Igual que el anterior. Es el Delegado de Protección de Datos; no tiene sistema asignado. |
| Administrador | `marta.quintero@labfarmareunidos.example` | `Ejemplo2026` | Igual que el anterior. Es la Responsable de Seguridad, asignada al sistema «Área de informática». |
| Usuario | `carmen.vidal@labfarmareunidos.example` | `Ejemplo2026` | Consulta todos los módulos. Solo ve y edita sus actividades RAT y sus riesgos, y gestiona lo que tiene asignado. Acepta las políticas generales y las de «Área financiera». |
| Usuario | `andres.pena@labfarmareunidos.example` | `Ejemplo2026` | Lo mismo que un Usuario. Es el Responsable del Sistema, asignado a «Área de informática». |
| Usuario | `lucia.fernandez@labfarmareunidos.example` | `Ejemplo2026` | Lo mismo que un Usuario. Es la directora técnica de laboratorio, asignada a «Área de laboratorio». |
| Usuario | `pablo.rubio@labfarmareunidos.example` | `Ejemplo2026` | Lo mismo que un Usuario. Es el responsable de farmacovigilancia, asignado a «Área de laboratorio». |
| Usuario | `sergio.navas@labfarmareunidos.example` | `Ejemplo2026` | Lo mismo que un Usuario. Es el técnico de nóminas, asignado a «Área financiera». |

> **Credenciales de demostración:** todos los datos de estas cuentas (nombres, cargos, emails) son ficticios y las contraseñas son públicas. En un entorno real hay que cambiarlas o eliminar estas cuentas. `npm run db:ejemplo` se niega a ejecutarse con `NODE_ENV=production`.

## 7. Módulos

| Área | Módulo | Ruta |
|---|---|---|
| General | Panel de control (global o por sistema) | `/dashboard` |
| General | Sistemas de información | `/sistemas` |
| RGPD | Actividades de tratamiento (RAT, art. 30) | `/rat` |
| RGPD | Evaluación de riesgos | `/riesgos` |
| RGPD | Incidentes y brechas (arts. 33-34, plazo de 72 h) | `/incidentes` |
| RGPD | Derechos de los interesados (art. 12, plazo de un mes) | `/derechos` |
| RGPD | Proveedores / encargados del tratamiento (art. 28) | `/proveedores` |
| ENS | Catálogo de controles (solo Administrador) | `/controles` |
| ENS | Evaluaciones ENS (checklist por sistema) | `/evaluaciones/:id` |
| ENS | Declaraciones de Conformidad (con PDF) | `/declaraciones` |
| ENS | Políticas y documentación (con aceptación por los usuarios) | `/politicas` |
| ENS | BIA y continuidad | `/bia` |
| Administración | Datos de la empresa | `/empresa` |
| Administración | Usuarios (solo Administrador) | `/usuarios` |
| Público | Aviso legal, Política de privacidad y Política de cookies (sin iniciar sesión) | `/aviso-legal`, `/privacidad`, `/cookies` |

Todas las pantallas, incluido el login, tienen un pie con los enlaces a las tres páginas legales. Esas páginas indican que la web y sus datos son **ficticios** (proyecto académico); los datos del titular se cambian en un solo sitio, [config/legal.js](config/legal.js).

El detalle funcional de cada módulo está en [docs/PRD.md](docs/PRD.md).

## 8. Arquitectura y estructura del proyecto

```mermaid
flowchart LR
  N[Navegador] -->|HTTP| E[Express 5]
  E --> M[Middlewares<br/>seguridad · sesión · Passport · CSRF]
  M --> R[routes/]
  R --> C[controllers/]
  C --> L[lib/<br/>reglas de negocio]
  C --> V[views/ EJS + Tailwind + Alpine.js]
  L --> P[Prisma 7 + adaptador pg]
  P --> DB[(PostgreSQL / Neon)]
  C --> U[uploads/<br/>PDF subidos]
```

El detalle de capas, modelo de datos y decisiones técnicas está en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

Estructura de carpetas:

```text
app.js            Entrada del servidor: configuración de Express y montaje de rutas
config/           Passport (login y sesión), roles, bases legales y datos de las páginas legales
middlewares/      Control de acceso (auth.js) y seguridad: cabeceras, CSRF, límite de login
routes/           Una ruta por módulo (URL → controlador y permisos)
controllers/      Lógica de cada pantalla: lee la petición, valida, consulta y pinta la vista
lib/              Reglas de negocio y utilidades compartidas (plazos, % ENS, riesgo, PDF…)
views/            Plantillas EJS por módulo y partials/ comunes
src/styles/       Hoja de estilos de Tailwind (se compila a public/css/output.css)
public/           Archivos estáticos (CSS compilado, logo)
prisma/           Esquema, migraciones, seeds y scripts de datos (copia, restauración…)
tests/            Pruebas funcionales (npm test)
docs/             PRD, arquitectura y plan del proyecto
uploads/          PDF subidos (no se versiona)
backups/          Copias de seguridad de los datos (no se versiona)
```

## 9. Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca el servidor y lo reinicia al cambiar el código (`node --watch`). |
| `npm start` | Arranca el servidor (producción). |
| `npm run build` | Prepara el despliegue: genera el cliente de Prisma, compila el CSS y aplica las migraciones. |
| `npm run build:css` / `npm run watch:css` | Compila Tailwind una vez / en modo vigilancia. |
| `npm run prisma:migrate` | Crea y aplica una migración nueva en desarrollo (`prisma migrate dev`). |
| `npx prisma migrate deploy` | Aplica las migraciones pendientes (instalación, otro equipo, producción). |
| `npm run prisma:generate` | Regenera el cliente de Prisma. |
| `npm run seed` (o `npm run prisma:seed`) | Carga mínima: administrador inicial y 12 controles ENS básicos. No borra nada. |
| `npm run db:ejemplo -- --confirmar` | **Borra los datos** (salvo las cuentas existentes) y carga la empresa de ejemplo. Bloqueado con `NODE_ENV=production`. |
| `npm run db:copia` | Copia de seguridad de todos los datos en `backups/copia-AAAAMMDD-HHMMSS.json`. |
| `npm run db:restaurar -- <copia.json> --confirmar` | Restaura una copia (**borra los datos actuales**). |
| `npm run db:descripciones` | Rellena la descripción de los controles del Anexo II que no la tengan. |
| `npm run db:pdfs-politicas` | Genera un PDF de ejemplo para las políticas que aún no tienen documento vigente (lo ejecuta también `db:ejemplo`). |
| `npm test` | Batería de pruebas funcionales (ver el apartado 10). |

### Problemas frecuentes durante el desarrollo

Los de la instalación están en el apartado 3.9.

| Síntoma | Causa y solución |
|---|---|
| `Cannot read properties of undefined` sobre un modelo (p. ej. `prisma.organizacion`) | El cliente de Prisma no está al día: `npm run prisma:generate`. |
| En Windows, `prisma generate` falla con `EPERM` | El servidor tiene abiertos los archivos de Prisma: páralo, genera y vuelve a arrancar. |
| `prisma migrate dev` pide hacer *reset* por un *checksum* distinto | Se ha editado una migración ya aplicada. No se tocan: deshaz el cambio y crea una migración nueva. Los finales de línea de las migraciones están fijados en `.gitattributes`. |
| `prisma migrate dev` dice que el entorno no es interactivo | Ocurre en algunas terminales: aplica con `npx prisma migrate deploy` (o crea la migración a mano). |
| Las migraciones se quedan bloqueadas con Neon | El pooler retiene el bloqueo de Prisma: usa la conexión directa (`DIRECT_URL`, ver `prisma.config.js`). |
| Aviso `SECURITY WARNING: The SSL modes 'prefer', 'require'…` | Es solo un aviso del driver `pg`. Para quitarlo, usa `sslmode=verify-full` en `DATABASE_URL`. |
| `EADDRINUSE` al arrancar | Ya hay otro proceso en el puerto 3000: ciérralo o cambia `PORT`. |

## 10. Pruebas

`npm test` ejecuta unas 260 pruebas funcionales con peticiones HTTP reales: acceso, roles, los diez
módulos, cálculos, panel y seguridad.

1. **Requisitos:** la aplicación tiene que estar en marcha (`npm run dev`; si usa otro puerto, indícalo en `TEST_URL`) y los datos de ejemplo cargados.
2. **Antes de empezar:** el script hace una **copia de seguridad**.
3. **Durante las pruebas:** se crean, editan y borran registros.
4. **Al terminar:** **restaura** la copia y borra los archivos de prueba de `uploads/`, aunque alguna prueba falle.
5. **Resultados:** el detalle queda en `tests/resultados.json`.

Úsalo contra una base de datos de desarrollo o de pruebas, nunca contra producción.
El informe de la última revisión completa está en [INFORME_PRUEBAS.md](INFORME_PRUEBAS.md).

## 11. Cookies

La aplicación solo usa elementos técnicos, por lo que no muestra banner de consentimiento:
- la cookie de sesión `sid`, que se crea al iniciar sesión y dura 8 horas;
- una entrada de almacenamiento local que recuerda las secciones desplegadas del panel.

Sin sesión no se crea ninguna cookie. El detalle está en [/cookies](http://localhost:3000/cookies) y en `config/legal.js`. Si se añadiera una cookie no técnica (por ejemplo, de analítica), habría que pedir consentimiento antes de instalarla y actualizar esa página.

## 12. Documentación

- [docs/PRD.md](docs/PRD.md): requisitos del producto, roles y reglas de negocio.
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): capas, recorrido de una petición, modelo de datos y decisiones técnicas.
- [docs/PLAN.md](docs/PLAN.md): fases del proyecto, lo hecho y lo pendiente.
- [CHANGELOG.md](CHANGELOG.md): historial de cambios.
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): guía para asistentes de programación.

## 13. Licencia

[MIT](LICENSE) © 2026 José María de Paz Siles
