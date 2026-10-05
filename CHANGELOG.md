# Historial de cambios

Cambios agrupados por fecha a partir del historial de git (los más recientes primero). Entre
paréntesis, el commit.

## 04/10/2026

- **Despliegue en Render** (https://tfm-rgpd-ens.onrender.com, región Frankfurt, base de datos en Neon):
  - preparación con el script `build` y `.node-version` (2957cf7);
  - URL de la demostración en el README (9bfe209, 5576fcf).
- **Sesiones en PostgreSQL** con connect-pg-simple: la sesión no se cierra al reiniciarse el servidor y caduca tras 8 horas sin actividad (ee8389f).
- **Documentación:** el plan, la arquitectura y este historial recogen el despliegue.

## 03/10/2026

- **Documentación actualizada con las páginas legales** (README, CLAUDE.md, AGENTS.md, PRD, arquitectura, plan y este historial).
- **Páginas legales públicas** (4c70cdf):
  - Aviso legal, Política de privacidad y Política de cookies, con datos ficticios en `config/legal.js`;
  - pie de página con sus enlaces en todas las pantallas;
  - solo cookies técnicas, sin banner.
- **Documentación, código comentado y pruebas** (0a6d686):
  - código comentado en español (JSDoc y `///` en el esquema), con los fallos anotados como «FALLO DETECTADO»;
  - README, CLAUDE.md, AGENTS.md, docs/, CHANGELOG y LICENSE (MIT);
  - `tests/` con `npm test` y el script `npm run seed`;
  - `.env.example` completo y `.gitignore` ampliado.
- **Correcciones de las pruebas** (dbed80f):
  - ids fuera de rango sin errores 500;
  - controles ENS solo para el Administrador o el responsable;
  - protección CSRF;
  - límite de intentos de login;
  - cabeceras de seguridad;
  - seed sin contraseña escrita;
  - longitud máxima de los textos;
  - contador del panel;
  - cada evaluación guarda la foto de sus controles.
  - Además, se añade `INFORME_PRUEBAS.md`.
- **Panel y menús:**
  - Inicio: las acciones pendientes se abren pulsando su título (95bdd73).
  - Menú ENS: Catálogo de controles como primera opción (c151497) y BIA y Continuidad como cuarta, tras Políticas (ce2a444).
- **Sistemas y evaluaciones:**
  - Ficha del sistema: cada evaluación muestra a su derecha sus declaraciones (cfc6b70) y se quita «Ver histórico», que queda dentro de cada evaluación (1f1024b).
  - Evaluaciones: se abren desde el título; Eliminar, dentro de la evaluación (3d3622d).
  - Sistemas: sin columna Acciones; se entra pulsando el nombre (1af6a73).
- **Documentos:**
  - Se quitan las opciones de descargar donde ya está la de ver el PDF (20ea839).
  - Derechos de los interesados: documentos adjuntos a cada solicitud (c36b18c).
- **Usuarios:**
  - El campo «Área» pasa a ser «Cargo» (58aa101).
  - Gestión de usuarios con sistemas asignados y desactivación; la aceptación de políticas depende del sistema (cd1d6f4).
- **Políticas:**
  - Sistema asociado (o General) y documentos adjuntos (4e25a2a); se quita el «Ver documento» duplicado (d7c35db).
  - Datos de ejemplo: PDF de cada política para poder probar la aceptación (db1e806).
- **Listados y fichas:**
  - Listados RGPD sin columna de acciones: se entra pulsando el nombre (ad36bd6).
  - ENS: se entra pulsando el nombre; Editar y Eliminar dentro de la ficha (bb9e8b5).
  - Catálogo de controles: se quita «Añadir» por categoría (8824aa9).

## 02/10/2026

- **Proveedores:**
  - datos y documentos en una sola ficha (329969f);
  - opción de eliminar junto a «Editar», solo administradores (9833d46).
- **Sistemas de información:**
  - sin botón «Catálogo de controles» (381d569) ni histórico por fila (c9e652b);
  - una sola acción «Última evaluación» (8caa655), después «Evaluar ENS» / «Última evaluación ENS» (6f6c2cd).
- **Ficha de sistema:**
  - sin el bloque «Registrar información» (9dc3404);
  - Editar y Eliminar arriba a la derecha (3186520).
- **Panel de control:** BIA dentro de ENS, y riesgos e incidencias dentro de RGPD (6856eda).
- **Listados:** ninguna tabla corta la columna de acciones (0d4e3c5).

## 01/10/2026

- **Panel de control:**
  - rediseño con jerarquía clara y sin datos repetidos (3d6e218);
  - zona RGPD antes que ENS (8ff4ac7);
  - bloques plegables (68f74f3);
  - sistema de cada acción pendiente (1eda0a6) y de cada evento (804aebe).
- **Ficha de sistema:** RGPD a la izquierda, ENS a la derecha (a39677d).
- **Datos de ejemplo:**
  - farmacéutica ficticia y scripts de copia de seguridad (a350794);
  - datos de la empresa en la cabecera y 3 sistemas por departamento (3a51a28).
- **Migraciones:** fin de línea LF fijo para que su checksum no cambie al clonar (39a40f2).
- **Controles ENS:** descripción de cada control y descripciones del Anexo II (e026470).

## 29/09/2026

- **Panel de control:** organizado por sistema de información (17a2dfc).
- **Código de color de área:**
  - RGPD índigo, ENS violeta, neutro gris (7a76523);
  - refuerzo de la diferenciación (32b2c40) y corrección del área en RAT (42cf13d).
- **Estilos:** versionado del CSS para evitar la caché (0059429).

## 28/09/2026

- **Sistema de información como eje central de RGPD y ENS** (25d1ba3).

## 27/09/2026

- **Módulos nuevos:**
  - Derechos de los interesados (6f70228);
  - Proveedores y Declaraciones de Conformidad (e48c5e8);
  - Políticas y documentación (c531134);
  - BIA y continuidad (de261da).
- **Panel de control ejecutivo** en Inicio (6273ca8).
- **Rediseño visual integral** «Compliance AI» (35637fe).

## 26/09/2026

- **Base del proyecto:** Express, Prisma, EJS y Tailwind (881dbf1).
- **Autenticación:** con Passport y roles (2adb36e).
- **Módulos:** RAT (5649595), Evaluación de riesgos (139a7fb), Checklist ENS (7d107f2), evaluaciones ENS por sistema con histórico (6a26191) e Incidentes y brechas (63f83b0).
- **Navegación:** barra con menús desplegables (9220c40).
