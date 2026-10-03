# PRD · Compliance AI (RGPD + ENS)

Documento de requisitos del producto, redactado a partir del código actual. Lo que no se puede
deducir del código está marcado como [COMPLETAR].

## 1. Problema

Una organización sujeta a la vez al RGPD y al ENS tiene que llevar, entre otras cosas:
- el registro de actividades de tratamiento y sus riesgos;
- las brechas y su notificación a la AEPD en 72 h;
- las solicitudes de derechos con plazo de un mes;
- los contratos con encargados;
- el grado de implantación de las medidas del ENS por sistema y las Declaraciones de Conformidad;
- la política de seguridad y su aceptación;
- la continuidad de negocio.

La aplicación reúne todo eso en un único sitio. Usa el **sistema de información** como eje común
de las dos normas y avisa de los plazos que vencen.

[COMPLETAR: contexto y motivación del TFM (organización tipo, situación de partida, por qué una
herramienta propia)]

## 2. Usuarios y roles

La aplicación tiene dos roles (`enum Rol`):

| Rol | Puede |
|---|---|
| **Administrador** (`ADMIN`) | Todo lo del Usuario, más la estructura de todos los módulos: sistemas y evaluaciones, catálogo de controles, Declaraciones de Conformidad, políticas, proveedores, alta de procesos BIA, datos de la empresa y usuarios. Asigna responsables y es el único que elimina registros. |
| **Usuario** (`USUARIO`) | Consulta los módulos y registra información. Solo ve y edita **sus** actividades RAT y los riesgos de esas actividades. Gestiona los incidentes, solicitudes de derechos, procesos BIA y controles ENS de los que es **responsable**, y puede asignarse un control ENS sin responsable. Solo ve las políticas Aprobadas y acepta las que le afectan. |

**Cuentas desactivadas:**
- un usuario desactivado no puede entrar y pierde su sesión abierta;
- los usuarios no se borran: se conserva su historial.

**Sistemas asignados:**
- cada usuario tiene asignados los sistemas en los que trabaja;
- de ellos depende qué políticas de sistema debe aceptar.

En los datos de ejemplo, el rol Administrador lo tienen la Dirección, el DPD y la Responsable de Seguridad; el resto de la plantilla es Usuario.

## 3. Funcionalidades por módulo

### Sistemas de información (`/sistemas`)
- **Listado:** por cada sistema, categoría ENS, % de implementación de su última evaluación, riesgos altos e incidentes abiertos, más una fila «Sin sistema · Transversal».
- **Ficha del sistema:** con pestañas.
  - Resumen.
  - Información RGPD asociada: actividades RAT, riesgos, incidentes y derechos.
  - Checklist ENS: evaluaciones con sus declaraciones.
  - Continuidad (BIA).
- **Histórico:** de cambios de estado de los controles, filtrable por evaluación y control.
- **Alta, edición y baja:** solo el Administrador.
  - Al dar de alta un sistema se puede crear su primera evaluación.
  - Al borrar un sistema, lo asociado queda transversal.
  - No se puede borrar si tiene Declaraciones de Conformidad.

### Panel de control (`/dashboard`)
- **Vista:** de toda la organización o de un sistema concreto («Ver por sistema», `?sistema=ID`).
- **Tarjetas:**
  - cumplimiento ENS;
  - acciones pendientes;
  - incidentes abiertos;
  - próximo vencimiento.
- **Acciones pendientes:** ordenadas por urgencia (crítico, atención, informativo) y con el sistema al que se refieren. Combinan los avisos con plazo y las recomendaciones del asistente de cumplimiento, que funciona con reglas explícitas, sin modelos de IA.
- **Bloques plegables:**
  - RGPD (incluye riesgos e incidentes);
  - ENS (incluye BIA);
  - actividad reciente de todos los historiales.

### RGPD
- **Actividades de tratamiento (RAT, art. 30):**
  - finalidad, base legal (art. 6.1), categorías de datos e interesados, destinatarios, plazo de conservación, medidas, transferencias internacionales, sistema y responsable;
  - filtro por sistema.
- **Evaluación de riesgos:**
  - cada riesgo cuelga de una actividad;
  - probabilidad e impacto, con el nivel calculado;
  - filtros por nivel, sistema y actividad.
