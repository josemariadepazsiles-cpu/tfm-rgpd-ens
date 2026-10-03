// Batería de pruebas funcionales contra la app en marcha (TEST_URL, por defecto http://localhost:3000).
// No se ejecuta directamente: la lanza tests/ejecutar.js (npm test), que hace una copia de la base
// de datos antes y la restaura después. Escribe tests/resultados.json con
// { modulo, prueba, resultado, detalle }.
const path = require('path');
const P = path.resolve(__dirname, '..');
process.chdir(P);
require('dotenv').config({ quiet: true });
const fs = require('fs');
const prisma = require('../lib/prisma');
const B = process.env.TEST_URL || 'http://localhost:3000';
const SALIDA = path.join(__dirname, 'resultados.json');

const resultados = [];
const R = (modulo, prueba, ok, detalle = '') => {
  const resultado = ok === 'NP' ? 'NO PROBADO' : ok ? 'OK' : 'FALLO';
  resultados.push({ modulo, prueba, resultado, detalle: String(detalle).slice(0, 400) });
  if (resultado !== 'OK') console.log(`[${resultado}] ${modulo} · ${prueba} · ${String(detalle).slice(0, 200)}`);
};
const errores500 = [];
const trazas = [];
const TRAZA = /(at [\w.<>]+ \(.*\.js:\d+|PrismaClient|Invalid `prisma|node_modules[\\/])/;

const tokens = new Map(); // cookie → token CSRF
const pedir = async (cookie, metodo, ruta, cuerpo, extraHeaders = {}, sinToken = false) => {
  if (metodo === 'POST' && cookie && !sinToken) {
    if (!tokens.has(cookie)) { const h = await (await fetch(B + '/dashboard', { headers: { cookie } })).text(); tokens.set(cookie, (h.match(/name="_csrf" value="([^"]+)"/) || [])[1]); }
    const t = tokens.get(cookie);
    if (t) { if (cuerpo instanceof FormData) { if (!cuerpo.has('_csrf')) cuerpo.append('_csrf', t); } else cuerpo = { _csrf: t, ...(cuerpo || {}) }; }
  }
  const headers = { ...(cookie ? { cookie } : {}), ...extraHeaders };
  let body;
  if (cuerpo instanceof FormData) body = cuerpo;
  else if (cuerpo) {
    body = new URLSearchParams();
    Object.entries(cuerpo).forEach(([k, v]) => [].concat(v).forEach((x) => body.append(k, x)));
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  const r = await fetch(B + ruta, { method: metodo, headers, body, redirect: 'manual' });
  const tipo = r.headers.get('content-type') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  const html = tipo.includes('text') ? buf.toString('utf8') : '';
  if (r.status >= 500) errores500.push(`${metodo} ${ruta} → ${r.status}`);
  if (html && TRAZA.test(html)) trazas.push(`${metodo} ${ruta}`);
  return { status: r.status, html, loc: r.headers.get('location'), tipo, buf, headers: r.headers };
};
const cliente = (cookie) => ({
  cookie,
  get: (p, h) => pedir(cookie, 'GET', p, null, h),
  post: (p, d, h) => pedir(cookie, 'POST', p, d || {}, h),
  postSinToken: (p, d, h) => pedir(cookie, 'POST', p, d || {}, h, true),
});
const login = async (email, password) => {
  const r = await fetch(B + '/login', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email, password }) });
  return { cookie: (r.headers.get('set-cookie') || '').split(';')[0], setCookie: r.headers.get('set-cookie') || '', loc: r.headers.get('location'), status: r.status, html: await r.text() };
};
const erroresDe = (html) => [...(html.split('role="alert"')[1] || '').split('</ul>')[0].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1].trim()).join(' | ');
const idDe = (loc, base) => { const m = new RegExp(`^${base}/(\\d+)`).exec(loc || ''); return m ? Number(m[1]) : null; };
const LARGO = 'x'.repeat(20000);
const pdf = (nombre = 'prueba.pdf') => new File([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')], nombre, { type: 'application/pdf' });
const noPdf = () => new File([Buffer.from('MZ esto no es un pdf')], 'virus.pdf', { type: 'application/pdf' });
const fd = (campos, archivo) => { const f = new FormData(); Object.entries(campos).forEach(([k, v]) => f.append(k, v)); if (archivo) f.append('archivo', archivo); return f; };
const hoyInput = (deltaHoras = 0) => { const d = new Date(Date.now() + deltaHoras * 3600e3); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const fechaInput = (deltaDias = 0) => hoyInput(deltaDias * 24).slice(0, 10);

const creados = { usuarios: [] };
const pctEval = async (evId) => { const filas = await prisma.evaluacionControl.findMany({ where: { evaluacion_id: evId } }); const imp = filas.filter((f) => f.estado === 'IMPLEMENTADO').length; const apl = filas.length - filas.filter((f) => f.estado === 'NO_APLICA').length; return { imp, apl, pct: apl ? Math.round(imp / apl * 100) : 0 }; };

(async () => {
  const admin = cliente((await login('admin@test.com', 'admin1234')).cookie);
  const yo = await prisma.usuario.findUnique({ where: { email: 'admin@test.com' } });
  const carmenU = await prisma.usuario.findUnique({ where: { email: 'carmen.vidal@labfarmareunidos.example' } });
  const carmen = cliente((await login(carmenU.email, 'Ejemplo2026')).cookie);
  const anon = cliente(null);
  const sis = await prisma.sistema.findFirst({ where: { nombre: 'Área de informática' } });

  // ====================== a) ACCESO ======================
  {
    const M = 'Acceso';
    let l = await login('admin@test.com', 'admin1234');
    R(M, 'Login correcto redirige al panel', l.status === 302 && l.loc === '/dashboard', `status ${l.status} → ${l.loc}`);
    const malPw = await login('admin@test.com', 'incorrecta');
    R(M, 'Contraseña incorrecta: rechazado sin sesión', malPw.status >= 400 && malPw.loc !== '/dashboard', `status ${malPw.status}`);
    const noExiste = await login('nadie@noexiste.example', 'loquesea123');
    R(M, 'Usuario inexistente: rechazado', noExiste.status >= 400 && noExiste.loc !== '/dashboard', `status ${noExiste.status}`);
    const msg = (h) => (h.match(/role="alert"[^>]*>([\s\S]*?)<\//) || [])[1] || (h.match(/(Email o contraseña[^<]*|Credenciales[^<]*|incorrect[^<]*)/i) || [])[1] || '';
    R(M, 'Mismo mensaje para usuario inexistente y contraseña errónea (no revela si el email existe)', msg(malPw.html) === msg(noExiste.html) && msg(malPw.html) !== '', `«${msg(malPw.html).trim().slice(0, 80)}» vs «${msg(noExiste.html).trim().slice(0, 80)}»`);
    const vacio = await login('', '');
    R(M, 'Login con campos vacíos: rechazado', vacio.status >= 400 || (vacio.status === 302 && vacio.loc !== '/dashboard'), `status ${vacio.status} ${vacio.loc || ''}`);
    // Sesión nueva tras el login (protección frente a fijación de sesión)
    const previa = await fetch(B + '/login'); const cookiePrevia = (previa.headers.get('set-cookie') || '').split(';')[0];
    R(M, 'Cookie de sesión con HttpOnly y SameSite', /HttpOnly/i.test(l.setCookie) && /SameSite=Lax/i.test(l.setCookie), l.setCookie.replace(/sid=[^;]+/, 'sid=…'));
    R(M, 'GET /login no crea sesión antes de autenticarse', !cookiePrevia, cookiePrevia ? 'crea cookie' : 'sin cookie');
    // Logout
    const tmp = cliente(l.cookie);
    let x = await tmp.post('/logout');
    R(M, 'Cerrar sesión redirige', x.status === 302, `status ${x.status} → ${x.loc}`);
    x = await tmp.get('/dashboard');
    R(M, 'Tras cerrar sesión, la cookie antigua ya no sirve', x.status === 302 && x.loc === '/login', `status ${x.status} → ${x.loc}`);
    x = await anon.get('/logout');
    R(M, 'GET /logout no cierra sesión (solo POST)', x.status === 404, `status ${x.status}`);
    // Rutas privadas sin sesión
    const privadas = ['/dashboard', '/sistemas', `/sistemas/${sis.id}`, '/rat', '/rat/nueva', '/riesgos', '/incidentes', '/derechos', '/proveedores', '/declaraciones', '/politicas', '/bia', '/controles', '/empresa', '/usuarios', '/usuarios/nuevo', '/registro', '/evaluaciones/1'];
    const malas = [];
    for (const p of privadas) { const r = await anon.get(p); if (!(r.status === 302 && r.loc === '/login')) malas.push(`${p}→${r.status}`); }
    R(M, `Rutas privadas sin sesión redirigen a /login (${privadas.length} rutas GET)`, !malas.length, malas.join(', ') || 'todas → /login');
    const postAnon = await anon.post('/rat', { nombre: 'x' });
    R(M, 'POST privado sin sesión redirige a /login', postAnon.status === 302 && postAnon.loc === '/login', `status ${postAnon.status}`);
    x = await admin.get('/login');
    R(M, 'Con sesión, /login lleva al panel', x.status === 302 && x.loc === '/dashboard', `status ${x.status}`);
    // Usuario desactivado
    const pass = 'Desactivado123';
    const bcrypt = require('bcryptjs');
    const desact = await prisma.usuario.create({ data: { nombre: 'Prueba Desactivado', email: 'desactivado.prueba@example.test', password_hash: await bcrypt.hash(pass, 10), rol: 'USUARIO', activo: false } });
    creados.usuarios.push(desact.id);
    const d = await login(desact.email, pass);
    R(M, 'Usuario desactivado no puede entrar', d.status >= 400 && /desactivada/i.test(d.html), `status ${d.status}`);
    // Fuerza bruta: 15 intentos seguidos
    let bloqueado = false;
    // Email nuevo en cada ejecución: el bloqueo dura 15 min y se guarda en la memoria del servidor
    const emailFuerzaBruta = `fuerza.bruta.${Date.now()}@example.test`;
    let primero429 = null;
    for (let i = 1; i <= 8; i++) { const r = await login(emailFuerzaBruta, 'mal' + i); if (r.status === 429 && !primero429) { primero429 = i; bloqueado = true; } }
    R(M, 'Límite de intentos de login: tras 5 fallos, el 6.º intento → 429', primero429 === 6, primero429 ? `bloquea en el intento ${primero429}` : 'no hay límite');
    const otro = await login('carmen.vidal@labfarmareunidos.example', 'Ejemplo2026');
    R(M, 'El bloqueo es por email: otra cuenta sigue pudiendo entrar', otro.status === 302 && otro.loc === '/dashboard', `status ${otro.status}`);
  }

  // ====================== b) ROLES ======================
  {
    const M = 'Roles';
    const soloAdminGet = ['/usuarios', '/usuarios/nuevo', `/usuarios/${yo.id}/editar`, '/registro', '/controles', '/controles/nuevo', '/sistemas/nuevo', `/sistemas/${sis.id}/editar`, '/proveedores/nuevo', '/politicas/nueva', '/bia/nuevo'];
    const fallan = [];
    for (const p of soloAdminGet) { const r = await carmen.get(p); if (r.status !== 403) fallan.push(`${p}→${r.status}`); }
    R(M, `Usuario básico: pantallas de administrador por URL directa → 403 (${soloAdminGet.length})`, !fallan.length, fallan.join(', ') || 'todas 403');
    const pol1 = await prisma.politica.findFirst(); const prov1 = await prisma.proveedor.findFirst(); const bia1 = await prisma.procesoNegocio.findFirst();
    const rat1 = await prisma.actividadRat.findFirst({ where: { usuario_id: carmenU.id } }) || await prisma.actividadRat.findFirst();
    const rie1 = await prisma.riesgo.findFirst(); const ev1 = await prisma.evaluacion.findFirst(); const ctl1 = await prisma.controlEns.findFirst(); const dec1 = await prisma.declaracionConformidad.findFirst();
    const acciones = [
      [`/sistemas/${sis.id}/eliminar`, () => prisma.sistema.count({ where: { id: sis.id } })],
      [`/rat/${rat1.id}/eliminar`, () => prisma.actividadRat.count({ where: { id: rat1.id } })],
      [`/riesgos/${rie1.id}/eliminar`, () => prisma.riesgo.count({ where: { id: rie1.id } })],
      [`/proveedores/${prov1.id}/eliminar`, () => prisma.proveedor.count({ where: { id: prov1.id } })],
      [`/politicas/${pol1.id}/eliminar`, () => prisma.politica.count({ where: { id: pol1.id } })],
      [`/bia/${bia1.id}/eliminar`, () => prisma.procesoNegocio.count({ where: { id: bia1.id } })],
      [`/evaluaciones/${ev1.id}/eliminar`, () => prisma.evaluacion.count({ where: { id: ev1.id } })],
      [`/controles/${ctl1.id}/eliminar`, () => prisma.controlEns.count({ where: { id: ctl1.id } })],
      [`/declaraciones/${dec1.id}/eliminar`, () => prisma.declaracionConformidad.count({ where: { id: dec1.id } })],
    ];
    const malas = [];
    for (const [ruta, existe] of acciones) { const r = await carmen.post(ruta); if (r.status !== 403 || !(await existe())) malas.push(`${ruta}→${r.status}`); }
    R(M, `Usuario básico: eliminar por POST directo → 403 y el registro sigue (${acciones.length} módulos)`, !malas.length, malas.join(', ') || 'todas 403');
    const orgAntes = await prisma.organizacion.findFirst();
    let r = await carmen.post('/empresa', { nombre: 'HACKEADA' });
    const orgDespues = await prisma.organizacion.findFirst();
    R(M, 'Usuario básico: guardar Datos de la empresa → 403', r.status === 403 && orgDespues.nombre === orgAntes.nombre, `status ${r.status}`);
    r = await carmen.post('/usuarios', { nombre: 'Intruso', email: 'intruso@example.test', rol: 'ADMIN', password: 'Intruso12345' });
    const intruso = await prisma.usuario.findUnique({ where: { email: 'intruso@example.test' } });
    R(M, 'Usuario básico: crear usuario (incluso ADMIN) → 403', r.status === 403 && !intruso, `status ${r.status}`);
    r = await carmen.post(`/usuarios/${carmenU.id}`, { nombre: carmenU.nombre, email: carmenU.email, rol: 'ADMIN' });
    R(M, 'Usuario básico: no puede ascenderse a ADMIN', r.status === 403 && (await prisma.usuario.findUnique({ where: { id: carmenU.id } })).rol === 'USUARIO', `status ${r.status}`);
    r = await carmen.post(`/sistemas/${sis.id}/evaluaciones`, { nombre: 'x' });
    R(M, 'Usuario básico: crear evaluación → 403', r.status === 403, `status ${r.status}`);
    r = await carmen.post(`/evaluaciones/${ev1.id}/declaracion`);
    R(M, 'Usuario básico: generar declaración → 403', r.status === 403, `status ${r.status}`);
    r = await carmen.post(`/declaraciones/${dec1.id}/emitir`);
    R(M, 'Usuario básico: emitir declaración → 403', r.status === 403, `status ${r.status}`);
    r = await carmen.post(`/politicas/${pol1.id}/estado`, { estado: 'OBSOLETA' });
    R(M, 'Usuario básico: cambiar estado de política → 403', r.status === 403, `status ${r.status}`);
    r = await carmen.post(`/proveedores/${prov1.id}`, { nombre_empresa: 'X' });
    R(M, 'Usuario básico: editar proveedor → 403', r.status === 403, `status ${r.status}`);
    r = await carmen.get('/dashboard');
    R(M, 'Usuario básico: el menú no muestra Usuarios ni Catálogo de controles', !r.html.includes('href="/usuarios"') && !r.html.includes('href="/controles"'), '');
    // Registros de otros usuarios (RAT y riesgos tienen ámbito por usuario)
    const ratAjena = await prisma.actividadRat.findFirst({ where: { usuario_id: { not: carmenU.id } } });
    r = await carmen.get(`/rat/${ratAjena.id}`);
    R(M, 'Usuario básico: no ve por URL una actividad RAT de otro usuario', r.status === 404 || r.status === 403, `status ${r.status}`);
    r = await carmen.get(`/rat/${ratAjena.id}/editar`);
    R(M, 'Usuario básico: no edita por URL una actividad RAT de otro usuario (GET)', r.status === 404 || r.status === 403, `status ${r.status}`);
    const antesRat = ratAjena.nombre;
    r = await carmen.post(`/rat/${ratAjena.id}`, { nombre: 'MODIFICADA', finalidad: 'x', base_legal: 'CONTRATO', categorias_datos: 'x', categorias_interesados: 'x', destinatarios: 'x', plazo_conservacion: 'x', medidas_seguridad: 'x' });
    R(M, 'Usuario básico: no modifica por POST una actividad RAT de otro usuario', (await prisma.actividadRat.findUnique({ where: { id: ratAjena.id } })).nombre === antesRat, `status ${r.status}`);
    const rieAjeno = await prisma.riesgo.findFirst({ where: { actividad: { usuario_id: { not: carmenU.id } } } });
    r = await carmen.get(`/riesgos/${rieAjeno.id}`);
    R(M, 'Usuario básico: no ve por URL un riesgo de otro usuario', r.status === 404 || r.status === 403, `status ${r.status}`);
    r = await carmen.post('/riesgos', { actividad_id: ratAjena.id, amenaza: 'x', probabilidad: 'ALTA', impacto: 'ALTO' });
    R(M, 'Usuario básico: no crea riesgos sobre actividades de otros', r.status === 400, `status ${r.status}`);
    // Incidentes, derechos, BIA, controles: solo admin o responsable
    const incAjeno = await prisma.incidente.findFirst({ where: { OR: [{ responsable_id: null }, { responsable_id: { not: carmenU.id } }] } });
    r = await carmen.post(`/incidentes/${incAjeno.id}/estado`, { estado: 'CERRADO' });
    R(M, 'Usuario básico: no cambia el estado de un incidente del que no es responsable', (await prisma.incidente.findUnique({ where: { id: incAjeno.id } })).estado === incAjeno.estado, `status ${r.status}`);
    r = await carmen.get(`/incidentes/${incAjeno.id}/editar`);
    R(M, 'Usuario básico: no abre la edición de un incidente ajeno', r.status === 403 || r.status === 404, `status ${r.status}`);
    const derAjeno = await prisma.solicitudDerecho.findFirst({ where: { OR: [{ responsable_id: null }, { responsable_id: { not: carmenU.id } }] } });
    r = await carmen.post(`/derechos/${derAjeno.id}/estado`, { estado: 'DENEGADA' });
    R(M, 'Usuario básico: no cambia el estado de una solicitud de la que no es responsable', (await prisma.solicitudDerecho.findUnique({ where: { id: derAjeno.id } })).estado === derAjeno.estado, `status ${r.status}`);
    const biaAjeno = await prisma.procesoNegocio.findFirst({ where: { OR: [{ responsable_id: null }, { responsable_id: { not: carmenU.id } }] } });
    r = await carmen.get(`/bia/${biaAjeno.id}/editar`);
    R(M, 'Usuario básico: no abre la edición de un proceso BIA ajeno', r.status === 403 || r.status === 404, `status ${r.status}`);
    r = await carmen.post(`/bia/${biaAjeno.id}/pruebas`, { fecha_prueba: hoyInput(-1 * 24), tipo_prueba: 'PRUEBA_PARCIAL', resultado: 'SATISFACTORIO' });
    R(M, 'Usuario básico: no registra pruebas en un proceso BIA ajeno', r.status === 403 || r.status === 404, `status ${r.status}`);
    const ecAjeno = await prisma.evaluacionControl.findFirst({ where: { OR: [{ responsable_id: null }, { responsable_id: { not: carmenU.id } }] } });
    r = await carmen.post(`/evaluaciones/${ecAjeno.evaluacion_id}/controles/${ecAjeno.control_id}/estado`, { estado: ecAjeno.estado === 'IMPLEMENTADO' ? 'PENDIENTE' : 'IMPLEMENTADO' });
    R(M, 'Usuario básico: no cambia el estado de un control ENS del que no es responsable', (await prisma.evaluacionControl.findUnique({ where: { id: ecAjeno.id } })).estado === ecAjeno.estado, `status ${r.status}`);
    const docProv = await prisma.documentoProveedor.findFirst();
    if (docProv) {
      r = await carmen.post(`/proveedores/${docProv.proveedor_id}/documentos/${docProv.id}/eliminar`);
      R(M, 'Usuario básico: no elimina documentos de proveedores de otros', !!(await prisma.documentoProveedor.findUnique({ where: { id: docProv.id } })), `status ${r.status}`);
    }
  }

  // ====================== c) ORGANIZACIÓN ======================
  R('Organización', 'Aislamiento entre organizaciones cambiando el id en la URL', 'NP', 'No aplica: la aplicación es de una sola organización (tabla organizacion con una fila, sin organizacion_id en los datos). El aislamiento por usuario (RAT y riesgos) se prueba en «Roles».');

  // ====================== d) SISTEMAS ======================
  let sisPrueba;
  {
    const M = 'Sistemas';
    let r = await admin.post('/sistemas', { nombre: 'ZZ Sistema de prueba', tipo_sistema: 'Pruebas', descripcion: 'Creado por la batería de pruebas', categoria_general: 'MEDIA', crear_evaluacion: 'on', nombre_evaluacion: 'Evaluación de prueba' });
    sisPrueba = (await prisma.sistema.findFirst({ where: { nombre: 'ZZ Sistema de prueba' } }))?.id;
    R(M, 'Crear sistema (con primera evaluación)', r.status === 302 && !!sisPrueba, `status ${r.status} → ${r.loc}`);
    const evs = await prisma.evaluacion.findMany({ where: { sistema_id: sisPrueba } });
    R(M, 'Al crear con «crear evaluación», se crea la evaluación', evs.length === 1, `${evs.length} evaluaciones`);
    r = await admin.get(`/sistemas/${sisPrueba}`);
    const pestanas = ['Resumen', 'Actividades RAT', 'Riesgos', 'Incidentes', 'Derechos', 'Checklist ENS', 'Continuidad'];
    const faltan = pestanas.filter((p) => !r.html.includes(p));
    R(M, 'Ficha con todas sus pestañas', r.status === 200 && !faltan.length, faltan.length ? 'faltan: ' + faltan.join(', ') : pestanas.join(', '));
    r = await admin.post(`/sistemas/${sisPrueba}`, { nombre: 'ZZ Sistema de prueba editado', tipo_sistema: 'Pruebas', descripcion: 'Editado', categoria_general: 'ALTA' });
    const ed = await prisma.sistema.findUnique({ where: { id: sisPrueba } });
    R(M, 'Editar sistema', r.status === 302 && ed.nombre === 'ZZ Sistema de prueba editado' && ed.categoria_general === 'ALTA', `status ${r.status}`);
    r = await admin.get(`/sistemas/${sisPrueba}/historial`);
    R(M, 'Ver histórico del sistema', r.status === 200, `status ${r.status}`);
    r = await admin.get(`/sistemas/${sis.id}/historial?evaluacion=abc&control=xyz&pagina=-5`);
    R(M, 'Histórico con parámetros inválidos no falla', r.status === 200, `status ${r.status}`);
    r = await admin.post('/sistemas', { nombre: '', categoria_general: 'MEDIA' });
    R(M, 'Crear sin nombre → error de validación', r.status === 400 && /obligatorio/.test(erroresDe(r.html)), `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/sistemas', { nombre: 'ZZ x', categoria_general: 'INVENTADA' });
    R(M, 'Categoría ENS inválida → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/sistemas', { nombre: LARGO, categoria_general: 'MEDIA' });
    const largoId = idDe(r.loc, '/sistemas');
    R(M, 'Nombre de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se acepta y se guarda (sin límite de longitud)' : `status ${r.status} ${erroresDe(r.html).slice(0, 100)}`);
    if (largoId) await prisma.sistema.delete({ where: { id: largoId } });
    r = await admin.get('/sistemas/999999');
    R(M, 'Sistema inexistente → 404', r.status === 404, `status ${r.status}`);
    r = await admin.get('/sistemas/abc');
    R(M, 'Id no numérico → 404', r.status === 404, `status ${r.status}`);
    r = await admin.get('/sistemas/99999999999');
    R(M, 'Id fuera de rango (99999999999) → 404', r.status === 404, `status ${r.status}`);
    r = await admin.post(`/sistemas/${sisPrueba}/evaluaciones`, { nombre: 'Segunda evaluación', copiar: 'on' });
    R(M, 'Crear otra evaluación copiando la anterior', r.status === 302 && (await prisma.evaluacion.count({ where: { sistema_id: sisPrueba } })) === 2, `status ${r.status} → ${r.loc}`);
    r = await admin.post(`/sistemas/${sisPrueba}/evaluaciones`, { nombre: '' });
    R(M, 'Crear evaluación sin nombre', r.status === 400 || (r.status === 302), `status ${r.status} (${r.status === 302 ? 'usa nombre sugerido' : erroresDe(r.html)})`);
    // El borrado se prueba al final (necesitamos el sistema para ENS)
  }

  // ====================== e) RGPD ======================
  // ---- RAT ----
  let ratId;
  {
    const M = 'RGPD · RAT';
    const valido = { nombre: 'ZZ Actividad de prueba', finalidad: 'Pruebas', base_legal: 'CONTRATO', categorias_datos: 'Identificativos', categorias_interesados: 'Empleados', destinatarios: 'Nadie', plazo_conservacion: '1 año', medidas_seguridad: 'Cifrado', sistema_id: String(sisPrueba), usuario_id: String(yo.id) };
    let r = await admin.get('/rat');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/rat', valido);
    ratId = idDe(r.loc, '/rat');
    R(M, 'Crear', r.status === 302 && ratId, `status ${r.status} → ${r.loc} ${erroresDe(r.html)}`);
    r = await admin.get(`/rat/${ratId}`);
    R(M, 'Ver ficha', r.status === 200 && r.html.includes('ZZ Actividad de prueba'), `status ${r.status}`);
    r = await admin.post(`/rat/${ratId}`, { ...valido, nombre: 'ZZ Actividad editada', transferencia_intl: 'on', pais_transferencia: 'EE. UU.' });
    R(M, 'Editar', r.status === 302 && (await prisma.actividadRat.findUnique({ where: { id: ratId } })).nombre === 'ZZ Actividad editada', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get(`/rat?sistema=${sisPrueba}`);
    const r2 = await admin.get('/rat?sistema=ninguno');
    R(M, 'Filtro por sistema y «sin sistema»', r.html.includes('ZZ Actividad editada') && !r2.html.includes('ZZ Actividad editada'), '');
    r = await admin.get('/rat?sistema=abc');
    R(M, 'Filtro con valor inválido no falla', r.status === 200, `status ${r.status}`);
    r = await admin.post('/rat', {});
    const errs = erroresDe(r.html);
    R(M, 'Formulario vacío → errores de obligatorio', r.status === 400 && errs.includes('obligatori'), `status ${r.status}: ${errs.slice(0, 150)}`);
    r = await admin.post('/rat', { ...valido, base_legal: 'INVENTADA' });
    R(M, 'Base legal inválida → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/rat', { ...valido, sistema_id: '999999' });
    R(M, 'Sistema inexistente → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/rat', { ...valido, usuario_id: '99999999999' });
    R(M, 'Responsable con id fuera de rango → error (no 500)', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/rat', { ...valido, transferencia_intl: 'on', pais_transferencia: '' });
    R(M, 'Transferencia internacional sin país → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado sin país' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.actividadRat.delete({ where: { id: idDe(r.loc, '/rat') } });
    r = await admin.post('/rat', { ...valido, nombre: LARGO, finalidad: LARGO });
    const largo = idDe(r.loc, '/rat');
    R(M, 'Textos de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se aceptan sin límite de longitud' : `status ${r.status}`);
    if (largo) await prisma.actividadRat.delete({ where: { id: largo } });
    r = await admin.get('/rat/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
  }
  // ---- Riesgos ----
  let riesgoId;
  {
    const M = 'RGPD · Riesgos';
    let r = await admin.get('/riesgos');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/riesgos', { actividad_id: String(ratId), amenaza: 'ZZ Amenaza de prueba', probabilidad: 'ALTA', impacto: 'MEDIO', medidas_mitigadoras: 'x', sistema_id: String(sisPrueba) });
    riesgoId = idDe(r.loc, '/riesgos');
    R(M, 'Crear', r.status === 302 && riesgoId, `status ${r.status} ${erroresDe(r.html)}`);
    let rg = await prisma.riesgo.findUnique({ where: { id: riesgoId } });
    R(M, 'Nivel calculado al crear (Alta × Medio = 6 → Alto)', rg.nivel_riesgo === 'ALTO', rg.nivel_riesgo);
    r = await admin.get(`/riesgos/${riesgoId}`);
    R(M, 'Ver ficha', r.status === 200 && r.html.includes('ZZ Amenaza de prueba'), `status ${r.status}`);
    r = await admin.post(`/riesgos/${riesgoId}`, { actividad_id: String(ratId), amenaza: 'ZZ Amenaza editada', probabilidad: 'BAJA', impacto: 'ALTO', sistema_id: String(sisPrueba) });
    rg = await prisma.riesgo.findUnique({ where: { id: riesgoId } });
    R(M, 'Editar y recalcular nivel (Baja × Alto = 3 → Medio)', r.status === 302 && rg.nivel_riesgo === 'MEDIO', `status ${r.status} nivel ${rg.nivel_riesgo}`);
    const filtros = ['?nivel=ALTO', '?nivel=MEDIO', '?nivel=BAJO', `?sistema=${sisPrueba}`, '?sistema=ninguno', `?actividad=${ratId}`, '?nivel=XX', '?actividad=abc'];
    const malos = [];
    for (const f of filtros) { const x = await admin.get('/riesgos' + f); if (x.status !== 200) malos.push(f + '→' + x.status); }
    r = await admin.get('/riesgos?nivel=MEDIO'); const r2 = await admin.get('/riesgos?nivel=ALTO');
    R(M, `Filtros (${filtros.length}) responden y filtran por nivel`, !malos.length && r.html.includes('ZZ Amenaza editada') && !r2.html.includes('ZZ Amenaza editada'), malos.join(', '));
    r = await admin.post('/riesgos', {});
    R(M, 'Formulario vacío → errores', r.status === 400, `status ${r.status}: ${erroresDe(r.html).slice(0, 150)}`);
    r = await admin.post('/riesgos', { actividad_id: String(ratId), amenaza: 'x', probabilidad: 'ENORME', impacto: 'MEDIO' });
    R(M, 'Probabilidad inválida → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/riesgos', { actividad_id: '99999999999', amenaza: 'x', probabilidad: 'ALTA', impacto: 'MEDIO' });
    R(M, 'Actividad con id fuera de rango → error (no 500)', r.status === 400, `status ${r.status}`);
    r = await admin.get('/riesgos/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
  }
  // ---- Incidentes ----
  let incId, incVencido;
  {
    const M = 'RGPD · Incidentes';
    const valido = { titulo: 'ZZ Incidente de prueba', descripcion: 'Prueba', tipo: 'CONFIDENCIALIDAD', gravedad: 'ALTA', fecha_deteccion: hoyInput(-10), sistema_id: String(sisPrueba), requiere_notificacion_aepd: 'on', responsable_id: String(yo.id), categorias_datos_afectados: 'Identificativos', numero_afectados_estimado: '10' };
    let r = await admin.get('/incidentes');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/incidentes', valido);
    incId = idDe(r.loc, '/incidentes');
    R(M, 'Crear', r.status === 302 && incId, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get(`/incidentes/${incId}`);
    R(M, 'Ver ficha', r.status === 200 && r.html.includes('ZZ Incidente de prueba'), `status ${r.status}`);
    R(M, 'Plazo AEPD: detectado hace 10 h → quedan 62 h', /62\s*h/.test(r.html), (r.html.match(/[^>]{0,40}\d+\s*h(oras)?[^<]{0,30}/g) || []).slice(0, 3).join(' / '));
    r = await admin.post(`/incidentes/${incId}`, { ...valido, titulo: 'ZZ Incidente editado', gravedad: 'CRITICA', estado: 'ABIERTO' });
    R(M, 'Editar', r.status === 302 && (await prisma.incidente.findUnique({ where: { id: incId } })).titulo === 'ZZ Incidente editado', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post(`/incidentes/${incId}/estado`, { estado: 'EN_INVESTIGACION' });
    R(M, 'Cambiar estado', r.status === 302 && (await prisma.incidente.findUnique({ where: { id: incId } })).estado === 'EN_INVESTIGACION', `status ${r.status}`);
    r = await admin.get(`/incidentes/${incId}/historial`);
    R(M, 'Ver historial con el cambio de estado', r.status === 200 && /investigaci/i.test(r.html), `status ${r.status}`);
    r = await admin.post(`/incidentes/${incId}/estado`, { estado: 'INVENTADO' });
    R(M, 'Estado inválido → rechazado', (await prisma.incidente.findUnique({ where: { id: incId } })).estado === 'EN_INVESTIGACION' && r.status !== 500, `status ${r.status}`);
    r = await admin.post('/incidentes', { ...valido, titulo: 'ZZ Incidente vencido', fecha_deteccion: hoyInput(-80) });
    incVencido = idDe(r.loc, '/incidentes');
    const filtros = ['?estado=ABIERTO', '?gravedad=CRITICA', '?alerta=activos', '?alerta=aepd_vencido', '?alerta=aepd_pendiente', `?sistema=${sisPrueba}`, '?sistema=ninguno', '?pagina=2', '?pagina=-1', '?estado=XX'];
    const malos = [];
    for (const f of filtros) { const x = await admin.get('/incidentes' + f); if (x.status !== 200) malos.push(f + '→' + x.status); }
    R(M, `Filtros (${filtros.length}) responden`, !malos.length, malos.join(', '));
    r = await admin.get('/incidentes?alerta=aepd_vencido');
    const r2 = await admin.get('/incidentes?gravedad=CRITICA');
    R(M, 'Filtro «AEPD vencidos» incluye el detectado hace 80 h y no el de hace 10 h', r.html.includes('ZZ Incidente vencido') && !r.html.includes('ZZ Incidente editado'), '');
    R(M, 'Filtro por gravedad', r2.html.includes('ZZ Incidente editado') && !r2.html.includes('ZZ Incidente vencido'), '');
    r = await admin.post('/incidentes', {});
    R(M, 'Formulario vacío → errores', r.status === 400, `status ${r.status}: ${erroresDe(r.html).slice(0, 150)}`);
    r = await admin.post('/incidentes', { ...valido, fecha_deteccion: '2026-02-30T10:00' });
    R(M, 'Fecha imposible (30 de febrero) → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptada' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.incidente.delete({ where: { id: idDe(r.loc, '/incidentes') } });
    r = await admin.post('/incidentes', { ...valido, fecha_deteccion: hoyInput(48) });
    R(M, 'Fecha de detección futura → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/incidentes', { ...valido, fecha_ocurrencia: hoyInput(-5), fecha_deteccion: hoyInput(-10) });
    R(M, 'Ocurrencia posterior a la detección → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/incidentes', { ...valido, numero_afectados_estimado: '-5' });
    R(M, 'Número de afectados negativo → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.incidente.delete({ where: { id: idDe(r.loc, '/incidentes') } });
    r = await admin.post('/incidentes', { ...valido, numero_afectados_estimado: '99999999999' });
    R(M, 'Número de afectados enorme (99999999999) → error (no 500)', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.incidente.delete({ where: { id: idDe(r.loc, '/incidentes') } });
    r = await admin.post('/incidentes', { ...valido, titulo: LARGO, descripcion: LARGO });
    R(M, 'Textos de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se aceptan sin límite de longitud' : `status ${r.status}`);
    if (r.status === 302) await prisma.incidente.delete({ where: { id: idDe(r.loc, '/incidentes') } });
    r = await admin.get('/incidentes/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
  }
  // ---- Derechos ----
  let derId;
  {
    const M = 'RGPD · Derechos';
    const recepcion = hoyInput(-24 * 5);
    const valido = { nombre_solicitante: 'ZZ Solicitante de prueba', email_solicitante: 'zz@example.test', tipo_derecho: 'ACCESO', canal_entrada: 'EMAIL', fecha_recepcion: recepcion, descripcion: 'Prueba', sistema_id: String(sisPrueba), responsable_id: String(yo.id) };
    let r = await admin.get('/derechos');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/derechos', valido);
    derId = idDe(r.loc, '/derechos');
    R(M, 'Crear', r.status === 302 && derId, `status ${r.status} ${erroresDe(r.html)}`);
    const sol = await prisma.solicitudDerecho.findUnique({ where: { id: derId } });
    // Fecha límite esperada: mismo día del mes siguiente, 23:59:59 hora de Madrid
    const rec = new Date(recepcion);
    const esperada = new Date(rec.getFullYear(), rec.getMonth() + 1, rec.getDate());
    const lim = new Date(sol.fecha_limite);
    const limMadrid = lim.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
    R(M, 'Fecha límite = recepción + 1 mes (art. 12.3 RGPD)', limMadrid === esperada.toLocaleDateString('es-ES'), `límite ${limMadrid}, esperada ${esperada.toLocaleDateString('es-ES')}`);
    r = await admin.get(`/derechos/${derId}`);
    const diasEsperados = Math.round((new Date(esperada.getFullYear(), esperada.getMonth(), esperada.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 864e5);
    R(M, `Días restantes mostrados (esperados ${diasEsperados})`, r.html.includes(`${diasEsperados} días`) || r.html.includes(`${diasEsperados} día`), (r.html.match(/[^>]{0,30}\d+ días?[^<]{0,20}/g) || []).slice(0, 3).join(' / '));
    r = await admin.post(`/derechos/${derId}`, { ...valido, nombre_solicitante: 'ZZ Solicitante editado', estado: 'RECIBIDA' });
    R(M, 'Editar', r.status === 302 && (await prisma.solicitudDerecho.findUnique({ where: { id: derId } })).nombre_solicitante === 'ZZ Solicitante editado', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post(`/derechos/${derId}/estado`, { estado: 'EN_TRAMITACION' });
    R(M, 'Cambiar estado', (await prisma.solicitudDerecho.findUnique({ where: { id: derId } })).estado === 'EN_TRAMITACION', `status ${r.status}`);
    r = await admin.get(`/derechos/${derId}/historial`);
    R(M, 'Ver historial', r.status === 200, `status ${r.status}`);
    r = await admin.post(`/derechos/${derId}/documentos`, fd({ nombre_documento: 'ZZ DNI', tipo_documento: 'IDENTIFICACION' }, pdf()));
    const doc = await prisma.documentoSolicitudDerecho.findFirst({ where: { solicitud_id: derId } });
    R(M, 'Subir documento PDF', r.status === 302 && doc, `status ${r.status}`);
    if (doc) {
      r = await admin.get(`/derechos/${derId}/documentos/${doc.id}`);
      R(M, 'Ver documento (PDF en línea)', r.status === 200 && r.tipo.includes('pdf') && r.buf.slice(0, 5).toString() === '%PDF-', `status ${r.status} ${r.tipo}`);
      r = await admin.post(`/derechos/${derId}/documentos/${doc.id}/eliminar`);
      R(M, 'Eliminar documento', !(await prisma.documentoSolicitudDerecho.findUnique({ where: { id: doc.id } })), `status ${r.status}`);
    }
    r = await admin.post(`/derechos/${derId}/documentos`, fd({ nombre_documento: 'falso', tipo_documento: 'OTRO' }, noPdf()));
    R(M, 'Subir archivo que no es PDF → rechazado', !(await prisma.documentoSolicitudDerecho.findFirst({ where: { solicitud_id: derId, nombre_documento: 'falso' } })), `status ${r.status}`);
    const filtros = ['?estado=RECIBIDA', '?tipo=ACCESO', '?plazo=vencidas', '?plazo=proximas', `?sistema=${sisPrueba}`, '?sistema=ninguno', '?pagina=3', '?tipo=XX'];
    const malos = [];
    for (const f of filtros) { const x = await admin.get('/derechos' + f); if (x.status !== 200) malos.push(f + '→' + x.status); }
    R(M, `Filtros (${filtros.length}) responden`, !malos.length, malos.join(', '));
    r = await admin.get('/derechos?tipo=ACCESO'); const r2 = await admin.get('/derechos?tipo=SUPRESION');
    R(M, 'Filtro por tipo filtra', r.html.includes('ZZ Solicitante editado') && !r2.html.includes('ZZ Solicitante editado'), '');
    r = await admin.post('/derechos', {});
    R(M, 'Formulario vacío → errores', r.status === 400, `status ${r.status}: ${erroresDe(r.html).slice(0, 150)}`);
    r = await admin.post('/derechos', { ...valido, fecha_recepcion: '2026-13-45T10:00' });
    R(M, 'Fecha imposible → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/derechos', { ...valido, fecha_recepcion: '2026-02-30T10:00' });
    R(M, 'Fecha imposible (30 de febrero) → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptada' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.solicitudDerecho.delete({ where: { id: idDe(r.loc, '/derechos') } });
    r = await admin.post('/derechos', { ...valido, fecha_recepcion: hoyInput(24 * 3) });
    R(M, 'Fecha de recepción futura → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptada' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.solicitudDerecho.delete({ where: { id: idDe(r.loc, '/derechos') } });
    r = await admin.post('/derechos', { ...valido, email_solicitante: 'no-es-un-email' });
    R(M, 'Email inválido → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.solicitudDerecho.delete({ where: { id: idDe(r.loc, '/derechos') } });
    r = await admin.post('/derechos', { ...valido, descripcion: LARGO, nombre_solicitante: LARGO });
    R(M, 'Textos de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se aceptan sin límite de longitud' : `status ${r.status}`);
    if (r.status === 302) await prisma.solicitudDerecho.delete({ where: { id: idDe(r.loc, '/derechos') } });
    r = await admin.get('/derechos/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
  }
  // ---- Proveedores ----
  let provId;
  {
    const M = 'RGPD · Proveedores';
    const valido = { nombre_empresa: 'ZZ Proveedor de prueba', cif: 'B00000000', servicio_prestado: 'Pruebas', categorias_datos_tratados: 'Identificativos', pais_tratamiento: 'España', estado: 'ACTIVO', nivel_cumplimiento_ens: 'MEDIO', mecanismo_transferencia: 'NO_APLICA', tiene_contrato_encargado: 'on', email_contacto: 'zz@example.test', responsable_id: String(yo.id) };
    let r = await admin.get('/proveedores');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/proveedores', valido);
    provId = idDe(r.loc, '/proveedores');
    R(M, 'Crear', r.status === 302 && provId, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get(`/proveedores/${provId}`);
    R(M, 'Ver ficha', r.status === 200 && r.html.includes('ZZ Proveedor de prueba'), `status ${r.status}`);
    r = await admin.post(`/proveedores/${provId}`, { ...valido, nombre_empresa: 'ZZ Proveedor editado' });
    R(M, 'Editar', r.status === 302 && (await prisma.proveedor.findUnique({ where: { id: provId } })).nombre_empresa === 'ZZ Proveedor editado', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post(`/proveedores/${provId}/documentos`, fd({ nombre_documento: 'ZZ Contrato', tipo_documento: 'CONTRATO' }, pdf()));
    const doc = await prisma.documentoProveedor.findFirst({ where: { proveedor_id: provId } });
    R(M, 'Subir documento PDF', r.status === 302 && doc, `status ${r.status}`);
    if (doc) {
      r = await admin.get(`/proveedores/${provId}/documentos/${doc.id}`);
      R(M, 'Ver documento', r.status === 200 && r.tipo.includes('pdf'), `status ${r.status}`);
      r = await admin.get(`/proveedores/${provId + 1}/documentos/${doc.id}`);
      R(M, 'Documento pedido con otro id de proveedor → 404', r.status === 404, `status ${r.status}`);
      r = await admin.post(`/proveedores/${provId}/documentos/${doc.id}/eliminar`);
      R(M, 'Eliminar documento', !(await prisma.documentoProveedor.findUnique({ where: { id: doc.id } })), `status ${r.status}`);
    }
    const big = new File([Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(11 * 1024 * 1024)])], 'grande.pdf', { type: 'application/pdf' });
    r = await admin.post(`/proveedores/${provId}/documentos`, fd({ nombre_documento: 'grande', tipo_documento: 'OTRO' }, big));
    R(M, 'Subir PDF de más de 10 MB → rechazado sin error 500', r.status !== 500 && !(await prisma.documentoProveedor.findFirst({ where: { proveedor_id: provId, nombre_documento: 'grande' } })), `status ${r.status}`);
    const filtros = ['?estado=ACTIVO', '?contrato=no', '?contrato=si', '?alerta=sin_contrato', '?estado=XX'];
    const malos = [];
    for (const f of filtros) { const x = await admin.get('/proveedores' + f); if (x.status !== 200) malos.push(f + '→' + x.status); }
    R(M, `Filtros (${filtros.length}) responden`, !malos.length, malos.join(', '));
    r = await admin.get('/proveedores?estado=BAJA');
    R(M, 'Filtro por estado filtra', !r.html.includes('ZZ Proveedor editado'), '');
    r = await admin.post('/proveedores', {});
    R(M, 'Formulario vacío → errores', r.status === 400, `status ${r.status}: ${erroresDe(r.html).slice(0, 150)}`);
    r = await admin.post('/proveedores', { ...valido, email_contacto: 'malo@' });
    R(M, 'Email inválido → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/proveedores', { ...valido, estado: 'XX', nivel_cumplimiento_ens: 'YY' });
    R(M, 'Estado / nivel ENS inválidos → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/proveedores', { ...valido, fuera_ue: 'on', mecanismo_transferencia: 'NO_APLICA' });
    const sinMec = idDe(r.loc, '/proveedores');
    const avisos = sinMec ? (await admin.get('/proveedores?alerta=sin_garantias')).html : '';
    R(M, 'Fuera de la UE sin mecanismo: se guarda y aparece en el aviso «sin garantías» (intencionado)', !!sinMec && avisos.includes(`/proveedores/${sinMec}"`), `status ${r.status}`);
    if (sinMec) await prisma.proveedor.delete({ where: { id: sinMec } });
    r = await admin.post('/proveedores', { ...valido, nombre_empresa: LARGO });
    R(M, 'Textos de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se aceptan sin límite de longitud' : `status ${r.status}`);
    if (r.status === 302) await prisma.proveedor.delete({ where: { id: idDe(r.loc, '/proveedores') } });
    r = await admin.post(`/proveedores/${provId}/eliminar`);
    R(M, 'Eliminar proveedor', !(await prisma.proveedor.findUnique({ where: { id: provId } })), `status ${r.status}`);
    r = await admin.get('/proveedores/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
  }

  // ====================== f) ENS ======================
  let ctlId;
  {
    const M = 'ENS · Catálogo de controles';
    let r = await admin.get('/controles');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/controles', { nombre: 'zz.1 Control de prueba', categoria: 'BAJA', descripcion: 'Descripción de prueba' });
    ctlId = (await prisma.controlEns.findFirst({ where: { nombre: 'zz.1 Control de prueba' } }))?.id;
    R(M, 'Crear', r.status === 302 && ctlId, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get(`/controles/${ctlId}/editar`);
    R(M, 'Ver (formulario de edición)', r.status === 200, `status ${r.status}`);
    r = await admin.post(`/controles/${ctlId}`, { nombre: 'zz.1 Control editado', categoria: 'MEDIA', descripcion: 'x' });
    R(M, 'Editar', (await prisma.controlEns.findUnique({ where: { id: ctlId } })).nombre === 'zz.1 Control editado', `status ${r.status}`);
    R(M, 'Filtros', 'NP', 'El catálogo no tiene filtros: muestra los controles agrupados por categoría (Baja, Media, Alta).');
    r = await admin.post('/controles', {});
    R(M, 'Formulario vacío → error', r.status === 400, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/controles', { nombre: 'zz.2', categoria: 'XX' });
    R(M, 'Categoría inválida → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/controles', { nombre: 'zz.3', categoria: 'BAJA', descripcion: 'y'.repeat(2001) });
    R(M, 'Descripción de más de 2000 caracteres → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/controles', { nombre: 'zz.1 Control editado', categoria: 'BAJA' });
    R(M, 'Nombre duplicado → error (no 500)', r.status === 400 || r.status === 409, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/controles', { nombre: LARGO, categoria: 'BAJA' });
    R(M, 'Nombre de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se acepta sin límite de longitud' : `status ${r.status}`);
    await prisma.controlEns.deleteMany({ where: { nombre: LARGO } });
  }
  let evId, decId;
  {
    const M = 'ENS · Evaluación (checklist)';
    const ev = await prisma.evaluacion.findFirst({ where: { sistema_id: sisPrueba }, orderBy: { created_at: 'desc' } });
    evId = ev.id;
    let r = await admin.get(`/evaluaciones/${evId}`);
    R(M, 'Ver checklist', r.status === 200, `status ${r.status}`);
    R(M, 'Un control nuevo del catálogo se añade a la evaluación vigente del sistema', r.html.includes('zz.1 Control editado'), '');
    const evAntigua = await prisma.evaluacion.findFirst({ where: { sistema_id: sisPrueba }, orderBy: { created_at: 'asc' } });
    const rAnt = await admin.get(`/evaluaciones/${evAntigua.id}`);
    R(M, 'Las evaluaciones anteriores no cambian al añadir un control al catálogo', evAntigua.id !== evId && !rAnt.html.includes('zz.1 Control editado') && (await prisma.evaluacionControl.count({ where: { evaluacion_id: evAntigua.id } })) === (await prisma.controlEns.count()) - 1, '');
    const ctlBase = await prisma.controlEns.findFirst({ where: { NOT: { nombre: { startsWith: 'zz.' } } } });
    const ec = { control_id: ctlBase.id };
    const fila = () => prisma.evaluacionControl.findFirst({ where: { evaluacion_id: evId, control_id: ctlBase.id } });
    r = await admin.get(`/evaluaciones/${evId}/controles/${ec.control_id}/editar`);
    R(M, 'Abrir edición de un control', r.status === 200, `status ${r.status}`);
    r = await admin.post(`/evaluaciones/${evId}/controles/${ec.control_id}`, { estado: 'IMPLEMENTADO', evidencia: 'Evidencia de prueba', responsable_id: String(yo.id) });
    R(M, 'Editar control (estado, evidencia, responsable)', (await fila()).estado === 'IMPLEMENTADO', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post(`/evaluaciones/${evId}/controles/${ec.control_id}/estado`, { estado: 'NO_APLICA' });
    R(M, 'Cambiar estado rápido', (await fila()).estado === 'NO_APLICA', `status ${r.status}`);
    r = await admin.post(`/evaluaciones/${evId}/controles/${ec.control_id}/estado`, { estado: 'XX' });
    R(M, 'Estado inválido → rechazado', (await fila()).estado === 'NO_APLICA' && r.status !== 500, `status ${r.status}`);
    r = await admin.post(`/evaluaciones/${evId}/controles/${ec.control_id}`, { estado: 'IMPLEMENTADO', evidencia: LARGO });
    R(M, 'Evidencia de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se acepta sin límite de longitud' : `status ${r.status}`);
    r = await carmen.post(`/evaluaciones/${evId}/controles/${ctlId}/asignarme`);
    R(M, 'Asignarme un control sin responsable (usuario básico)', (await prisma.evaluacionControl.findFirst({ where: { evaluacion_id: evId, control_id: ctlId } }))?.responsable_id === carmenU.id, `status ${r.status}`);
    const otro = await prisma.evaluacionControl.findFirst({ where: { evaluacion_id: evId, responsable_id: yo.id } });
    if (otro) { r = await carmen.post(`/evaluaciones/${evId}/controles/${otro.control_id}/asignarme`); R(M, 'Un usuario básico no puede quitarle un control asignado a otra persona', (await prisma.evaluacionControl.findUnique({ where: { id: otro.id } })).responsable_id === yo.id, `status ${r.status}`); }
    r = await admin.get(`/evaluaciones/${evId}/controles/999999/editar`);
    R(M, 'Control inexistente → 404', r.status === 404, `status ${r.status}`);
    r = await admin.get('/evaluaciones/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
    // Porcentaje de la evaluación tras los cambios
    const { imp, apl, pct } = await pctEval(evId);
    r = await admin.get(`/sistemas/${sisPrueba}`);
    R(M, `Porcentaje en la ficha del sistema = ${imp}/${apl} = ${pct} % (No aplicable no cuenta)`, r.html.includes(`${imp}/${apl}`) && new RegExp(`>\\s*${pct}\\s*%`).test(r.html), '');
  }
  {
    const M = 'ENS · Declaraciones';
    let r = await admin.post(`/evaluaciones/${evId}/declaracion`);
    decId = idDe(r.loc, '/declaraciones');
    R(M, 'Generar declaración desde una evaluación', r.status === 302 && decId, `status ${r.status} → ${r.loc}`);
    r = await admin.get('/declaraciones');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.get(`/declaraciones?sistema=${sisPrueba}`); const r2 = await admin.get(`/declaraciones?sistema=${sis.id}`); const r3 = await admin.get('/declaraciones?sistema=abc');
    R(M, 'Filtro por sistema', r.html.includes(`/declaraciones/${decId}`) && !r2.html.includes(`/declaraciones/${decId}"`) && r3.status === 200, '');
    r = await admin.get(`/declaraciones/${decId}`);
    R(M, 'Ver declaración', r.status === 200, `status ${r.status}`);
    r = await admin.get(`/declaraciones/${decId}/pdf?ver=1`);
    R(M, 'Ver PDF (en línea)', r.status === 200 && r.tipo.includes('pdf') && r.buf.slice(0, 5).toString() === '%PDF-' && /inline/.test(r.headers.get('content-disposition') || ''), `status ${r.status} ${r.tipo} ${r.headers.get('content-disposition')}`);
    r = await admin.get(`/declaraciones/${decId}/pdf`);
    R(M, 'Descargar PDF (ruta sin ?ver)', r.status === 200 && r.tipo.includes('pdf') && /attachment/.test(r.headers.get('content-disposition') || ''), `status ${r.status} ${r.headers.get('content-disposition')} (el botón de descarga se quitó de la vista; la ruta sigue)`);
    r = await carmen.get(`/declaraciones/${decId}/pdf?ver=1`);
    R(M, 'Usuario básico puede ver el PDF', r.status === 200 && r.tipo.includes('pdf'), `status ${r.status}`);
    r = await admin.post(`/declaraciones/${decId}`, { observaciones: 'Observaciones de prueba' });
    R(M, 'Guardar observaciones', (await prisma.declaracionConformidad.findUnique({ where: { id: decId } })).observaciones === 'Observaciones de prueba', `status ${r.status}`);
    r = await admin.post(`/declaraciones/${decId}`, { observaciones: LARGO });
    R(M, 'Observaciones de 20.000 caracteres → rechazadas (no se guardan)', (await prisma.declaracionConformidad.findUnique({ where: { id: decId } })).observaciones === 'Observaciones de prueba', `status ${r.status}`);
    r = await admin.post(`/declaraciones/${decId}/emitir`);
    R(M, 'Emitir', (await prisma.declaracionConformidad.findUnique({ where: { id: decId } })).estado === 'EMITIDA', `status ${r.status}`);
    r = await admin.post(`/declaraciones/${decId}/eliminar`);
    R(M, 'No se puede eliminar una declaración emitida', !!(await prisma.declaracionConformidad.findUnique({ where: { id: decId } })), `status ${r.status}`);
    r = await admin.post(`/declaraciones/${decId}/emitir`);
    R(M, 'Emitir dos veces no falla', r.status !== 500, `status ${r.status}`);
    r = await admin.get('/declaraciones/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
    // Sistema sin categoría → no deja generar
    const sinCat = await prisma.sistema.create({ data: { nombre: 'ZZ Sin categoría', categoria_general: null } });
    const evSin = await prisma.evaluacion.create({ data: { sistema_id: sinCat.id, nombre: 'x' } });
    r = await admin.post(`/evaluaciones/${evSin.id}/declaracion`);
    R(M, 'Sistema sin categoría ENS: no genera declaración', !(await prisma.declaracionConformidad.findFirst({ where: { sistema_id: sinCat.id } })) && r.status !== 500, `status ${r.status}`);
    await prisma.evaluacion.delete({ where: { id: evSin.id } }); await prisma.sistema.delete({ where: { id: sinCat.id } });
  }
  let polId;
  {
    const M = 'ENS · Políticas';
    const valido = { titulo: 'ZZ Política de prueba', tipo_documento: 'POLITICA', version: '1.0', descripcion: 'x', fecha_proxima_revision: fechaInput(-3), requiere_aceptacion: 'on', sistema_id: '' };
    let r = await admin.get('/politicas');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/politicas', valido);
    polId = idDe(r.loc, '/politicas');
    R(M, 'Crear (en Borrador)', r.status === 302 && polId, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get(`/politicas/${polId}`);
    R(M, 'Ver ficha', r.status === 200, `status ${r.status}`);
    r = await admin.post(`/politicas/${polId}`, { ...valido, titulo: 'ZZ Política editada' });
    R(M, 'Editar', (await prisma.politica.findUnique({ where: { id: polId } })).titulo === 'ZZ Política editada', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post(`/politicas/${polId}/versiones`, fd({ version: '1.0', aprobar: 'on' }, pdf('politica.pdf')));
    const p1 = await prisma.politica.findUnique({ where: { id: polId }, include: { archivos: true } });
    R(M, 'Subir PDF de la versión y aprobar', p1.archivos.length === 1 && p1.estado === 'APROBADA', `status ${r.status} estado ${p1.estado} archivos ${p1.archivos.length}`);
    if (p1.archivos[0]) {
      r = await admin.get(`/politicas/${polId}/archivos/${p1.archivos[0].id}`);
      R(M, 'Ver el PDF de la versión', r.status === 200 && r.tipo.includes('pdf'), `status ${r.status}`);
    }
    r = await carmen.post(`/politicas/${polId}/aceptar`, { version: '1.0' });
    R(M, 'Aceptar una política general (usuario básico)', !!(await prisma.aceptacionPolitica.findFirst({ where: { politica_id: polId, usuario_id: carmenU.id } })), `status ${r.status}`);
    r = await carmen.post(`/politicas/${polId}/aceptar`, { version: '1.0' });
    R(M, 'Aceptar dos veces no duplica ni falla', (await prisma.aceptacionPolitica.count({ where: { politica_id: polId, usuario_id: carmenU.id } })) === 1 && r.status !== 500, `status ${r.status}`);
    r = await admin.post(`/politicas/${polId}/adjuntos`, fd({ nombre_documento: 'ZZ Anexo', tipo_documento: 'ANEXO' }, pdf()));
    const adj = await prisma.documentoPolitica.findFirst({ where: { politica_id: polId } });
    R(M, 'Adjuntar documento', !!adj, `status ${r.status}`);
    if (adj) {
      r = await admin.get(`/politicas/${polId}/adjuntos/${adj.id}`);
      R(M, 'Ver adjunto', r.status === 200 && r.tipo.includes('pdf'), `status ${r.status}`);
      r = await admin.post(`/politicas/${polId}/adjuntos/${adj.id}/eliminar`);
      R(M, 'Eliminar adjunto', !(await prisma.documentoPolitica.findUnique({ where: { id: adj.id } })), `status ${r.status}`);
    }
    const filtros = ['?estado=APROBADA', '?tipo=POLITICA', '?filtro=pendientes', '?filtro=revision', '?estado=XX', '?filtro=XX'];
    const malos = [];
    for (const f of filtros) { const x = await admin.get('/politicas' + f); if (x.status !== 200) malos.push(f + '→' + x.status); }
    R(M, `Filtros (${filtros.length}) responden`, !malos.length, malos.join(', '));
    r = await admin.get('/politicas?filtro=revision');
    R(M, 'Revisión vencida hace 3 días aparece en «revisión»', r.html.includes('ZZ Política editada'), '');
    r = await admin.get(`/politicas/${polId}`);
    R(M, 'La ficha muestra «Revisión vencida hace 3 día(s)»', r.html.includes('Revisión vencida hace 3 día'), (r.html.match(/Revisión[^<]{0,40}/g) || []).slice(0, 2).join(' / '));
    r = await admin.post(`/politicas/${polId}/estado`, { estado: 'OBSOLETA' });
    R(M, 'Cambiar estado a Obsoleta', (await prisma.politica.findUnique({ where: { id: polId } })).estado === 'OBSOLETA', `status ${r.status}`);
    r = await admin.post('/politicas', {});
    R(M, 'Formulario vacío → errores', r.status === 400, `status ${r.status}: ${erroresDe(r.html).slice(0, 150)}`);
    r = await admin.post('/politicas', { ...valido, version: 'v 1/0 <x>' });
    R(M, 'Versión con caracteres no válidos → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/politicas', { ...valido, fecha_proxima_revision: '2026-02-30' });
    R(M, 'Fecha imposible (30 de febrero) → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptada' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.politica.delete({ where: { id: idDe(r.loc, '/politicas') } });
    r = await admin.post('/politicas', { ...valido, tipo_documento: 'XX' });
    R(M, 'Tipo inválido → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/politicas', { ...valido, sistema_id: '999999' });
    R(M, 'Sistema inexistente → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/politicas', { ...valido, titulo: LARGO, descripcion: LARGO });
    R(M, 'Textos de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se aceptan sin límite de longitud' : `status ${r.status}`);
    if (r.status === 302) await prisma.politica.delete({ where: { id: idDe(r.loc, '/politicas') } });
    r = await admin.post(`/politicas/${polId}/versiones`, fd({ version: '2.0' }, noPdf()));
    R(M, 'Subir versión que no es PDF → rechazada', (await prisma.archivoPolitica.count({ where: { politica_id: polId } })) === 1, `status ${r.status}`);
    r = await admin.get('/politicas/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
    r = await admin.post(`/politicas/${polId}/eliminar`);
    R(M, 'Eliminar política', !(await prisma.politica.findUnique({ where: { id: polId } })), `status ${r.status}`);
  }
  let biaId;
  {
    const M = 'ENS · BIA y Continuidad';
    const valido = { nombre: 'ZZ Proceso de prueba', departamento_responsable: 'Pruebas', criticidad: 'ALTA', descripcion: 'x', rto_horas: '4', rpo_horas: '2', estado_revision: 'ANALIZADO', sistema_id: String(sisPrueba), responsable_id: String(yo.id), fecha_ultimo_analisis: fechaInput(-10), impacto_economico: 'Alto' };
    let r = await admin.get('/bia');
    R(M, 'Listar', r.status === 200, `status ${r.status}`);
    r = await admin.post('/bia', valido);
    biaId = idDe(r.loc, '/bia');
    R(M, 'Crear', r.status === 302 && biaId, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get(`/bia/${biaId}`);
    R(M, 'Ver ficha', r.status === 200, `status ${r.status}`);
    R(M, 'Proceso alto sin pruebas muestra «Sin prueba en 12 meses»', r.html.includes('Sin prueba en 12 meses'), '');
    r = await admin.post(`/bia/${biaId}`, { ...valido, nombre: 'ZZ Proceso editado' });
    R(M, 'Editar', (await prisma.procesoNegocio.findUnique({ where: { id: biaId } })).nombre === 'ZZ Proceso editado', `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get('/bia?filtro=sin_prueba');
    R(M, 'Aparece en el filtro «sin prueba»', r.html.includes('ZZ Proceso editado'), '');
    r = await admin.post(`/bia/${biaId}/pruebas`, { fecha_prueba: hoyInput(-400 * 24), tipo_prueba: 'PRUEBA_PARCIAL', resultado: 'SATISFACTORIO', observaciones: 'antigua' });
    r = await admin.get('/bia?filtro=sin_prueba');
    R(M, 'Con una prueba de hace 400 días sigue «sin prueba en 12 meses»', r.html.includes('ZZ Proceso editado'), '');
    r = await admin.post(`/bia/${biaId}/pruebas`, { fecha_prueba: hoyInput(-30 * 24), tipo_prueba: 'PRUEBA_COMPLETA', resultado: 'SATISFACTORIO', observaciones: 'reciente' });
    R(M, 'Registrar prueba de continuidad', (await prisma.pruebaContinuidad.count({ where: { proceso_id: biaId } })) === 2, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.get('/bia?filtro=sin_prueba');
    R(M, 'Con una prueba de hace 30 días sale del filtro «sin prueba»', !r.html.includes('ZZ Proceso editado'), '');
    r = await admin.post(`/bia/${biaId}/pruebas`, { fecha_prueba: hoyInput(30 * 24), tipo_prueba: 'PRUEBA_COMPLETA', resultado: 'SATISFACTORIO' });
    R(M, 'Prueba con fecha futura → rechazada', (await prisma.pruebaContinuidad.count({ where: { proceso_id: biaId } })) === 2, `status ${r.status}`);
    r = await admin.post(`/bia/${biaId}/pruebas`, { fecha_prueba: '2026-02-30T10:00', tipo_prueba: 'PRUEBA_COMPLETA', resultado: 'SATISFACTORIO' });
    R(M, 'Prueba con fecha imposible (30 de febrero) → rechazada', (await prisma.pruebaContinuidad.count({ where: { proceso_id: biaId } })) === 2, `status ${r.status}`);
    const filtros = ['?criticidad=ALTA', '?estado=ANALIZADO', '?filtro=sin_prueba', '?filtro=sin_plan', `?sistema=${sisPrueba}`, '?sistema=ninguno', '?criticidad=XX'];
    const malos = [];
    for (const f of filtros) { const x = await admin.get('/bia' + f); if (x.status !== 200) malos.push(f + '→' + x.status); }
    R(M, `Filtros (${filtros.length}) responden`, !malos.length, malos.join(', '));
    r = await admin.get('/bia?criticidad=BAJA');
    R(M, 'Filtro por criticidad filtra', !r.html.includes('ZZ Proceso editado'), '');
    r = await admin.post('/bia', {});
    R(M, 'Formulario vacío → errores', r.status === 400, `status ${r.status}: ${erroresDe(r.html).slice(0, 150)}`);
    r = await admin.post('/bia', { ...valido, rto_horas: '-3', rpo_horas: 'abc' });
    R(M, 'RTO negativo / RPO no numérico → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.procesoNegocio.delete({ where: { id: idDe(r.loc, '/bia') } });
    r = await admin.post('/bia', { ...valido, rto_horas: '99999999999' });
    R(M, 'RTO enorme (99999999999) → error (no 500)', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.procesoNegocio.delete({ where: { id: idDe(r.loc, '/bia') } });
    r = await admin.post('/bia', { ...valido, fecha_ultimo_analisis: '2026-02-30' });
    R(M, 'Fecha imposible → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptada' : erroresDe(r.html)}`);
    if (r.status === 302) await prisma.procesoNegocio.delete({ where: { id: idDe(r.loc, '/bia') } });
    r = await admin.post('/bia', { ...valido, sistema_id: '99999999999' });
    R(M, 'Sistema con id fuera de rango → error (no 500)', r.status === 400, `status ${r.status}`);
    r = await admin.post('/bia', { ...valido, criticidad: 'XX' });
    R(M, 'Criticidad inválida → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/bia', { ...valido, nombre: LARGO });
    R(M, 'Textos de 20.000 caracteres', r.status === 400, r.status === 302 ? 'se aceptan sin límite de longitud' : `status ${r.status}`);
    if (r.status === 302) await prisma.procesoNegocio.delete({ where: { id: idDe(r.loc, '/bia') } });
    r = await admin.get('/bia/99999999999');
    R(M, 'Id fuera de rango → 404', r.status === 404, `status ${r.status}`);
    r = await admin.post(`/bia/${biaId}/eliminar`);
    R(M, 'Eliminar proceso', !(await prisma.procesoNegocio.findUnique({ where: { id: biaId } })), `status ${r.status}`);
  }
  {
    const M = 'Empresa';
    const org = await prisma.organizacion.findFirst();
    let r = await admin.get('/empresa');
    R(M, 'Ver datos de la empresa', r.status === 200 && r.html.includes(org.nombre), `status ${r.status}`);
    const campos = Object.fromEntries(Object.entries(org).filter(([k, v]) => !['id', 'created_at', 'updated_at'].includes(k)).map(([k, v]) => [k, v === null ? '' : String(v)]));
    r = await admin.post('/empresa', campos);
    R(M, 'Guardar sin cambios', r.status === 302, `status ${r.status} ${erroresDe(r.html)}`);
    r = await admin.post('/empresa', { ...campos, email: 'no-es-email' });
    R(M, 'Email inválido → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/empresa', { ...campos, nombre: '' });
    R(M, 'Nombre vacío → error', r.status === 400, `status ${r.status} ${r.status === 302 ? 'aceptado' : erroresDe(r.html)}`);
    r = await admin.post('/empresa', { ...campos, nombre: 'n'.repeat(151) });
    R(M, 'Nombre de más de 150 caracteres → error', r.status === 400, `status ${r.status}`);
    r = await admin.post('/empresa', { ...campos, categoria_ens: 'XX' });
    R(M, 'Categoría ENS inválida → error', r.status === 400, `status ${r.status}`);
    await prisma.organizacion.update({ where: { id: org.id }, data: { nombre: org.nombre } });
  }

  // ====================== g) CÁLCULOS ======================
  {
    const M = 'Cálculos';
    // ENS: % de la última evaluación de cada sistema frente a la lista de sistemas
    const sistemas = await prisma.sistema.findMany({ include: { evaluaciones: { orderBy: { created_at: 'desc' }, take: 1, include: { controles: true } } } });
    const lista = (await admin.get('/sistemas')).html;
    const malos = [];
    for (const s of sistemas) {
      const ev = s.evaluaciones[0]; if (!ev) continue;
      const { imp, apl, pct } = await pctEval(ev.id);
      const fila = lista.split(`/sistemas/${s.id}"`)[1]?.split('</tr>')[0] || '';
      if (!fila.includes(`${imp}/${apl}`) || !new RegExp(`>\\s*${pct}%`).test(fila)) malos.push(`${s.nombre}: esperado ${pct}% ${imp}/${apl}`);
    }
    R(M, `% cumplimiento ENS por sistema (${sistemas.length} sistemas) coincide con la BD sin contar «No aplicable»`, !malos.length, malos.join('; ') || 'coincide');
    // Riesgos: nivel guardado frente a la matriz
    const V = { BAJA: 1, MEDIA: 2, ALTA: 3, BAJO: 1, MEDIO: 2, ALTO: 3 };
    const niv = (p, i) => { const s = V[p] * V[i]; return s >= 6 ? 'ALTO' : s >= 3 ? 'MEDIO' : 'BAJO'; };
    const riesgos = await prisma.riesgo.findMany();
    const mal = riesgos.filter((x) => x.nivel_riesgo !== niv(x.probabilidad, x.impacto));
    R(M, `Nivel de riesgo = probabilidad × impacto en los ${riesgos.length} riesgos de la BD`, !mal.length, mal.map((x) => `#${x.id}`).join(', ') || 'todos correctos');
    const combinaciones = [['BAJA', 'BAJO', 'BAJO'], ['BAJA', 'MEDIO', 'BAJO'], ['BAJA', 'ALTO', 'MEDIO'], ['MEDIA', 'BAJO', 'BAJO'], ['MEDIA', 'MEDIO', 'MEDIO'], ['MEDIA', 'ALTO', 'ALTO'], ['ALTA', 'BAJO', 'MEDIO'], ['ALTA', 'MEDIO', 'ALTO'], ['ALTA', 'ALTO', 'ALTO']];
    const malas = [];
    for (const [p, i, esperado] of combinaciones) {
      await admin.post(`/riesgos/${riesgoId}`, { actividad_id: String(ratId), amenaza: 'ZZ Amenaza editada', probabilidad: p, impacto: i, sistema_id: String(sisPrueba) });
      const n = (await prisma.riesgo.findUnique({ where: { id: riesgoId } })).nivel_riesgo;
      if (n !== esperado) malas.push(`${p}×${i}=${n} (esperado ${esperado})`);
    }
    R(M, 'Las 9 combinaciones de la matriz 3×3 guardadas desde el formulario', !malas.length, malas.join(', ') || 'las 9 correctas');
    // AEPD 72 h
    const incs = await prisma.incidente.findMany({ where: { requiere_notificacion_aepd: true, fecha_notificacion_aepd: null } });
    const vencidosBD = incs.filter((i) => Date.now() - new Date(i.fecha_deteccion) > 72 * 3600e3);
    const pag = (await admin.get('/incidentes?alerta=aepd_vencido')).html;
    const faltan = vencidosBD.filter((i) => !pag.includes(`/incidentes/${i.id}"`));
    const sobran = incs.filter((i) => !vencidosBD.includes(i) && pag.includes(`/incidentes/${i.id}"`));
    R(M, `72 h AEPD: los ${vencidosBD.length} incidentes vencidos según la BD son los que lista el filtro`, !faltan.length && !sobran.length, `faltan ${faltan.map((i) => i.id)} sobran ${sobran.map((i) => i.id)}`);
    const iv = await prisma.incidente.findUnique({ where: { id: incVencido } });
    const r = await admin.get(`/incidentes/${incVencido}`);
    const retraso = Math.floor((Date.now() - new Date(iv.fecha_deteccion) - 72 * 3600e3) / 3600e3);
    R(M, `72 h AEPD: detectado hace 80 h → fuera de plazo por ${retraso} h`, new RegExp(`${retraso}\\s*h`).test(r.html), (r.html.match(/[^>]{0,40}\d+\s*h[^<]{0,30}/g) || []).slice(0, 3).join(' / '));
    // Derechos: días restantes en la lista para todas las solicitudes abiertas
    const abiertas = await prisma.solicitudDerecho.findMany({ where: { estado: { notIn: ['ESTIMADA', 'DENEGADA'] } } });
    const listaDer = (await admin.get('/derechos')).html;
    const hoy = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }));
    const malDer = [];
    for (const s of abiertas) {
      const limite = new Date(new Date(s.fecha_limite).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }));
      const dias = Math.round((limite - hoy) / 864e5);
      const fila = listaDer.split(`/derechos/${s.id}"`)[1]?.split('</tr>')[0] || '';
      const texto = dias < 0 ? `${Math.max(1, -dias)}` : `${dias}`;
      if (!fila.includes(texto)) malDer.push(`#${s.id} esperado ${dias} días`);
    }
    R(M, `Días restantes de las ${abiertas.length} solicitudes abiertas`, !malDer.length, malDer.join('; ') || 'coinciden');
    // Políticas vencidas
    const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
    const vencidas = (await prisma.politica.findMany({ where: { estado: { not: 'OBSOLETA' }, fecha_proxima_revision: { not: null } } }))
      .filter((p) => new Date(p.fecha_proxima_revision).toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' }) < hoyStr);
    const pagPol = (await admin.get('/politicas?filtro=revision')).html;
    const faltanPol = vencidas.filter((p) => !pagPol.includes(`/politicas/${p.id}"`));
    R(M, `Revisiones de políticas vencidas (${vencidas.length} en la BD) aparecen en el filtro`, !faltanPol.length, faltanPol.map((p) => p.titulo).join(', ') || 'todas');
    // BIA sin prueba en 12 meses
    const hace12 = new Date(); hace12.setMonth(hace12.getMonth() - 12);
    const procesos = await prisma.procesoNegocio.findMany({ where: { criticidad: { in: ['ALTA', 'CRITICA'] } }, include: { pruebas: true } });
    const sinPrueba = procesos.filter((p) => !p.pruebas.some((x) => new Date(x.fecha_prueba) >= hace12));
    const pagBia = (await admin.get('/bia?filtro=sin_prueba')).html;
    const faltanBia = sinPrueba.filter((p) => !pagBia.includes(`/bia/${p.id}"`));
    const sobranBia = procesos.filter((p) => !sinPrueba.includes(p) && pagBia.includes(`/bia/${p.id}"`));
    R(M, `«Sin prueba en 12 meses» (${sinPrueba.length} procesos altos/críticos según la BD)`, !faltanBia.length && !sobranBia.length, `faltan ${faltanBia.map((p) => p.nombre)} sobran ${sobranBia.map((p) => p.nombre)}`);
  }

  // ====================== h) PANEL ======================
  {
    const M = 'Panel de control';
    const d = (await admin.get('/dashboard')).html;
    const kpi = (titulo) => { const t = d.split(titulo + '</p>')[1] || ''; return (t.match(/tracking-tight[^>]*>\s*([^<]+)/) || [])[1]?.trim(); };
    const sistemas = await prisma.sistema.findMany({ include: { evaluaciones: { orderBy: { created_at: 'desc' }, take: 1, include: { controles: true } } } });
    const pcts = []; for (const s of sistemas.filter((x) => x.evaluaciones[0])) pcts.push((await pctEval(s.evaluaciones[0].id)).pct);
    const media = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    R(M, `Tarjeta «Cumplimiento ENS» = media de los sistemas (${media} %)`, kpi('Cumplimiento ENS') === String(media), `panel ${kpi('Cumplimiento ENS')}`);
    const incAb = await prisma.incidente.count({ where: { estado: { not: 'CERRADO' } } });
    R(M, `Tarjeta «Incidentes abiertos» = incidentes no cerrados en la BD (${incAb})`, kpi('Incidentes abiertos') === String(incAb), `panel ${kpi('Incidentes abiertos')}`);
    const tarjetaAcc = Number(kpi('Acciones pendientes'));
    const listaAcc = Number((d.match(/Acciones pendientes<\/span>\s*<span[^>]*>\s*\((\d+)\)/) || d.match(/Acciones pendientes[\s\S]{0,300}?\((\d+)\)/) || [])[1]);
    const itemsLista = (d.split('id="acciones"')[1] || d).split('</ul>')[0].split('<li').length - 1;
    R(M, 'El número de la tarjeta «Acciones pendientes» coincide con el de la lista', tarjetaAcc === listaAcc, `tarjeta ${tarjetaAcc}, lista (${listaAcc}), elementos ${itemsLista}`);
    // Ver por sistema
    for (const s of sistemas.slice(0, 4)) {
      const h = (await admin.get(`/dashboard?sistema=${s.id}`)).html;
      const inc = await prisma.incidente.count({ where: { sistema_id: s.id, estado: { not: 'CERRADO' } } });
      const kp = (h.split('Incidentes abiertos</p>')[1] || '').match(/tracking-tight[^>]*>\s*([^<]+)/)?.[1]?.trim();
      const ev = s.evaluaciones[0];
      const pct = ev ? (await pctEval(ev.id)).pct : null;
      const kpEns = (h.split('Cumplimiento ENS</p>')[1] || '').match(/tracking-tight[^>]*>\s*([^<]+)/)?.[1]?.trim();
      R(M, `Ver por sistema «${s.nombre}»: incidentes (${inc}) y ENS (${pct ?? '—'} %)`, h.includes(`Panel · ${s.nombre}`) || h.includes(s.nombre) ? kp === String(inc) && (pct === null ? kpEns === '—' : kpEns === String(pct)) : false, `panel: incidentes ${kp}, ENS ${kpEns}`);
    }
    let r = await admin.get('/dashboard?sistema=999999');
    R(M, 'Ver por sistema con id inexistente → vista general sin error', r.status === 200, `status ${r.status}`);
    r = await admin.get('/dashboard?sistema=99999999999');
    R(M, 'Ver por sistema con id fuera de rango → sin error', r.status === 200, `status ${r.status}`);
    // Enlaces del panel (general y por sistema)
    const rotos = [];
    for (const url of ['/dashboard', `/dashboard?sistema=${sis.id}`]) {
      const h = (await admin.get(url)).html;
      const hrefs = [...new Set([...h.matchAll(/href="(\/[^"#]*)/g)].map((m) => m[1].replace(/&amp;/g, '&')))].filter((x) => !x.startsWith('/css') && !x.startsWith('/fuentes') && !x.startsWith('/js'));
      for (const x of hrefs) { const rr = await admin.get(x); if (rr.status >= 400) rotos.push(`${x}→${rr.status}`); }
    }
    R(M, 'Todos los enlaces del panel («Ver módulo», títulos de acciones, tarjetas…) llevan a páginas válidas', !rotos.length, rotos.join(', ') || 'ninguno roto');
    // Enlace de cada acción lleva a donde dice
    const acciones = [...(d.split('id="acciones"')[1] || '').split('</ul>')[0].matchAll(/<a href="([^"]+)" class="enlace-registro" title="([^"]*)">([^<]+)<\/a>/g)].map((m) => ({ href: m[1].replace(/&amp;/g, '&'), titulo: m[3] }));
    const incoherentes = [];
    for (const a of acciones) {
      const rr = await admin.get(a.href);
      if (rr.status !== 200) incoherentes.push(`${a.titulo} → ${a.href} (${rr.status})`);
    }
    R(M, `Cada acción pendiente (${acciones.length}) abre una página válida`, !incoherentes.length && acciones.length > 0, incoherentes.join('; '));
    // Panel del usuario básico
    r = await carmen.get('/dashboard');
    R(M, 'Panel del usuario básico carga', r.status === 200, `status ${r.status}`);
  }

  // ====================== j) SEGURIDAD ======================
  {
    const M = 'Seguridad';
    const us = await prisma.usuario.findMany({ select: { email: true, password_hash: true } });
    R(M, `Contraseñas guardadas con hash bcrypt (${us.length} usuarios)`, us.every((u) => /^\$2[aby]\$\d{2}\$/.test(u.password_hash)), us.filter((u) => !/^\$2/.test(u.password_hash)).map((u) => u.email).join(', ') || 'todas $2b$');
    const form = (await admin.get('/rat/nueva')).html;
    const tieneToken = /name="_?csrf/i.test(form);
    R(M, 'Los formularios llevan token CSRF', tieneToken, tieneToken ? '' : 'ningún formulario tiene token; la única defensa es la cookie SameSite=Lax');
    let r = await admin.post(`/rat/${ratId}`, { nombre: 'ZZ CSRF', finalidad: 'x', base_legal: 'CONTRATO', categorias_datos: 'x', categorias_interesados: 'x', destinatarios: 'x', plazo_conservacion: 'x', medidas_seguridad: 'x', usuario_id: String(yo.id) }, { origin: 'https://atacante.example', referer: 'https://atacante.example/x' });
    R(M, 'POST con Origin de otro dominio es rechazado', (await prisma.actividadRat.findUnique({ where: { id: ratId } })).nombre !== 'ZZ CSRF', `status ${r.status}: el servidor no comprueba Origin/Referer ni token`);
    const antesNombre = (await prisma.actividadRat.findUnique({ where: { id: ratId } })).nombre;
    r = await admin.postSinToken(`/rat/${ratId}`, { nombre: 'ZZ SIN TOKEN', finalidad: 'x', base_legal: 'CONTRATO', categorias_datos: 'x', categorias_interesados: 'x', destinatarios: 'x', plazo_conservacion: 'x', medidas_seguridad: 'x', usuario_id: String(yo.id) });
    R(M, 'POST con sesión pero sin token CSRF → 403 y sin cambios', r.status === 403 && (await prisma.actividadRat.findUnique({ where: { id: ratId } })).nombre === antesNombre, `status ${r.status}`);
    r = await admin.postSinToken(`/rat/${ratId}`, { _csrf: 'token-falso', nombre: 'ZZ TOKEN FALSO' });
    R(M, 'POST con token CSRF falso → 403', r.status === 403, `status ${r.status}`);
    const mp = new FormData(); mp.append('x', '1');
    r = await admin.postSinToken(`/riesgos/${riesgoId}/eliminar`, mp);
    R(M, 'POST multipart (sin token) a una ruta que no es de subida → 403', r.status === 403 && !!(await prisma.riesgo.findUnique({ where: { id: riesgoId } })), `status ${r.status}`);
    const sinTok = fd({ nombre_documento: 'ZZ sin token', tipo_documento: 'OTRO' }, pdf());
    r = await admin.postSinToken(`/derechos/${derId}/documentos`, sinTok);
    R(M, 'Subida de archivo sin token CSRF → rechazada', !(await prisma.documentoSolicitudDerecho.findFirst({ where: { nombre_documento: 'ZZ sin token' } })), `status ${r.status}`);
    const paginaForm = (await admin.get(`/sistemas/${sis.id}`)).html;
    const formsPost = (paginaForm.match(/<form\b[^>]*method="POST"[^>]*>/gi) || []).length;
    const conToken = (paginaForm.match(/<form\b[^>]*method="POST"[^>]*><input type="hidden" name="_csrf"/gi) || []).length;
    R(M, `Todos los formularios POST de la página llevan el token (${formsPost})`, formsPost > 0 && formsPost === conToken, `${conToken} de ${formsPost}`);
    // XSS
    const XSS = '<script>alert(1)</script>"><img src=x onerror=alert(2)>';
    await admin.post(`/rat/${ratId}`, { nombre: XSS, finalidad: XSS, base_legal: 'CONTRATO', categorias_datos: 'x', categorias_interesados: 'x', destinatarios: 'x', plazo_conservacion: 'x', medidas_seguridad: 'x', usuario_id: String(yo.id), sistema_id: String(sisPrueba) });
    await admin.post(`/incidentes/${incId}`, { titulo: XSS, descripcion: XSS, tipo: 'CONFIDENCIALIDAD', gravedad: 'ALTA', fecha_deteccion: hoyInput(-10), sistema_id: String(sisPrueba), estado: 'EN_INVESTIGACION', responsable_id: String(yo.id) });
    await admin.post(`/sistemas/${sisPrueba}`, { nombre: 'ZZ ' + XSS, categoria_general: 'ALTA', descripcion: XSS });
    const paginas = ['/rat', `/rat/${ratId}`, '/riesgos', `/riesgos/${riesgoId}`, '/incidentes', `/incidentes/${incId}`, '/sistemas', `/sistemas/${sisPrueba}`, '/dashboard', `/dashboard?sistema=${sisPrueba}`, `/incidentes/${incId}/historial`, '/declaraciones', `/evaluaciones/${evId}`, `/rat/${ratId}/editar`, `/sistemas/${sisPrueba}/editar`];
    const inseguras = [];
    for (const p of paginas) { const h = (await admin.get(p)).html; if (h.includes('<script>alert(1)</script>') || h.includes('<img src=x onerror')) inseguras.push(p); }
    R(M, `Texto <script>… guardado se muestra escapado (${paginas.length} páginas)`, !inseguras.length, inseguras.join(', ') || 'escapado en todas');
    // Cabeceras
    r = await admin.get('/dashboard');
    const cab = ['x-frame-options', 'content-security-policy', 'x-content-type-options'].filter((h) => !r.headers.get(h));
    R(M, 'Cabeceras de seguridad (X-Frame-Options, CSP, X-Content-Type-Options)', !cab.length, cab.length ? 'faltan: ' + cab.join(', ') : '');
    R(M, 'No revela la tecnología (X-Powered-By)', !r.headers.get('x-powered-by'), r.headers.get('x-powered-by') || '');
    // Recorrido de ficheros en descargas
    r = await admin.get('/politicas/1/archivos/..%2F..%2F.env');
    R(M, 'Recorrido de rutas en la descarga de archivos', r.status === 404 && !r.html.includes('DATABASE_URL'), `status ${r.status}`);
  }

  // ====================== Borrado del sistema (d) ======================
  {
    const M = 'Sistemas';
    let r = await admin.post(`/sistemas/${sisPrueba}/eliminar`);
    const sigue = await prisma.sistema.findUnique({ where: { id: sisPrueba } });
    R(M, 'Eliminar sistema con declaración emitida → se impide', !!sigue, `status ${r.status} ${sigue ? 'no se borra (correcto)' : 'BORRADO'}`);
    // Sistema limpio para probar el borrado
    const s2 = await admin.post('/sistemas', { nombre: 'ZZ Sistema a borrar', categoria_general: 'BAJA', crear_evaluacion: 'on', nombre_evaluacion: 'x' });
    const id2 = (await prisma.sistema.findFirst({ where: { nombre: 'ZZ Sistema a borrar' } })).id;
    await admin.post('/incidentes', { titulo: 'ZZ Incidente del sistema borrado', descripcion: 'x', tipo: 'INTEGRIDAD', gravedad: 'BAJA', fecha_deteccion: hoyInput(-1), sistema_id: String(id2), categorias_datos_afectados: 'x', numero_afectados_estimado: '1', responsable_id: String(yo.id) });
    r = await admin.post(`/sistemas/${id2}/eliminar`);
    const huerfano = await prisma.incidente.findFirst({ where: { titulo: 'ZZ Incidente del sistema borrado' } });
    R(M, 'Eliminar sistema: se borra y sus registros quedan transversales', !(await prisma.sistema.findUnique({ where: { id: id2 } })) && huerfano && huerfano.sistema_id === null, `status ${r.status}`);
  }

  // ====================== i) GENERAL: recorrido de enlaces ======================
  {
    const M = 'General';
    let r = await admin.get('/esto-no-existe');
    R(M, 'Ruta inexistente → página 404 propia', r.status === 404 && r.html.includes('no existe'), `status ${r.status}`);
    const visitadas = new Set(); const cola = ['/dashboard']; const rotos = [];
    while (cola.length && visitadas.size < 450) {
      const url = cola.shift(); if (visitadas.has(url)) continue; visitadas.add(url);
      const rr = await admin.get(url);
      if (rr.status >= 400) rotos.push(`${url}→${rr.status}`);
      if (!rr.html) continue;
      for (const m of rr.html.matchAll(/href="(\/[^"#]*)/g)) {
        const h = m[1].replace(/&amp;/g, '&');
        if (/^\/(css|js|fuentes|favicon)/.test(h) || h.includes('/pdf') || h.includes('/archivos/') || h.includes('/documentos/') || h.includes('/adjuntos/')) continue;
        if (!visitadas.has(h)) cola.push(h);
      }
    }
    R(M, `Recorrido de enlaces como administrador (${visitadas.size} páginas)`, !rotos.length, rotos.join(', ') || 'sin enlaces rotos');
    const visitadasU = new Set(); const colaU = ['/dashboard']; const rotosU = [];
    while (colaU.length && visitadasU.size < 300) {
      const url = colaU.shift(); if (visitadasU.has(url)) continue; visitadasU.add(url);
      const rr = await carmen.get(url);
      if (rr.status >= 400) rotosU.push(`${url}→${rr.status}`);
      if (!rr.html) continue;
      for (const m of rr.html.matchAll(/href="(\/[^"#]*)/g)) {
        const h = m[1].replace(/&amp;/g, '&');
        if (/^\/(css|js|fuentes|favicon)/.test(h) || h.includes('/pdf') || h.includes('/archivos/') || h.includes('/documentos/') || h.includes('/adjuntos/')) continue;
        if (!visitadasU.has(h)) colaU.push(h);
      }
    }
    R(M, `Recorrido de enlaces como usuario básico (${visitadasU.size} páginas): ningún enlace visible lleva a 403/404`, !rotosU.length, rotosU.join(', ') || 'sin enlaces rotos');
    R(M, 'Ninguna respuesta 500 durante todas las pruebas', !errores500.length, errores500.join(', ') || 'ninguna');
    R(M, 'Ninguna página muestra trazas de error al usuario', !trazas.length, trazas.join(', ') || 'ninguna');
  }

  fs.writeFileSync(SALIDA, JSON.stringify({ resultados, errores500, trazas }, null, 2));
  await prisma.usuario.deleteMany({ where: { id: { in: creados.usuarios } } });
  await prisma.$disconnect();
  const n = (t) => resultados.filter((x) => x.resultado === t).length;
  console.log(`\nTOTAL ${resultados.length}: ${n('OK')} OK · ${n('FALLO')} FALLO · ${n('NO PROBADO')} NO PROBADO`);
  process.exitCode = n('FALLO') ? 1 : 0;
})().catch(async (e) => { console.error('ERROR EN LA BATERÍA:', e); fs.writeFileSync(SALIDA, JSON.stringify({ resultados, errores500, trazas, error: String(e.stack) }, null, 2)); process.exit(1); });
