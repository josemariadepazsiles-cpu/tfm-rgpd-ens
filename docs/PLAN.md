# Plan del proyecto · Compliance AI

Fases reconstruidas a partir del historial de git (58 commits, del 26/09/2026 al 03/10/2026) y
del estado del código. Las fechas son las de los commits.

[COMPLETAR: calendario oficial del TFM (fechas de entrega y defensa) y fases previas al código,
como análisis normativo o diseño]

## Fase 1 · Base y primeros módulos (26/09/2026) — hecho

- [x] Base del proyecto: Express, Prisma, EJS y Tailwind.
- [x] Autenticación con Passport (estrategia local) y roles Administrador / Usuario.
- [x] Registro de Actividades de Tratamiento (RAT).
- [x] Evaluación de riesgos con matriz probabilidad × impacto.
- [x] Checklist ENS y, después, evaluaciones ENS por sistema con histórico de cambios de estado.
- [x] Barra de navegación con menús desplegables.
- [x] Incidentes y brechas de seguridad (arts. 33 y 34 RGPD).

## Fase 2 · Resto de módulos RGPD y ENS (27/09/2026) — hecho

- [x] Derechos de los interesados (arts. 12 a 22 RGPD).
- [x] Proveedores / encargados (art. 28 RGPD) y Declaraciones de Conformidad ENS.
- [x] Políticas y documentación normativa.
- [x] BIA y continuidad.
- [x] Panel de control ejecutivo.
- [x] Rediseño visual integral («Compliance AI»).

## Fase 3 · El sistema de información como eje (28-29/09/2026) — hecho

- [x] `sistema_id` en RAT, riesgos, incidentes y derechos; ficha del sistema con toda su información.
- [x] Panel de control organizado por sistema («Ver por sistema»).
- [x] Código de color por área: RGPD índigo, ENS violeta, neutro gris.
- [x] Versionado del CSS para evitar la caché del navegador.

## Fase 4 · Panel, datos de ejemplo y operación (01/10/2026) — hecho

- [x] Rediseño del panel: jerarquía, bloques plegables y sistema de cada acción y evento.
- [x] Datos de ejemplo de una farmacéutica ficticia (3 sistemas) y scripts de copia y restauración.
- [x] Datos de la empresa en la cabecera.
- [x] Migraciones con fin de línea LF fijo.
- [x] Descripción de los controles ENS (Anexo II).

## Fase 5 · Usabilidad y nuevos flujos (02-03/10/2026) — hecho

- [x] Listados sin columna de acciones: se entra pulsando el nombre; Editar y Eliminar dentro de la ficha.
- [x] Proveedores con datos y documentos en una sola ficha; eliminar proveedor.
- [x] Documentos adjuntos en derechos y en políticas; política asociada a un sistema o General.
- [x] Gestión de usuarios con sistemas asignados y desactivación; aceptación de políticas por sistema.
- [x] «Área» del usuario sustituida por «Cargo».
- [x] Declaraciones mostradas junto a su evaluación; solo «Ver PDF» (sin descargar).

## Fase 6 · Pruebas y correcciones (03/10/2026) — hecho

- [x] Batería de 262 pruebas funcionales ([INFORME_PRUEBAS.md](../INFORME_PRUEBAS.md)).
- [x] Corregidos los 9 fallos encontrados:
  - ids fuera de rango;
  - permisos de los controles ENS;
  - CSRF;
  - límite de intentos de login;
  - cabeceras de seguridad;
  - credenciales del seed;
  - longitud de los textos;
  - contador del panel;
  - foto de cada evaluación.

## Fase 7 · Documentación (03/10/2026) — en curso, sin commit

- [x] Código comentado en español: JSDoc en funciones y `///` en el esquema.
- [x] README, CLAUDE.md, AGENTS.md, docs/ (PRD, arquitectura y plan), CHANGELOG y LICENSE.
- [x] Pruebas dentro del repositorio: `tests/` y `npm test`, con copia y restauración automáticas.
- [ ] Revisión del autor y commit.

## Pendiente

### Fallos y mejoras detectados en el código

Están marcados en el código con «FALLO DETECTADO».

- [ ] Guardar las sesiones en PostgreSQL en lugar de MemoryStore (`app.js`).
- [ ] No pasar a «Superada» la declaración emitida hasta emitir la nueva versión (`lib/declaraciones.js`).
- [ ] Trasladar al siguiente día hábil los plazos que vencen en sábado, domingo o festivo (`lib/formato.js`).
- [ ] Mensaje en español cuando el login llega vacío, en lugar de «Missing credentials» (`config/passport.js`).
- [ ] Límite de login también por IP sola (hoy cuenta por IP + email, así que no frena probar muchos emails) y persistente (`middlewares/seguridad.js`).
- [ ] Fijar la versión de Alpine.js y añadir SRI, o servirlo desde el propio servidor.
- [ ] No permitir asignar como responsable a usuarios desactivados, y filtrarlos en los desplegables.
- [ ] Decidir qué pasa con las evaluaciones pasadas al renombrar o recategorizar un control.
- [ ] Al borrar la última evaluación, avisar de que la anterior no incluye los controles nuevos.
- [ ] Unificar redondeos:
  - el % de la declaración (con decimales) frente al de la app (entero);
  - las horas AEPD del panel frente a las de la ficha;
  - la gravedad de «sin prueba en 12 meses» (crítico en el panel, amarillo en BIA).
- [ ] Calcular «hace 12 meses» en hora de España.
- [ ] Cerrar las sesiones de un usuario al cambiar su contraseña.
- [ ] Limpieza:
  - `express.json` sin uso;
  - `fs.statSync` en cada petición;
  - código muerto en `lib/usuarios.js`, `lib/dashboard.js` y `evaluacionController.js`;
  - comentarios desactualizados;
  - los controles genéricos de `prisma/seed.js`.

### Otras tareas

- [ ] `db:pdfs-politicas`: regenerar también los PDF que falten en disco (p. ej. al trabajar desde otro equipo, ya que `uploads/` no se versiona).
- [ ] Despliegue en producción: [COMPLETAR: plataforma, dominio y base de datos de producción].
- [ ] [COMPLETAR: otras tareas previstas por el autor]