- **Incidentes y brechas (arts. 33-34):**
  - tipo (confidencialidad, integridad o disponibilidad), gravedad, fechas, datos y personas afectadas, medidas, notificación a la AEPD y a los afectados;
  - historial de estados;
  - filtros por estado, gravedad, sistema y avisos (activos, AEPD pendiente, AEPD vencido);
  - no se eliminan.
- **Derechos de los interesados (art. 12, arts. 15-22):**
  - registro de la solicitud con el plazo calculado;
  - tramitación por estados, ampliación del plazo, resolución con motivo de denegación;
  - historial;
  - documentos PDF adjuntos;
  - filtros por estado, tipo, plazo y sistema.
- **Proveedores / encargados (art. 28):**
  - contrato de encargado (fechas de firma y revisión), nivel ENS, transferencias fuera del EEE y su mecanismo;
  - documentos PDF;
  - avisos;
  - baja lógica (estado «Baja») o eliminación por el Administrador.

### ENS
- **Catálogo de controles** (solo Administrador): controles con categoría (Básica, Media, Alta) y descripción. Los datos de ejemplo cargan 39 medidas del Anexo II.
- **Evaluaciones (checklist):**
  - cada sistema puede tener varias evaluaciones;
  - cada control tiene estado (Implementado, Pendiente, No aplicable), evidencia, responsable y fecha del último cambio;
  - histórico de cambios.
  - Una evaluación nueva puede copiar los estados de la anterior.
- **Declaraciones de Conformidad:**
  - se generan desde una evaluación como foto fija, versionadas por sistema;
  - pasan por Borrador, Emitida y Superada;
  - el PDF se puede ver en el navegador.
- **Políticas y documentación:**
  - documentos normativos generales o de un sistema, con versiones en PDF y estados (Borrador, Pendiente de aprobación, Aprobada, Obsoleta);
  - fecha de próxima revisión;
  - aceptación por los usuarios afectados;
  - documentos adjuntos.
- **BIA y continuidad:**
  - procesos de negocio con criticidad, impactos, RTO/RPO, recursos mínimos, estrategia y estado del análisis;
  - pruebas de continuidad (tipo y resultado).

### Administración
- **Datos de la empresa:** una sola organización, cuyo nombre se muestra en la cabecera de todas las pantallas.
- **Usuarios:**
  - alta y edición con cargo, rol y sistemas asignados;
  - activar y desactivar;
  - por cada usuario, las políticas que tiene pendientes de aceptar.

### Páginas legales (públicas)
- **Páginas:** Aviso legal (`/aviso-legal`, art. 10 LSSI-CE), Política de privacidad (`/privacidad`, arts. 13-14 RGPD y LOPDGDD) y Política de cookies (`/cookies`, art. 22.2 LSSI-CE).
- **Acceso:** sin iniciar sesión, enlazadas desde el pie de todas las pantallas, incluido el login.
- **Aviso de prueba:** cada página muestra «Datos ficticios — proyecto académico» y su fecha de última actualización.
- **Contenido de la privacidad:** describe los datos que guarda realmente la aplicación según su modelo de datos (usuarios, solicitantes de derechos, contactos de proveedores, cargos de la organización), los encargados (Neon, jsDelivr) y los plazos de conservación.
- **Datos del titular, DPD y encargados:** son ficticios y están en `config/legal.js`.

## 4. Reglas de negocio

