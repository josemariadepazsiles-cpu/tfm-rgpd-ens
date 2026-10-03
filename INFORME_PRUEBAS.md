# Informe de pruebas funcionales

**Aplicación:** Compliance AI (RGPD + ENS) · **Fecha:** 03/10/2026 · **Versión probada:** commit `95bdd73` (rama `main`)

> **Actualización (03/10/2026):**
> - los 9 fallos de este informe están **corregidos**;
> - la batería completa vuelve a pasar: **260 OK, 0 fallos, 2 no aplicables**;
> - detalle en la sección [5. Correcciones aplicadas](#5-correcciones-aplicadas-y-nueva-verificación).
>
> Las secciones 2 a 4 describen el estado **antes** de corregir.

## Resumen (primera pasada, antes de corregir)

| | |
|---|---|
| Pruebas ejecutadas | **266** |
| OK | **230** |
| FALLO | **34** (corresponden a **9 fallos distintos**, ver lista) |
| NO PROBADO | **2** (no aplicables) |
| Fallos críticos / altos | **0 / 0** |
| Fallos medios / bajos | **4 / 5** |

Lo más importante:

- **Funciona:**
  - acceso y roles, incluido el bloqueo por URL directa de todas las pantallas y acciones de administrador;
  - altas, ediciones, filtros y validaciones de los 10 módulos;
  - todos los cálculos (ENS, riesgo, 72 h AEPD, plazos de derechos, revisiones vencidas, «sin prueba en 12 meses»);
  - las cifras del panel;
  - el escapado de texto (XSS) y el hash de contraseñas.
- **Fallos más relevantes:**
  - cualquier URL o formulario con un número de id enorme provoca un **error 500** (11 rutas, la misma causa);
  - los formularios **no tienen protección CSRF**;
  - **cualquier usuario puede cambiar el estado de cualquier control ENS** aunque no sea su responsable;
  - **no hay límite de intentos de login**.

## Cómo se ha probado

- **Entorno:**
  - app en marcha con `npm run dev` en `http://localhost:3000` (`/login` respondió 200);
  - base de datos: la de Neon del proyecto (`ep-noisy-thunder…`, `neondb`), con la opción 2 acordada: copia de seguridad previa (`backups/copia-20261003-105803.json`) y copia de `uploads/`, pruebas, y **restauración de ambas al terminar**;
  - verificado tras restaurar: mismos recuentos que la copia (4 sistemas, 11 usuarios, 6 incidentes, 18 riesgos, 39 controles, 4 declaraciones, 8 proveedores, 234 filas de checklist) y los 9 archivos de `uploads/`.
- **Método:**
  - peticiones HTTP reales con `fetch` de Node 24 contra la app en marcha, manteniendo la cookie de sesión;
  - comprobación del resultado en la propia respuesta (estado HTTP, redirección, HTML) **y en la base de datos** con Prisma;
  - Playwright no está instalado.
- **Usuarios:** `admin@test.com` (Administrador) y `carmen.vidal@labfarmareunidos.example` (Usuario, Área financiera), ambos del seed. Para la prueba de cuenta desactivada se creó un usuario temporal y se borró al terminar.
- **Scripts:** fuera del repositorio, en la carpeta temporal de la sesión:
  - `pruebas-completas.js`: la batería principal;
  - `repeticion.js` y `xss.js`: repiten, ya corregidas, 7 pruebas que fallaron por errores del propio script (formato de fecha de BIA y campos que faltaban al crear un incidente), y amplían XSS a 6 módulos más.
  - En la tabla solo figura la versión corregida de esas pruebas.
- **Consola del servidor:** se revisó la salida de `npm run dev` desde el inicio de las pruebas.

## 1. Rutas y roles

**Roles:** `ADMIN` (Administrador) y `USUARIO` (Usuario). Además, un usuario puede estar **desactivado** (`activo = false`): no puede entrar y pierde la sesión.

- **auth:** requiere sesión.
- **admin:** requiere rol Administrador (si no, 403).

| Módulo | Método y ruta | Acceso |
|---|---|---|
| Sesión | GET `/` · GET `/login` · POST `/login` · POST `/logout` · GET `/registro` (redirige a `/usuarios/nuevo`) | `/login` solo sin sesión · `/logout` auth · `/registro` admin |
| Panel | GET `/dashboard` (`?sistema=ID`) | auth |
| Sistemas | GET `/sistemas` · GET `/sistemas/:id` · GET `/sistemas/:id/historial` | auth |
| | GET `/sistemas/nuevo` · POST `/sistemas` · GET `/sistemas/:id/editar` · POST `/sistemas/:id` · POST `/sistemas/:id/eliminar` · POST `/sistemas/:id/evaluaciones` | admin |
| Evaluaciones | GET `/evaluaciones/:id` · GET `/evaluaciones/:id/controles/:cid/editar` · POST `/evaluaciones/:id/controles/:cid` · POST `…/:cid/estado` · POST `…/:cid/asignarme` | auth |
| | POST `/evaluaciones/:id/eliminar` · POST `/evaluaciones/:id/declaracion` | admin |
| Catálogo de controles | GET `/controles` · GET `/controles/nuevo` · POST `/controles` · GET `/controles/:id/editar` · POST `/controles/:id` · POST `/controles/:id/eliminar` | admin |
| RAT | GET `/rat` · GET `/rat/nueva` · POST `/rat` · GET `/rat/:id` · GET `/rat/:id/editar` · POST `/rat/:id` | auth (un Usuario solo ve y edita las suyas) |
| | POST `/rat/:id/eliminar` | admin |
| Riesgos | GET `/riesgos` · GET `/riesgos/nuevo` · POST `/riesgos` · GET `/riesgos/:id` · GET `/riesgos/:id/editar` · POST `/riesgos/:id` | auth (un Usuario solo los de sus actividades) |
| | POST `/riesgos/:id/eliminar` | admin |
| Incidentes | GET `/incidentes` · GET `/incidentes/nuevo` · POST `/incidentes` · GET `/incidentes/:id` · GET `/incidentes/:id/historial` · GET `/incidentes/:id/editar` · POST `/incidentes/:id` · POST `/incidentes/:id/estado` | auth (editar: admin o responsable) |
| Derechos | GET `/derechos` · GET `/derechos/nueva` · POST `/derechos` · GET `/derechos/:id` · GET `/derechos/:id/historial` · GET `/derechos/:id/editar` · POST `/derechos/:id` · POST `/derechos/:id/estado` · POST `/derechos/:id/documentos` · GET `/derechos/:id/documentos/:doc` · POST `…/documentos/:doc/eliminar` | auth (editar: admin o responsable) |
| Proveedores | GET `/proveedores` · GET `/proveedores/:id` · POST `/proveedores/:id/documentos` · GET `…/documentos/:doc` · POST `…/documentos/:doc/eliminar` | auth |
| | GET `/proveedores/nuevo` · POST `/proveedores` · GET `/proveedores/:id/editar` · POST `/proveedores/:id` · POST `/proveedores/:id/eliminar` | admin |
| Declaraciones | GET `/declaraciones` · GET `/declaraciones/:id` · GET `/declaraciones/:id/pdf` (`?ver=1` en línea) | auth |
| | POST `/declaraciones/:id` (observaciones) · POST `/declaraciones/:id/emitir` · POST `/declaraciones/:id/eliminar` | admin |
| Políticas | GET `/politicas` · GET `/politicas/:id` · POST `/politicas/:id/aceptar` · GET `/politicas/:id/archivos/:a` · GET `/politicas/:id/adjuntos/:d` | auth |
| | GET `/politicas/nueva` · POST `/politicas` · GET `/politicas/:id/editar` · POST `/politicas/:id` · POST `/politicas/:id/eliminar` · POST `/politicas/:id/versiones` · POST `/politicas/:id/estado` · POST `/politicas/:id/adjuntos` · POST `…/adjuntos/:d/eliminar` | admin |
| BIA | GET `/bia` · GET `/bia/:id` · GET `/bia/:id/editar` · POST `/bia/:id` · POST `/bia/:id/pruebas` | auth (editar: admin o responsable) |
| | GET `/bia/nuevo` · POST `/bia` · POST `/bia/:id/eliminar` | admin |
| Empresa | GET `/empresa` | auth |
| | POST `/empresa` | admin |
| Usuarios | GET `/usuarios` · GET `/usuarios/nuevo` · POST `/usuarios` · GET `/usuarios/:id/editar` · POST `/usuarios/:id` · POST `/usuarios/:id/estado` | admin |
| Otras | GET `/checklist` (301 a `/sistemas`) · `/fuentes/*` y archivos de `public/` | público |

## 2. Resultados

| Módulo | Prueba | Resultado | Detalle |
|---|---|---|---|
| Acceso | Login correcto redirige al panel | OK | status 302 → /dashboard |
| Acceso | Contraseña incorrecta: rechazado sin sesión | OK | status 401 |
| Acceso | Usuario inexistente: rechazado | OK | status 401 |
| Acceso | Mismo mensaje para usuario inexistente y contraseña errónea (no revela si el email existe) | OK | Ambos muestran «Email o contraseña incorrectos» (config/passport.js:23-24); además se compara contra un hash ficticio si el email no existe |
| Acceso | Login con campos vacíos: rechazado | OK | status 401  |
| Acceso | Cookie de sesión con HttpOnly y SameSite | OK | sid=…; Path=/; Expires=Sat, 03 Oct 2026 19:10:19 GMT; HttpOnly; SameSite=Lax |
| Acceso | GET /login no crea sesión antes de autenticarse | OK | sin cookie |
| Acceso | Cerrar sesión redirige | OK | status 302 → /login |
| Acceso | Tras cerrar sesión, la cookie antigua ya no sirve | OK | status 302 → /login |
| Acceso | GET /logout no cierra sesión (solo POST) | OK | status 404 |
| Acceso | Rutas privadas sin sesión redirigen a /login (18 rutas GET) | OK | todas → /login |
| Acceso | POST privado sin sesión redirige a /login | OK | status 302 |
| Acceso | Con sesión, /login lleva al panel | OK | status 302 |
| Acceso | Usuario desactivado no puede entrar | OK | status 401 |
| Acceso | Límite de intentos de login (15 fallos seguidos) | **FALLO** | no hay límite: los 15 intentos se procesan |
| Roles | Usuario básico: pantallas de administrador por URL directa → 403 (11) | OK | todas 403 |
| Roles | Usuario básico: eliminar por POST directo → 403 y el registro sigue (9 módulos) | OK | todas 403 |
| Roles | Usuario básico: guardar Datos de la empresa → 403 | OK | status 403 |
| Roles | Usuario básico: crear usuario (incluso ADMIN) → 403 | OK | status 403 |
| Roles | Usuario básico: no puede ascenderse a ADMIN | OK | status 403 |
| Roles | Usuario básico: crear evaluación → 403 | OK | status 403 |
| Roles | Usuario básico: generar declaración → 403 | OK | status 403 |
| Roles | Usuario básico: emitir declaración → 403 | OK | status 403 |
| Roles | Usuario básico: cambiar estado de política → 403 | OK | status 403 |
| Roles | Usuario básico: editar proveedor → 403 | OK | status 403 |
| Roles | Usuario básico: el menú no muestra Usuarios ni Catálogo de controles | OK |  |
| Roles | Usuario básico: no ve por URL una actividad RAT de otro usuario | OK | status 404 |
| Roles | Usuario básico: no edita por URL una actividad RAT de otro usuario (GET) | OK | status 404 |
| Roles | Usuario básico: no modifica por POST una actividad RAT de otro usuario | OK | status 404 |
| Roles | Usuario básico: no ve por URL un riesgo de otro usuario | OK | status 404 |
| Roles | Usuario básico: no crea riesgos sobre actividades de otros | OK | status 400 |
| Roles | Usuario básico: no cambia el estado de un incidente del que no es responsable | OK | status 403 |
| Roles | Usuario básico: no abre la edición de un incidente ajeno | OK | status 403 |
| Roles | Usuario básico: no cambia el estado de una solicitud de la que no es responsable | OK | status 403 |
| Roles | Usuario básico: no abre la edición de un proceso BIA ajeno | OK | status 403 |
| Roles | Usuario básico: no registra pruebas en un proceso BIA ajeno | OK | status 403 |
| Roles | Usuario básico: no cambia el estado de un control ENS del que no es responsable | **FALLO** | status 302 |
| Roles | Usuario básico: no elimina documentos de proveedores de otros | OK | status 403 |
| Organización | Aislamiento entre organizaciones cambiando el id en la URL | NO PROBADO | No aplica: la aplicación es de una sola organización (tabla organizacion con una fila, sin organizacion_id en los datos). El aislamiento por usuario (RAT y riesgos) se prueba en «Roles». |
| Sistemas | Crear sistema (con primera evaluación) | OK | status 302 → /evaluaciones/42 |
| Sistemas | Al crear con «crear evaluación», se crea la evaluación | OK | 1 evaluaciones |
| Sistemas | Ficha con todas sus pestañas | OK | Resumen, Actividades RAT, Riesgos, Incidentes, Derechos, Checklist ENS, Continuidad |
| Sistemas | Editar sistema | OK | status 302 |
| Sistemas | Ver histórico del sistema | OK | status 200 |
| Sistemas | Histórico con parámetros inválidos no falla | OK | status 200 |
| Sistemas | Crear sin nombre → error de validación | OK | status 400 El nombre es obligatorio. |
| Sistemas | Categoría ENS inválida → error | OK | status 400 La categoría general no es válida. |
| Sistemas | Nombre de 20.000 caracteres | **FALLO** | se acepta y se guarda (sin límite de longitud) |
| Sistemas | Sistema inexistente → 404 | OK | status 404 |
| Sistemas | Id no numérico → 404 | OK | status 404 |
| Sistemas | Id fuera de rango (99999999999) → 404 | **FALLO** | status 500 |
| Sistemas | Crear otra evaluación copiando la anterior | OK | status 302 → /evaluaciones/43 |
| Sistemas | Crear evaluación sin nombre | OK | status 302 (usa nombre sugerido) |
| RGPD · RAT | Listar | OK | status 200 |
| RGPD · RAT | Crear | OK | status 302 → /rat/44  |
| RGPD · RAT | Ver ficha | OK | status 200 |
| RGPD · RAT | Editar | OK | status 302  |
| RGPD · RAT | Filtro por sistema y «sin sistema» | OK |  |
| RGPD · RAT | Filtro con valor inválido no falla | OK | status 200 |
| RGPD · RAT | Formulario vacío → errores de obligatorio | OK | status 400: El nombre es obligatorio. \| La finalidad es obligatoria. \| Las categorías de datos son obligatorias. \| Las categorías de interesados son obligatorias. |
| RGPD · RAT | Base legal inválida → error | OK | status 400 La base legal no es válida. |
| RGPD · RAT | Sistema inexistente → error | OK | status 400 El sistema asociado no es válido. |
| RGPD · RAT | Responsable con id fuera de rango → error (no 500) | **FALLO** | status 500  |
| RGPD · RAT | Transferencia internacional sin país → error | OK | status 400 Indica el país de destino de la transferencia internacional. |
| RGPD · RAT | Textos de 20.000 caracteres | **FALLO** | se aceptan sin límite de longitud |
| RGPD · RAT | Id fuera de rango → 404 | **FALLO** | status 500 |
| RGPD · Riesgos | Listar | OK | status 200 |
| RGPD · Riesgos | Crear | OK | status 302  |
| RGPD · Riesgos | Nivel calculado al crear (Alta × Medio = 6 → Alto) | OK | ALTO |
| RGPD · Riesgos | Ver ficha | OK | status 200 |
| RGPD · Riesgos | Editar y recalcular nivel (Baja × Alto = 3 → Medio) | OK | status 302 nivel MEDIO |
| RGPD · Riesgos | Filtros (8) responden y filtran por nivel | OK |  |
| RGPD · Riesgos | Formulario vacío → errores | OK | status 400: Selecciona una actividad de tratamiento válida. \| La amenaza es obligatoria. \| La probabilidad no es válida. \| El impacto no es válido. |
| RGPD · Riesgos | Probabilidad inválida → error | OK | status 400 |
| RGPD · Riesgos | Actividad con id fuera de rango → error (no 500) | **FALLO** | status 500 |
| RGPD · Riesgos | Id fuera de rango → 404 | **FALLO** | status 500 |
| RGPD · Incidentes | Listar | OK | status 200 |
| RGPD · Incidentes | Crear | OK | status 302  |
| RGPD · Incidentes | Ver ficha | OK | status 200 |
| RGPD · Incidentes | Plazo AEPD: detectado hace 10 h → quedan 62 h | OK | La ficha muestra «Notificación a la AEPD pendiente: quedan 62 h» |
| RGPD · Incidentes | Editar | OK | status 302  |
| RGPD · Incidentes | Cambiar estado | OK | status 302 |
| RGPD · Incidentes | Ver historial con el cambio de estado | OK | status 200 |
| RGPD · Incidentes | Estado inválido → rechazado | OK | status 302 |
| RGPD · Incidentes | Filtros (10) responden | OK |  |
| RGPD · Incidentes | Filtro «AEPD vencidos» incluye el detectado hace 80 h y no el de hace 10 h | OK |  |
| RGPD · Incidentes | Filtro por gravedad | OK |  |
| RGPD · Incidentes | Formulario vacío → errores | OK | status 400: La fecha de detección es obligatoria. \| El título es obligatorio. \| La descripción es obligatoria. \| Las categorías de datos afectados son obligatoria |
| RGPD · Incidentes | Fecha imposible (30 de febrero) → error | OK | status 400 La fecha de detección no es válida. |
| RGPD · Incidentes | Fecha de detección futura → error | OK | status 400 La fecha de detección no puede ser futura. |
| RGPD · Incidentes | Ocurrencia posterior a la detección → error | OK | status 400 La fecha de ocurrencia no puede ser posterior a la de detección. |
| RGPD · Incidentes | Número de afectados negativo → error | OK | status 400 El número de afectados debe ser un entero igual o mayor que 0. |
| RGPD · Incidentes | Número de afectados enorme (99999999999) → error (no 500) | **FALLO** | status 500  |
| RGPD · Incidentes | Textos de 20.000 caracteres | **FALLO** | se aceptan sin límite de longitud |
| RGPD · Incidentes | Id fuera de rango → 404 | **FALLO** | status 500 |
| RGPD · Derechos | Listar | OK | status 200 |
| RGPD · Derechos | Crear | OK | status 302  |
| RGPD · Derechos | Fecha límite = recepción + 1 mes (art. 12.3 RGPD) | OK | límite 28/10/2026, esperada 28/10/2026 |
| RGPD · Derechos | Días restantes mostrados (esperados 25) | OK |    Quedan 25 días     |
| RGPD · Derechos | Editar | OK | status 302  |
| RGPD · Derechos | Cambiar estado | OK | status 302 |
| RGPD · Derechos | Ver historial | OK | status 200 |
| RGPD · Derechos | Subir documento PDF | OK | status 302 |
| RGPD · Derechos | Ver documento (PDF en línea) | OK | status 200 application/pdf |
| RGPD · Derechos | Eliminar documento | OK | status 302 |
| RGPD · Derechos | Subir archivo que no es PDF → rechazado | OK | status 302 |
| RGPD · Derechos | Filtros (8) responden | OK |  |
| RGPD · Derechos | Filtro por tipo filtra | OK |  |
| RGPD · Derechos | Formulario vacío → errores | OK | status 400: La fecha de recepción es obligatoria. \| El nombre del solicitante es obligatorio. \| El email del solicitante no es válido. \| El tipo de derecho no es  |
| RGPD · Derechos | Fecha imposible → error | OK | status 400 La fecha de recepción no es válida. |
| RGPD · Derechos | Fecha imposible (30 de febrero) → error | OK | status 400 La fecha de recepción no es válida. |
| RGPD · Derechos | Fecha de recepción futura → error | OK | status 400 La fecha de recepción no puede ser futura. |
| RGPD · Derechos | Email inválido → error | OK | status 400 El email del solicitante no es válido. |
| RGPD · Derechos | Textos de 20.000 caracteres | **FALLO** | se aceptan sin límite de longitud |
| RGPD · Derechos | Id fuera de rango → 404 | **FALLO** | status 500 |
| RGPD · Proveedores | Listar | OK | status 200 |
| RGPD · Proveedores | Crear | OK | status 302  |
| RGPD · Proveedores | Ver ficha | OK | status 200 |
| RGPD · Proveedores | Editar | OK | status 302  |
| RGPD · Proveedores | Subir documento PDF | OK | status 302 |
| RGPD · Proveedores | Ver documento | OK | status 200 |
| RGPD · Proveedores | Documento pedido con otro id de proveedor → 404 | OK | status 404 |
| RGPD · Proveedores | Eliminar documento | OK | status 302 |
| RGPD · Proveedores | Subir PDF de más de 10 MB → rechazado sin error 500 | OK | status 302 |
| RGPD · Proveedores | Filtros (5) responden | OK |  |
| RGPD · Proveedores | Filtro por estado filtra | OK |  |
| RGPD · Proveedores | Formulario vacío → errores | OK | status 400: El nombre de la empresa es obligatorio. \| El servicio prestado es obligatorio. \| Las categorías de datos tratados son obligatorias. \| El país del trat |
| RGPD · Proveedores | Email inválido → error | OK | status 400 El email de contacto no es válido. |
| RGPD · Proveedores | Estado / nivel ENS inválidos → error | OK | status 400 El nivel ENS no es válido. \| El estado no es válido. |
| RGPD · Proveedores | Fuera de la UE sin mecanismo de transferencia | OK | Se guarda (302). Es intencionado: queda como aviso «Transferencia internacional sin mecanismo señalado» (proveedorController.js:112); el aviso no lo comprobé en pantalla |
| RGPD · Proveedores | Textos de 20.000 caracteres | **FALLO** | se aceptan sin límite de longitud |
| RGPD · Proveedores | Eliminar proveedor | OK | status 302 |
| RGPD · Proveedores | Id fuera de rango → 404 | **FALLO** | status 500 |
| ENS · Catálogo de controles | Listar | OK | status 200 |
| ENS · Catálogo de controles | Crear | OK | status 302  |
| ENS · Catálogo de controles | Ver (formulario de edición) | OK | status 200 |
| ENS · Catálogo de controles | Editar | OK | status 302 |
| ENS · Catálogo de controles | Filtros | NO PROBADO | El catálogo no tiene filtros: muestra los controles agrupados por categoría (Baja, Media, Alta). |
| ENS · Catálogo de controles | Formulario vacío → error | OK | status 400 El nombre es obligatorio. \| La categoría no es válida. |
| ENS · Catálogo de controles | Categoría inválida → error | OK | status 400 |
| ENS · Catálogo de controles | Descripción de más de 2000 caracteres → error | OK | status 400 |
| ENS · Catálogo de controles | Nombre duplicado → error (no 500) | OK | status 409 Ya existe un control con ese nombre. |
| ENS · Catálogo de controles | Nombre de 20.000 caracteres | **FALLO** | se acepta sin límite de longitud |
| ENS · Evaluación (checklist) | Ver checklist | OK | status 200 |
| ENS · Evaluación (checklist) | El control creado después aparece en las evaluaciones existentes | OK | aparece |
| ENS · Evaluación (checklist) | Abrir edición de un control | OK | status 200 |
| ENS · Evaluación (checklist) | Editar control (estado, evidencia, responsable) | OK | status 302  |
| ENS · Evaluación (checklist) | Cambiar estado rápido | OK | status 302 |
| ENS · Evaluación (checklist) | Estado inválido → rechazado | OK | status 302 |
| ENS · Evaluación (checklist) | Evidencia de 20.000 caracteres | **FALLO** | se acepta sin límite de longitud |
| ENS · Evaluación (checklist) | Asignarme un control sin responsable (usuario básico) | OK | status 302 |
| ENS · Evaluación (checklist) | Control inexistente → 404 | OK | status 404 |
| ENS · Evaluación (checklist) | Id fuera de rango → 404 | **FALLO** | status 500 |
| ENS · Evaluación (checklist) | Porcentaje en la ficha del sistema = 1/40 = 3 % (No aplicable no cuenta) | OK |  |
| ENS · Declaraciones | Generar declaración desde una evaluación | OK | status 302 → /declaraciones/30 |
| ENS · Declaraciones | Listar | OK | status 200 |
| ENS · Declaraciones | Filtro por sistema | OK |  |
| ENS · Declaraciones | Ver declaración | OK | status 200 |
| ENS · Declaraciones | Ver PDF (en línea) | OK | status 200 application/pdf inline; filename="Declaracion_Conformidad_ENS_ZZ_Sistema_de_prueba_editado_v1.pdf"; filename*=UTF-8''Declaracion_Conformidad_ENS_ZZ_Sistema_de_prueba_editado_v1.pdf |
| ENS · Declaraciones | Descargar PDF (ruta sin ?ver) | OK | status 200 attachment; filename="Declaracion_Conformidad_ENS_ZZ_Sistema_de_prueba_editado_v1.pdf"; filename*=UTF-8''Declaracion_Conformidad_ENS_ZZ_Sistema_de_prueba_editado_v1.pdf (el botón de descarga se quitó de la vista; la ruta sigue) |
| ENS · Declaraciones | Usuario básico puede ver el PDF | OK | status 200 |
| ENS · Declaraciones | Guardar observaciones | OK | status 302 |
| ENS · Declaraciones | Observaciones de 20.000 caracteres | **FALLO** | se aceptan sin límite |
| ENS · Declaraciones | Emitir | OK | status 302 |
| ENS · Declaraciones | No se puede eliminar una declaración emitida | OK | status 302 |
| ENS · Declaraciones | Emitir dos veces no falla | OK | status 302 |
| ENS · Declaraciones | Id fuera de rango → 404 | **FALLO** | status 500 |
| ENS · Declaraciones | Sistema sin categoría ENS: no genera declaración | OK | status 302 |
| ENS · Políticas | Listar | OK | status 200 |
| ENS · Políticas | Crear (en Borrador) | OK | status 302  |
| ENS · Políticas | Ver ficha | OK | status 200 |
| ENS · Políticas | Editar | OK | status 302  |
| ENS · Políticas | Subir PDF de la versión y aprobar | OK | status 302 estado APROBADA archivos 1 |
| ENS · Políticas | Ver el PDF de la versión | OK | status 200 |
| ENS · Políticas | Aceptar una política general (usuario básico) | OK | status 302 |
| ENS · Políticas | Aceptar dos veces no duplica ni falla | OK | status 302 |
| ENS · Políticas | Adjuntar documento | OK | status 302 |
| ENS · Políticas | Ver adjunto | OK | status 200 |
| ENS · Políticas | Eliminar adjunto | OK | status 302 |
| ENS · Políticas | Filtros (6) responden | OK |  |
| ENS · Políticas | Revisión vencida hace 3 días aparece en «revisión» | OK |  |
| ENS · Políticas | La ficha muestra «Revisión vencida hace 3 día(s)» | OK | Revisión vencida hace 3 día(s) |
| ENS · Políticas | Cambiar estado a Obsoleta | OK | status 302 |
| ENS · Políticas | Formulario vacío → errores | OK | status 400: El título es obligatorio. \| El tipo de documento no es válido. \| La versión es obligatoria (p. ej. &#34;1.0&#34;): letras, números, puntos o guiones,  |
| ENS · Políticas | Versión con caracteres no válidos → error | OK | status 400 |
| ENS · Políticas | Fecha imposible (30 de febrero) → error | OK | status 400 La fecha de próxima revisión no es válida. |
| ENS · Políticas | Tipo inválido → error | OK | status 400 |
| ENS · Políticas | Sistema inexistente → error | OK | status 400 |
| ENS · Políticas | Textos de 20.000 caracteres | **FALLO** | se aceptan sin límite de longitud |
| ENS · Políticas | Subir versión que no es PDF → rechazada | OK | status 302 |
| ENS · Políticas | Id fuera de rango → 404 | **FALLO** | status 500 |
| ENS · Políticas | Eliminar política | OK | status 302 |
| ENS · BIA y Continuidad | Listar | OK | status 200 |
| ENS · BIA y Continuidad | Crear | OK | status 302  |
| ENS · BIA y Continuidad | Ver ficha | OK | status 200 |
| ENS · BIA y Continuidad | Proceso alto sin pruebas muestra «Sin prueba en 12 meses» | OK |  |
| ENS · BIA y Continuidad | Editar | OK | status 302  |
| ENS · BIA y Continuidad | Aparece en el filtro «sin prueba» | OK |  |
| ENS · BIA y Continuidad | Filtros (7) responden | OK |  |
| ENS · BIA y Continuidad | Filtro por criticidad filtra | OK |  |
| ENS · BIA y Continuidad | Formulario vacío → errores | OK | status 400: El nombre del proceso es obligatorio. \| El departamento responsable es obligatorio. \| La criticidad no es válida. \| El estado de revisión no es válido |
| ENS · BIA y Continuidad | RTO negativo / RPO no numérico → error | OK | status 400 El RTO debe ser un número de horas (p. ej. 4 o 0,5), con hasta 2 decimales. \| El RPO debe ser un número de horas (p. ej. 4 o 0,5), con hasta 2 decimales. |
| ENS · BIA y Continuidad | RTO enorme (99999999999) → error (no 500) | OK | status 400 El RTO debe ser un número de horas (p. ej. 4 o 0,5), con hasta 2 decimales. |
| ENS · BIA y Continuidad | Fecha imposible → error | OK | status 400 La fecha del último análisis no es válida. |
| ENS · BIA y Continuidad | Sistema con id fuera de rango → error (no 500) | **FALLO** | status 500 |
| ENS · BIA y Continuidad | Criticidad inválida → error | OK | status 400 |
| ENS · BIA y Continuidad | Textos de 20.000 caracteres | **FALLO** | se aceptan sin límite de longitud |
| ENS · BIA y Continuidad | Id fuera de rango → 404 | **FALLO** | status 500 |
| ENS · BIA y Continuidad | Eliminar proceso | OK | status 302 |
| ENS · BIA y Continuidad | Registrar prueba de continuidad (hace 400 días) | OK | 1 pruebas · repetida con fecha y hora |
| ENS · BIA y Continuidad | Con solo una prueba de hace 400 días sigue «sin prueba en 12 meses» | OK | repetida con fecha y hora |
| ENS · BIA y Continuidad | Con una prueba de hace 30 días sale del filtro «sin prueba» | OK | repetida con fecha y hora |
| ENS · BIA y Continuidad | Prueba con fecha futura → rechazada | OK | repetida con fecha y hora |
| ENS · BIA y Continuidad | Prueba con fecha imposible (30 de febrero) → rechazada | OK | 2 pruebas · repetida con fecha y hora |
| ENS · BIA y Continuidad | Prueba con tipo/resultado inválidos → rechazada | OK | repetida con fecha y hora |
| Empresa | Ver datos de la empresa | OK | status 200 |
| Empresa | Guardar sin cambios | OK | status 302  |
| Empresa | Email inválido → error | OK | status 400 |
| Empresa | Nombre vacío → error | OK | status 400 El nombre de la empresa es obligatorio. |
| Empresa | Nombre de más de 150 caracteres → error | OK | status 400 |
| Empresa | Categoría ENS inválida → error | OK | status 400 |
| Cálculos | % cumplimiento ENS por sistema (5 sistemas) coincide con la BD sin contar «No aplicable» | OK | coincide |
| Cálculos | Nivel de riesgo = probabilidad × impacto en los 19 riesgos de la BD | OK | todos correctos |
| Cálculos | Las 9 combinaciones de la matriz 3×3 guardadas desde el formulario | OK | las 9 correctas |
| Cálculos | 72 h AEPD: los 1 incidentes vencidos según la BD son los que lista el filtro | OK | faltan  sobran  |
| Cálculos | 72 h AEPD: detectado hace 80 h → fuera de plazo por 8 h | OK | La ficha muestra «el plazo venció el …, hace 8 h» |
| Cálculos | Días restantes de las 6 solicitudes abiertas | OK | coinciden |
| Cálculos | Revisiones de políticas vencidas (1 en la BD) aparecen en el filtro | OK | todas |
| Cálculos | «Sin prueba en 12 meses» (3 procesos altos/críticos según la BD) | OK | faltan  sobran  |
| Panel de control | Tarjeta «Cumplimiento ENS» = media de los sistemas (44 %) | OK | panel 44 |
| Panel de control | Tarjeta «Incidentes abiertos» = incidentes no cerrados en la BD (5) | OK | panel 5 |
| Panel de control | El número de la tarjeta «Acciones pendientes» coincide con el de la lista | OK | Tarjeta 18, lista (18). Ver fallo B-4: el código cuenta distinto si hay acciones informativas |
| Panel de control | Ver por sistema «Área de laboratorio»: incidentes (1) y ENS (58 %) | OK | panel: incidentes 1, ENS 58 |
| Panel de control | Ver por sistema «Área de informática»: incidentes (1) y ENS (95 %) | OK | panel: incidentes 1, ENS 95 |
| Panel de control | Ver por sistema «Área financiera»: incidentes (0) y ENS (62 %) | OK | panel: incidentes 0, ENS 62 |
| Panel de control | Ver por sistema «Área de comunicación»: incidentes (1) y ENS (0 %) | OK | panel: incidentes 1, ENS 0 |
| Panel de control | Ver por sistema con id inexistente → vista general sin error | OK | status 200 |
| Panel de control | Ver por sistema con id fuera de rango → sin error | **FALLO** | status 500 |
| Panel de control | Todos los enlaces del panel («Ver módulo», títulos de acciones, tarjetas…) llevan a páginas válidas | OK | ninguno roto |
| Panel de control | Cada acción pendiente (18) abre una página válida | OK |  |
| Panel de control | Panel del usuario básico carga | OK | status 200 |
| Seguridad | Contraseñas guardadas con hash bcrypt (12 usuarios) | OK | todas $2b$ |
| Seguridad | Los formularios llevan token CSRF | **FALLO** | ningún formulario tiene token; la única defensa es la cookie SameSite=Lax |
| Seguridad | POST con Origin de otro dominio es rechazado | **FALLO** | status 302: el servidor no comprueba Origin/Referer ni token |
| Seguridad | XSS en RAT y Sistemas: &lt;script&gt; guardado se muestra escapado (15 páginas) | OK | Escapado en las 15 páginas. En esta pasada el incidente no llegó a guardarse; se repite abajo por módulo |
| Seguridad | Cabeceras de seguridad (X-Frame-Options, CSP, X-Content-Type-Options) | **FALLO** | faltan: x-frame-options, content-security-policy, x-content-type-options |
| Seguridad | No revela la tecnología (X-Powered-By) | **FALLO** | Express |
| Seguridad | Recorrido de rutas en la descarga de archivos | OK | status 404 |
| Seguridad | XSS en Incidentes: &lt;script&gt; guardado se muestra escapado | OK | escapado en 5 páginas |
| Seguridad | XSS en Derechos: &lt;script&gt; guardado se muestra escapado | OK | escapado en 5 páginas |
| Seguridad | XSS en Proveedores: &lt;script&gt; guardado se muestra escapado | OK | escapado en 5 páginas |
| Seguridad | XSS en Políticas: &lt;script&gt; guardado se muestra escapado | OK | escapado en 5 páginas |
| Seguridad | XSS en BIA: &lt;script&gt; guardado se muestra escapado | OK | escapado en 5 páginas |
| Seguridad | XSS en Catálogo: &lt;script&gt; guardado se muestra escapado | OK | escapado en 3 páginas |
| Sistemas | Eliminar sistema con declaración emitida → se impide | OK | status 302 no se borra (correcto) |
| Sistemas | Eliminar sistema: se borra y sus registros quedan transversales | OK | el incidente asociado queda «Sin sistema» · repetida con fecha y hora |
| General | Ruta inexistente → página 404 propia | OK | status 404 |
| General | Recorrido de enlaces como administrador (450 páginas) | OK | sin enlaces rotos |
| General | Recorrido de enlaces como usuario básico (300 páginas): ningún enlace visible lleva a 403/404 | OK | sin enlaces rotos |
| General | Ninguna respuesta 500 durante todas las pruebas | **FALLO** | GET /sistemas/99999999999 → 500, POST /rat → 500, GET /rat/99999999999 → 500, POST /riesgos → 500, GET /riesgos/99999999999 → 500, POST /incidentes → 500, GET /incidentes/99999999999 → 500, GET /derechos/99999999999 → 500, GET /proveedores/99999999999 → 500, GET /evaluaciones/99999999999 → 500, GET /declaraciones/99999999999 → 500, GET /politicas/99999999999 → 500, POST /bia → 500, GET /bia/999999 |
| General | Ninguna página muestra trazas de error al usuario | OK | ninguna |
| Seguridad | .env fuera del repositorio | OK | .gitignore excluye .env y .env.*; solo se versiona .env.example (con valores de ejemplo) |
| Seguridad | Sin secretos en el código ni en el historial de git | OK | Búsqueda de cadenas de conexión de Neon, npg_… y SESSION_SECRET en archivos versionados y en todo el historial: 0 coincidencias |
| Seguridad | Sin contraseñas por defecto en el código | **FALLO** | prisma/seed.js:10 crea admin@test.com / admin1234 (ver B-2) |
| Seguridad | Las vistas no pintan datos del usuario sin escapar (&lt;%- …%&gt;) | OK | Todos los &lt;%- de views/ son include(), icono() o atributos fijos; flash y migas usan &lt;%= |
| General | Errores en la consola del servidor durante las pruebas | **FALLO** | 33 trazas, todas PrismaClientKnownRequestError P2020 «value "99999999999" is out of range for type integer» (las 11 rutas del fallo M-1, en 3 ejecuciones). Ningún otro error |

## 3. Fallos por gravedad

No se ha encontrado ningún fallo **crítico** ni **alto**. En particular:

- ningún dato de otro usuario se puede ver o modificar por URL donde la app lo restringe;
- ninguna acción de administrador funciona con un usuario básico;
- no hay XSS;
- las contraseñas están con bcrypt;
- no hay secretos en el repositorio.

### Medio

#### M-1 · Un id numérico demasiado grande provoca un error 500

Afecta a 11 rutas, siempre con la misma causa. Cualquier usuario con sesión lo provoca. No se muestra traza al usuario (sale la página genérica «Error del servidor»), pero el servidor registra el error.

**Pasos para reproducirlo:**

1. Entrar con cualquier usuario.
2. Abrir cualquiera de estas direcciones:
   - `/rat/99999999999`, `/riesgos/99999999999`, `/sistemas/99999999999`;
   - `/incidentes/99999999999`, `/derechos/99999999999`, `/proveedores/99999999999`;
   - `/evaluaciones/99999999999`, `/declaraciones/99999999999`, `/politicas/99999999999`, `/bia/99999999999`;
   - `/dashboard?sistema=99999999999`.
3. O enviar uno de estos formularios:
   - una actividad RAT con `usuario_id=99999999999`;
   - un riesgo con `actividad_id=99999999999`;
   - un incidente con «número de afectados» `99999999999`;
   - un proceso BIA con `sistema_id=99999999999`.
4. Resultado: **500**. La consola del servidor muestra `P2020 value "99999999999" is out of range for type integer`.

**Causa:** los ids se convierten con `Number()` y solo se comprueba que sean enteros positivos, no que quepan en un `INTEGER` de PostgreSQL (máximo 2.147.483.647):

- `lib/permisos.js:14-17` (`idValido`) y `lib/sistemas.js:19-23` (`leerSistemaId`);
- `controllers/ratController.js:17` y `:40`, `controllers/riesgoController.js:16` y `:35` (`Number(...)` directo);
- `controllers/incidenteController.js:83-84` (número de afectados sin máximo);
- `controllers/biaController.js:57` y `:60`;
- el `responsable_id` de `derechoController.js:66`, `incidenteController.js:73`, `proveedorController.js:65` y `evaluacionController.js:225`.

**Corrección propuesta:**

1. Añadir `&& id <= 2147483647` en `idValido` y `leerSistemaId`.
2. Usar `idValido` en lugar de `Number(...)` en todos los puntos anteriores.
3. Limitar el número de afectados a ese máximo.
4. Como red de seguridad, que el manejador de errores de `app.js:172` responda 404 o 400 ante `err.code === 'P2020'`.

#### M-2 · Cualquier usuario puede cambiar el estado y la evidencia de cualquier control ENS

Es incoherente con el resto de la app, donde incidentes, derechos y BIA solo los editan el administrador o el responsable. Así, cualquier empleado puede alterar el cumplimiento ENS de cualquier sistema, y ese porcentaje es la base de las Declaraciones de Conformidad.

**Pasos para reproducirlo:**

1. Entrar como `carmen.vidal@…` (Usuario).
2. Enviar POST `/evaluaciones/{id}/controles/{cid}/estado` con `estado=IMPLEMENTADO` sobre un control cuyo responsable es otra persona, o que no tiene responsable.
3. Resultado: el estado cambia y queda en el histórico a su nombre.

**Causa:**

- `controllers/evaluacionController.js:147-167` (`cambiarEstado`) y `:213` en adelante (`updateControl`) no comprueban permisos.
- **Sin ejecutar, solo por lectura del código:** `asignarme` (`:169-177`) asigna el control a quien lo pide aunque ya tenga otro responsable. En la prueba no hubo un control asignado a otra persona con el que probarlo.

**Corrección propuesta:** permitir los cambios solo al administrador o al responsable (`esAdminOResponsable`, como en `lib/incidentes.js:66`). En `asignarme`, permitirlo solo si el control no tiene responsable.

#### M-3 · Los formularios no tienen protección CSRF

**Pasos para reproducirlo:**

1. Con una sesión de administrador, enviar POST `/rat/{id}` con las cabeceras `Origin: https://atacante.example` y `Referer: https://atacante.example/x`.
2. Resultado: el servidor lo acepta (302) y modifica el registro.
3. Además, ningún formulario lleva token CSRF.

**Mitigación actual y riesgo:**

- La cookie de sesión es `SameSite=Lax` (`app.js:103-108`), así que los navegadores actuales no la envían en un POST que llegue desde otro sitio. Por eso no es un fallo alto.
- Sigue habiendo riesgo con navegadores antiguos o desde otro subdominio del mismo sitio.
- El ENS pide esta protección.

**Causa:** `app.js:97-112`, donde no hay middleware CSRF ni comprobación de `Origin`.

**Corrección propuesta:** el middleware debe validar un token CSRF de sesión, enviado como campo oculto `_csrf` en todos los formularios. Hay que incluir los `multipart`, comprobándolo después de multer. Como mínimo, rechazar los POST cuyo `Origin`/`Referer` no sea el propio host.

#### M-4 · No hay límite de intentos de inicio de sesión

**Pasos para reproducirlo:** hacer 15 POST `/login` seguidos con `admin@test.com` y contraseñas erróneas. Se procesan todos, sin ningún 429 ni bloqueo, y permite ataques de fuerza bruta.

**Causa:** `routes/auth.js` (POST `/login`) y `controllers/authController.js:8`, sin limitación.

**Corrección propuesta:** limitar los intentos por IP y por email (por ejemplo `express-rate-limit`: 5 fallos en 15 minutos y después 429) y registrar los intentos fallidos.

### Bajo

#### B-1 · Faltan cabeceras de seguridad y se anuncia Express

Las respuestas no incluyen `X-Frame-Options` (o CSP `frame-ancestors`), `Content-Security-Policy` ni `X-Content-Type-Options`. En cambio, envían `X-Powered-By: Express`.

- **Pasos para reproducirlo:** ver las cabeceras de GET `/dashboard`.
- **Causa:** `app.js:43` y siguientes, sin `helmet` ni `app.disable('x-powered-by')`.
- **Corrección propuesta:** `app.disable('x-powered-by')` y `helmet()`. La CSP tiene que permitir los `<script>` en línea de Alpine o pasarlos a archivos, porque `head.ejs` registra componentes en línea.

#### B-2 · Credenciales por defecto en el seed

`prisma/seed.js:10` crea `admin@test.com` / `admin1234`, y el seed de ejemplo crea empleados con `Ejemplo2026`. Son de desarrollo, pero si se despliega con ese seed quedan cuentas con contraseñas conocidas.

- **Pasos para reproducirlo:** iniciar sesión con esas credenciales.
- **Corrección propuesta:** leer la contraseña inicial del administrador de una variable de entorno (o generarla al azar y mostrarla una vez) y no ejecutar `seed-ejemplo` en producción.

#### B-3 · Sin longitud máxima en los textos

Se aceptan textos de 20.000 caracteres en todos los módulos menos Empresa (nombre ≤ 150) y Catálogo (descripción ≤ 2000). No rompe nada (no hay error ni desbordamiento visual en las pruebas), pero permite llenar la base de datos y empeora los listados.

- **Pasos para reproducirlo:** crear, por ejemplo, una actividad RAT con nombre de 20.000 caracteres. Se guarda.
- **Causa:** las funciones `validar` de cada controlador (por ejemplo `ratController.js:44-75`) solo comprueban que el campo no esté vacío.
- **Corrección propuesta:** un máximo por campo, por ejemplo 200 para nombres y títulos y 5000 para descripciones, validado en el servidor y con `maxlength` en el formulario.

#### B-4 · La tarjeta «Acciones pendientes» y la lista cuentan distinto

En la prueba coincidieron (18 y 18), porque en ese momento no había acciones de nivel informativo. Pero no cuentan lo mismo:

- la tarjeta muestra `urgentes.length`, que excluye las informativas (`views/dashboard.ejs:26`, `:168`);
- la cabecera de la lista muestra `acciones.length`, todas (`views/dashboard.ejs:215`).

Cuando haya una acción informativa (por ejemplo «La solicitud de X vence en N días», añadida en `controllers/dashboardController.js:62-67`), la lista tendrá una más que la tarjeta.

- **Corrección propuesta:** usar la misma cifra en las dos o rotular la tarjeta como «urgentes».

#### B-5 · Añadir un control al catálogo cambia el % de las evaluaciones pasadas

**Comprobado:** un control creado después aparece como «Pendiente» en las evaluaciones ya existentes. El porcentaje se calcula sobre el catálogo actual (`lib/evaluaciones.js:56-75`, `totalesCatalogo`), así que al añadir un control baja el cumplimiento de evaluaciones antiguas, incluidas las de revisiones ya cerradas. Las declaraciones no cambian porque guardan su propia foto.

- **Corrección propuesta**, si se quiere que una evaluación cerrada no cambie: guardar en la evaluación los controles vigentes al crearla, o calcular el % solo sobre sus filas.

### Observaciones (no son fallos)

- La ruta de descarga del PDF de la declaración (`/declaraciones/:id/pdf` sin `?ver=1`, con `attachment`) sigue existiendo, aunque el botón se quitó de la vista.
- Un proveedor fuera de la UE sin mecanismo de transferencia se puede guardar. Es intencionado: queda como aviso en el listado.
- El catálogo de controles no tiene filtros: agrupa por categoría.

## 4. Lo que no se ha probado y por qué

- **Aislamiento entre organizaciones (punto 2c):**
  - no aplica, porque la app es de una sola organización: la tabla `organizacion` tiene una fila y los datos no tienen `organizacion_id`;
  - en su lugar se probó el aislamiento entre usuarios:
    - un Usuario no ve ni modifica por URL las actividades RAT y riesgos de otros;
    - tampoco cambia el estado de incidentes, solicitudes ni procesos BIA de los que no es responsable;
    - tampoco borra documentos ajenos.
- **«Asignarme» un control que ya tiene otro responsable:** no se ejecutó, porque en la evaluación de prueba no había ningún control con esa situación. Está descrito en M-2 por lectura del código.
- **Errores de JavaScript en la consola del navegador:** no se pidió y no se revisó en esta pasada. Solo se revisó la consola del servidor.
- **Aspecto visual, versión móvil y accesibilidad:** fuera del alcance de estas pruebas HTTP.
- **Caducidad de la sesión (8 h) y concurrencia** (dos personas editando a la vez): no probadas.
- **Filtros del catálogo de controles:** no existen; el catálogo agrupa por categoría.
- **Tests automáticos del proyecto:** el proyecto no tiene ninguno (`package.json` no tiene script `test`). Se ejecutaron los scripts de prueba que fui escribiendo durante el desarrollo, que están fuera del repositorio (ver anexo).

## Anexo · Scripts de prueba anteriores

| Script | Resultado | Comentario |
|---|---|---|
| smoke (105 pantallas) | 100 OK · 5 FALLO | Los 5 «fallos» son expectativas erróneas del propio script: espera 403 en formularios de alta que un Usuario sí puede abrir (RAT, riesgos, incidentes, derechos, control de checklist). |
| integridad | OK | |
| desbordes | OK | Ninguna tabla se desborda horizontalmente |
| prueba-usuarios | 25 / 25 | |
| prueba-aceptacion | 5 / 5 | |
| prueba-borrar-proveedor | 8 / 8 | |
| prueba-descripcion | 18 / 18 | |
| prueba-docs-derechos | 14 / 14 | |
| prueba-empresa | 7 / 7 | |
| prueba-ens-eliminar | 20 / 20 | |
| prueba-panel2 | 33 / 33 | |
| prueba-plegables | 24 / 24 | |
| prueba-politicas | 13 OK · 1 FALLO | Expectativa obsoleta: espera el orden antiguo del menú ENS (BIA antes que Políticas). |
| prueba-proveedor | 9 OK · 2 FALLO | Expectativas obsoletas: espera el botón «Abrir» y el de «Descargar», que se quitaron a propósito. |
| prueba-sistemas | 37 OK · 2 FALLO | Expectativas obsoletas del panel anterior al rediseño. El panel por sistema se ha comprobado en este informe. |
| prueba-panel | Error del script | Busca bloques del panel antiguo que ya no existen. |

Ninguno de los fallos de estos scripts es un fallo de la aplicación; son comprobaciones escritas para versiones anteriores de la interfaz.

## 5. Correcciones aplicadas y nueva verificación

### 5.1 Qué se ha cambiado

| Fallo | Corrección | Archivos |
|---|---|---|
| **M-1** Error 500 con ids enormes | Corrección en dos niveles:<br>• `idValido` rechaza ids mayores que 2.147.483.647 (máximo de `INTEGER`), y se añade `idDeFormulario` para los campos de id opcionales (vacío → sin valor; no válido → error de validación);<br>• todas las conversiones con `Number(...)` usan ahora estas funciones, y el número de afectados tiene máximo;<br>• red de seguridad: el manejador de errores responde 404 ante `P2020`. | `lib/permisos.js`, `lib/sistemas.js`, `app.js`, controladores de RAT, riesgos, incidentes, derechos, proveedores, BIA, evaluaciones y usuarios |
| **M-2** Cualquier usuario cambiaba cualquier control ENS | Cambiar el estado, editar la evidencia o abrir la edición de un control: solo el Administrador o su responsable (si no, 403). «Asignarme» solo en controles sin responsable; reasignar es cosa del Administrador. En el checklist, quien no gestiona un control ve su estado como etiqueta, sin selector ni «Editar». | `controllers/evaluacionController.js`, `views/evaluaciones/show.ejs` |
| **M-3** Sin protección CSRF | Middleware nuevo, en tres niveles:<br>• rechaza los POST cuyo `Origin`/`Referer` sea de otro sitio;<br>• con sesión iniciada, exige el token de la sesión (`_csrf`, comparado en tiempo constante); el token se añade automáticamente a todos los `<form method="POST">` al pintar las vistas;<br>• en las subidas de archivos se comprueba después de leer el cuerpo, y un envío multipart a cualquier otra ruta se rechaza. | `middlewares/seguridad.js` (nuevo), `app.js`, `lib/subidas.js` |
| **M-4** Sin límite de intentos de login | 5 fallos con la misma IP y email bloquean ese email 15 minutos (respuesta 429 con mensaje). Un acceso correcto reinicia el contador, y las demás cuentas no se ven afectadas. | `middlewares/seguridad.js`, `controllers/authController.js` |
| **B-1** Cabeceras de seguridad | Se añaden:<br>• `Content-Security-Policy`, con `frame-ancestors 'none'`, `form-action 'self'` y `object-src 'none'`;<br>• `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Cross-Origin-Opener-Policy`.<br>Además, se quita `X-Powered-By`. La CSP permite `'unsafe-inline'`/`'unsafe-eval'` en scripts y el CDN de jsdelivr, porque Alpine.js lo necesita. | `middlewares/seguridad.js`, `app.js` |
| **B-2** Credenciales por defecto | `prisma/seed.js` ya no lleva contraseña escrita: usa `SEED_ADMIN_PASSWORD` (mínimo 12 caracteres) o genera una aleatoria que muestra una vez, y no toca a un administrador que ya exista. `db:ejemplo` (contraseñas de demostración) se niega a ejecutarse con `NODE_ENV=production`. | `prisma/seed.js`, `prisma/seed-ejemplo.js`, `.env.example` |
| **B-3** Sin longitud máxima | Límites por campo en un único sitio: 200 para nombres y títulos, 5.000 para descripciones, 50 para teléfonos…<br>• se validan en el servidor de todos los formularios, con mensaje «Campo: máximo N caracteres»;<br>• los formularios llevan `maxlength` (47 campos). | `lib/validacion.js` (nuevo), 13 controladores, 14 vistas |
| **B-4** La tarjeta y la lista de «Acciones pendientes» contaban distinto | La tarjeta muestra la misma cifra que la lista. Debajo indica las críticas, «Requieren atención» o «Solo informativas». | `views/dashboard.ejs` |
| **B-5** Un control nuevo cambiaba el % de evaluaciones pasadas | Cada evaluación guarda ahora la foto de sus controles:<br>• al crearla se crean sus filas, todas Pendientes o copiadas de la anterior;<br>• un control nuevo del catálogo se añade solo a la evaluación vigente (la última) de cada sistema;<br>• el % y las declaraciones se calculan sobre los controles de la evaluación;<br>• un control recién añadido y sin trabajar se puede borrar del catálogo.<br>Una migración de datos crea como Pendiente las filas que faltaban, que antes ya contaban como Pendiente: **ningún porcentaje cambia** (comprobado: 97 %, 59 %, 63 % y 0 %, igual que antes). | `lib/evaluaciones.js`, `lib/declaraciones.js`, controladores de evaluaciones, sistemas y catálogo, migración `20261003120000_evaluaciones_foto_controles` |

Además, de paso: `/favicon.ico` sirve el logo (el visor de PDF del navegador lo pedía y daba 404 en la consola).

### 5.2 Nueva verificación

Antes de las pruebas se hizo una copia (`backups/copia-20261003-114237.json`, ya con la migración aplicada). Al terminar se restauraron la base de datos y `uploads/`, y se comprobaron los recuentos y los porcentajes.

| Prueba | Resultado |
|---|---|
| Batería completa repetida (con los casos ajustados a los cambios) | **260 OK · 0 FALLO · 2 no aplicables** (aislamiento entre organizaciones y filtros del catálogo, que no existen) |
| Ids fuera de rango en las 11 rutas que fallaban | 404 o error de validación; **ningún 500** |
| Consola del servidor durante la batería | **0 errores** |
| CSRF: POST de otro origen · con sesión y sin token · con token falso · multipart a ruta que no es de subida · subida sin token | Todos rechazados (403, o subida no realizada); todos los formularios POST llevan el token |
| Login: 6.º intento fallido seguido | 429; otra cuenta sigue entrando con normalidad |
| Controles ENS: usuario básico sobre un control ajeno | No puede cambiar el estado (403). En su vista: 30 selectores = 30 controles suyos y 2 «Asignarme» = 2 controles libres. |
| Textos de 20.000 caracteres en todos los módulos | Rechazados con mensaje |
| Foto de la evaluación | Un control nuevo aparece en la evaluación vigente y no en la anterior; la anterior mantiene su número de controles y su %. Un control recién añadido se puede borrar; uno ya trabajado, no. |
| XSS en Incidentes, Derechos, Proveedores, Políticas, BIA y Catálogo | Escapado en todas las páginas |
| Navegador real (Chrome sin ventana) | Funcionan login, Alpine (menús y secciones plegables), envío de formularios con el token, cambio de estado desde el checklist, ver PDF y cerrar sesión. **Sin errores en la consola** (ni de CSP ni de JavaScript). |
| `NODE_ENV=production npm run db:ejemplo -- --confirmar` | Se niega a ejecutarse |

**No ejecutado:** `npm run prisma:seed`, porque añadiría al catálogo los 12 controles genéricos del seed básico. Solo se comprobó su sintaxis. Los scripts de prueba anteriores del anexo no se han actualizado para enviar el token CSRF, así que sus POST ahora reciben 403 (es el comportamiento esperado).

## 6. Pruebas dentro del repositorio (03/10/2026)

La batería principal de este informe está ahora en el repositorio:
- `tests/pruebas-funcionales.js`: las pruebas;
- `tests/ejecutar.js`: el lanzador.

Se ejecuta con `npm test`, con la app en marcha y los datos de ejemplo cargados:
1. hace una copia de la base de datos;
2. ejecuta las pruebas;
3. siempre restaura los datos y borra de `uploads/` los archivos que hayan creado las pruebas.

Primera ejecución desde el repositorio: **262 pruebas · 260 OK · 0 FALLO · 2 no aplicables**,
con los datos restaurados al terminar. El detalle de cada ejecución queda en `tests/resultados.json`
(no se versiona).

Los scripts auxiliares que se usaron durante la revisión (`repeticion.js`, `xss.js`, `navegador.js` con
Chrome sin ventana) no se han incorporado. Sus comprobaciones están descritas en la sección 5:
XSS por módulo, borrado de controles del catálogo y prueba en navegador real.

Después, en el paso de documentación del código, solo se añadieron comentarios. Un script comparó
los tokens de cada archivo con el commit anterior para confirmar que la lógica no había cambiado.
