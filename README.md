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

El proyecto no tiene configuración de linters, formateadores, Docker ni despliegue.

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

### 3.8 Problemas frecuentes

| Error | Solución |
|---|---|
| `npm install` falla con `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL` | Falta el archivo `.env`. Créalo (paso 3.3) y repite `npm install`. |
| La web se ve sin estilos | No se ha compilado el CSS, que no está en el repositorio. Ejecuta `npm run build:css`. |
| `db:ejemplo` falla con `has no equivalent in encoding "WIN1252"` | La base de datos local no está en UTF-8. Créala de nuevo con `CREATE DATABASE tfm ENCODING 'UTF8' TEMPLATE template0;`. |
| `npm install` avisa de vulnerabilidades altas | Vienen de herramientas de Prisma y de Tailwind CLI (paquetes como `mysql2`, `deepmerge-ts` o `braces`), no del código de la aplicación. **No ejecutes `npm audit fix --force`**: bajaría Prisma a la versión 6 y la aplicación dejaría de funcionar. |

## 4. Módulos

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

## 5. Arquitectura y estructura del proyecto

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

## 6. Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca el servidor y lo reinicia al cambiar el código (`node --watch`). |
| `npm start` | Arranca el servidor (producción). |
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
| `npm test` | Batería de pruebas funcionales (ver el apartado 7). |

### Problemas frecuentes durante el desarrollo

Los de la instalación están en el apartado 3.8.

| Síntoma | Causa y solución |
|---|---|
| `Cannot read properties of undefined` sobre un modelo (p. ej. `prisma.organizacion`) | El cliente de Prisma no está al día: `npm run prisma:generate`. |
| En Windows, `prisma generate` falla con `EPERM` | El servidor tiene abiertos los archivos de Prisma: páralo, genera y vuelve a arrancar. |
| `prisma migrate dev` pide hacer *reset* por un *checksum* distinto | Se ha editado una migración ya aplicada. No se tocan: deshaz el cambio y crea una migración nueva. Los finales de línea de las migraciones están fijados en `.gitattributes`. |
| `prisma migrate dev` dice que el entorno no es interactivo | Ocurre en algunas terminales: aplica con `npx prisma migrate deploy` (o crea la migración a mano). |
| Las migraciones se quedan bloqueadas con Neon | El pooler retiene el bloqueo de Prisma: usa la conexión directa (`DIRECT_URL`, ver `prisma.config.js`). |
| Aviso `SECURITY WARNING: The SSL modes 'prefer', 'require'…` | Es solo un aviso del driver `pg`. Para quitarlo, usa `sslmode=verify-full` en `DATABASE_URL`. |
| `EADDRINUSE` al arrancar | Ya hay otro proceso en el puerto 3000: ciérralo o cambia `PORT`. |

## 7. Pruebas

`npm test` ejecuta unas 260 pruebas funcionales con peticiones HTTP reales: acceso, roles, los diez
módulos, cálculos, panel y seguridad.

1. **Requisitos:** la aplicación tiene que estar en marcha (`npm run dev`; si usa otro puerto, indícalo en `TEST_URL`) y los datos de ejemplo cargados.
2. **Antes de empezar:** el script hace una **copia de seguridad**.
3. **Durante las pruebas:** se crean, editan y borran registros.
4. **Al terminar:** **restaura** la copia y borra los archivos de prueba de `uploads/`, aunque alguna prueba falle.
5. **Resultados:** el detalle queda en `tests/resultados.json`.

Úsalo contra una base de datos de desarrollo o de pruebas, nunca contra producción.
El informe de la última revisión completa está en [INFORME_PRUEBAS.md](INFORME_PRUEBAS.md).

## 8. Cookies

La aplicación solo usa elementos técnicos, por lo que no muestra banner de consentimiento:
- la cookie de sesión `sid`, que se crea al iniciar sesión y dura 8 horas;
- una entrada de almacenamiento local que recuerda las secciones desplegadas del panel.

Sin sesión no se crea ninguna cookie. El detalle está en [/cookies](http://localhost:3000/cookies) y en `config/legal.js`. Si se añadiera una cookie no técnica (por ejemplo, de analítica), habría que pedir consentimiento antes de instalarla y actualizar esa página.

## 9. Documentación

- [docs/PRD.md](docs/PRD.md): requisitos del producto, roles y reglas de negocio.
- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): capas, recorrido de una petición, modelo de datos y decisiones técnicas.
- [docs/PLAN.md](docs/PLAN.md): fases del proyecto, lo hecho y lo pendiente.
- [CHANGELOG.md](CHANGELOG.md): historial de cambios.
- [CLAUDE.md](CLAUDE.md) / [AGENTS.md](AGENTS.md): guía para asistentes de programación.

## 10. Licencia

[MIT](LICENSE) © 2026 José María de Paz Siles