| Regla | Detalle | Dónde |
|---|---|---|
| **72 h AEPD** | Si un incidente requiere notificación a la AEPD y no consta la fecha de notificación, el plazo vence 72 h después de la **fecha de detección**. En la ficha, las horas restantes se redondean hacia arriba y el retraso hacia abajo. | `lib/incidentes.js` (`plazoAepd`) |
| **Un mes (derechos)** | Fecha límite = mismo día del mes siguiente a la recepción, a las 23:59:59 (hora de España). Si ese día no existe, el último día del mes (Reglamento 1182/71). | `lib/formato.js` (`finPlazoMeses`), `lib/derechos.js` |
| **Ampliación** | Puede ampliarse **2 meses** más (3 en total) con motivo, sin haber resuelto la solicitud y **dentro del primer mes**. | `controllers/derechoController.js` |
| **Urgencia de derechos** | Más de 10 días: verde. 10 días o menos: amarillo. Vencida sin resolver: rojo. Resuelta: «en plazo» o «fuera de plazo» según la fecha de respuesta. Denegar exige motivo. | `lib/derechos.js` (`urgencia`) |
| **Nivel de riesgo** | Probabilidad × impacto, cada uno de 1 a 3. Puntuación 1-2: Bajo. 3-4: Medio. 6-9: Alto. Lo calcula siempre el servidor. | `lib/riesgo.js` |
| **% de cumplimiento ENS** | Implementados ÷ (controles de la evaluación − «No aplicable»), redondeado a entero. 0 % si no queda ningún control aplicable. El % del sistema es el de su **última** evaluación; el de «Todos los sistemas» es la **media** de los sistemas evaluados. | `lib/ens.js`, `lib/panel.js` |
| **Foto de la evaluación** | Cada evaluación guarda los controles que existían al crearla. Un control nuevo del catálogo se añade como Pendiente solo a la evaluación vigente de cada sistema, así que las anteriores no cambian. | `lib/evaluaciones.js` |
| **12 meses · continuidad** | Un proceso de criticidad Alta o Crítica debe tener una prueba de continuidad en los últimos 12 meses. El panel avisa 30 días antes de que se cumpla y lo marca como vencido si no la hay. | `lib/bia.js`, `lib/panel.js` |
| **12 meses · declaraciones** | Una Declaración de Conformidad emitida es vigente durante 12 meses. Generar una nueva versión pasa las anteriores a «Superada». Una emitida no se modifica y solo se pueden eliminar borradores. | `lib/declaraciones.js`, `lib/panel.js` |
| **Revisión de políticas** | Aviso 30 días antes de la fecha de próxima revisión y «vencida» pasada esa fecha. Las Obsoletas no avisan. | `lib/politicas.js` |
| **Aceptación de políticas** | Solo las Aprobadas que requieren aceptación. Una **General** la aceptan todos los usuarios activos; una de **sistema**, los activos asignados a ese sistema. La aceptación es por **versión**, y no se puede aprobar una política sin su PDF. | `lib/usuarios.js`, `controllers/politicaController.js` |
| **Proveedores** | Avisos de: falta de contrato de encargado, revisión del contrato vencida o en 30 días, y transferencia fuera del EEE sin mecanismo (se permite guardar, pero queda marcada). | `lib/proveedores.js` |
| **Usuarios** | Un administrador no puede desactivarse ni quitarse el rol, y siempre queda al menos un administrador activo. | `controllers/usuarioController.js` |
| **Cookies** | Solo técnicas: la cookie de sesión `sid` (8 h, solo con sesión iniciada) y el almacenamiento local de las secciones desplegadas del panel. Están exentas de consentimiento (art. 22.2 LSSI-CE), por lo que no hay banner. | `app.js`, `views/partials/head.ejs`, `config/legal.js` |
| **Documentos** | Solo PDF (comprobada la firma `%PDF-`) de hasta 10 MB, guardados con nombre aleatorio. | `lib/subidas.js` |

## 5. Fuera del alcance

No está implementado en el código:
- **Varias organizaciones (multiempresa):** hay una única organización.
- **Integraciones externas:** no hay notificación electrónica a la AEPD, ni envío de correos o avisos fuera de la aplicación, ni firma electrónica de las declaraciones.
- **Plazos en días hábiles:** no se trasladan al siguiente día hábil si vencen en festivo o fin de semana.
- **EIPD (art. 35) como flujo propio:** los riesgos se gestionan por actividad.
- **API pública y aplicación móvil.**
- **Idiomas distintos del español.**
- **Gestión del consentimiento de cookies (banner):** no hace falta mientras solo haya cookies técnicas.
- **Inteligencia artificial:** el «asistente» del panel funciona con reglas fijas, sin modelos de IA.

[COMPLETAR: si alguna de estas exclusiones es una decisión del TFM (y no solo algo pendiente), indicarlo]
