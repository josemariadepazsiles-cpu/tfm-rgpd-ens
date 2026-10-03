# AGENTS.md

Guía breve para asistentes de programación. La versión completa (convenciones, permisos y errores
habituales) está en [CLAUDE.md](CLAUDE.md); si ambas difieren, manda CLAUDE.md.

## Proyecto

Compliance AI: aplicación web (TFM) de cumplimiento RGPD + ENS con el sistema de información como
eje. Node.js ≥ 20.19, Express 5, EJS, Tailwind 4, Alpine.js, Passport, Prisma 7 y PostgreSQL.

## Comandos

```bash
npm install                        # dependencias + prisma generate
npm run dev                        # http://localhost:3000
npm run build:css                  # estilos (output.css no se versiona)
npx prisma migrate deploy          # aplicar migraciones
npm run seed                       # admin inicial + controles básicos
npm run db:ejemplo -- --confirmar  # BORRA y carga datos de ejemplo
npm test                           # pruebas funcionales (app en marcha + datos de ejemplo)
```

Demostración (tras `db:ejemplo`): `admin@test.com` / `admin1234` (Administrador) y
`carmen.vidal@labfarmareunidos.example` / `Ejemplo2026` (Usuario).

## Reglas

- Todo en español: código, comentarios, mensajes y commits.
- Patrón ruta → controlador → `lib/` → vista EJS. Errores de validación con estado 400; tras guardar, mensaje flash y redirección.
- Ids con `idValido` / `idDeFormulario`; fechas con `lib/formato.js`; textos con `lib/validacion.js`.
- En las vistas, datos del usuario siempre con `<%= %>`.
- No tocar `.env`, no editar migraciones aplicadas, no ejecutar `db:ejemplo`, `db:restaurar` ni `npm test` contra producción, no subir `uploads/` ni `backups/`.
