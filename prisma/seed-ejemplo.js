// Datos de ejemplo: «Laboratorios Farmacéuticos Reunidos» (empresa FICTICIA).
// BORRA todos los datos (salvo las cuentas de usuario ya existentes) y carga un ejemplo
// coherente de cumplimiento RGPD + ENS con fechas de los últimos 12-18 meses.
// Todos los datos personales son inventados; los correos usan el dominio reservado .example.
//
// Uso: npm run db:ejemplo -- --confirmar
// (antes conviene hacer una copia: npm run db:copia)
require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const { prisma, MODELOS, ajustarSecuencias, contarTodo } = require('./utilidades-datos');
const { calcularNivel } = require('../lib/riesgo');
const { calcularFechaLimite } = require('../lib/derechos');
const { generarDeclaracion, emitirDeclaracion } = require('../lib/declaraciones');
const { rellenarDescripciones } = require('./descripciones-ens');
const { adjuntarPdfsEjemplo } = require('./pdfs-politicas');

// Datos ficticios de demostración con contraseñas conocidas: nunca en producción
if (process.env.NODE_ENV === 'production') {
  console.error('db:ejemplo no se puede ejecutar con NODE_ENV=production (crea cuentas con contraseñas conocidas).');
  process.exit(1);
}
if (!process.argv.includes('--confirmar')) {
  console.error('Este script BORRA los datos actuales. Ejecútalo con: npm run db:ejemplo -- --confirmar');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const DIA = 24 * 3600 * 1000;
const AHORA = new Date();
// Fecha de hace `dias` días a la hora indicada (hora local)
const hace = (dias, hora = 10, min = 0) => {
  const d = new Date(AHORA.getTime() - dias * DIA);
  d.setHours(hora, min, 0, 0);
  return d;
};
const enDias = (dias) => hace(-dias, 12);
// Generador pseudoaleatorio con semilla: el ejemplo sale siempre igual
let semilla = 20260601;
const azar = () => {
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const DOMINIO = 'labfarmareunidos.example';
// Dominios de cargas de ejemplo anteriores (sus usuarios se borran al recargar)
const DOMINIOS_ANTERIORES = ['labfarmaiberica.example'];

// ---------------------------------------------------------------------------
// Empresa: ficha de la organización (tabla organizacion) y pie de las políticas
// ---------------------------------------------------------------------------
const EMPRESA = {
  nombre: 'Laboratorios Farmacéuticos Reunidos',
  cif: 'A87654321',
  sector: 'Industria farmacéutica',
  direccion: 'Avenida de la Innovación 14, Parque Tecnológico',
  codigo_postal: '28760',
  localidad: 'Tres Cantos',
  provincia: 'Madrid',
  telefono: '910 000 000',
  web: 'https://www.labfarmareunidos.example',
};

const USUARIOS = {
  direccion: { nombre: 'Elena Martín Robles', area: 'Dirección', rol: 'ADMIN', cargo: 'Directora General · Responsable de la Información' },
  dpd: { nombre: 'Javier Ortega Llamas', area: 'Dirección', rol: 'ADMIN', cargo: 'Delegado de Protección de Datos (DPD)' },
  seguridad: { nombre: 'Marta Quintero Saiz', area: 'Área de informática', rol: 'ADMIN', cargo: 'Responsable de Seguridad' },
  sistemas: { nombre: 'Andrés Peña Valverde', area: 'Área de informática', rol: 'USUARIO', cargo: 'Responsable del Sistema' },
  laboratorio: { nombre: 'Lucía Fernández Gil', area: 'Área de laboratorio', rol: 'USUARIO', cargo: 'Directora técnica de laboratorio' },
  farmacovigilancia: { nombre: 'Pablo Rubio Castaño', area: 'Área de laboratorio', rol: 'USUARIO', cargo: 'Responsable de farmacovigilancia' },
  finanzas: { nombre: 'Carmen Vidal Ochoa', area: 'Área financiera', rol: 'USUARIO', cargo: 'Directora financiera' },
  nominas: { nombre: 'Sergio Navas Prieto', area: 'Área financiera', rol: 'USUARIO', cargo: 'Técnico de nóminas y administración' },
};
const CLAVE_EJEMPLO = 'Ejemplo2026';

// ---------------------------------------------------------------------------
// Medidas de seguridad del Anexo II del ENS (RD 311/2022). La categoría indica la
// categoría de sistema a partir de la cual se exige la medida (simplificado).
// ---------------------------------------------------------------------------
const MEDIDAS = [
  ['org.1 Política de seguridad', 'BAJA'],
  ['org.2 Normativa de seguridad', 'BAJA'],
  ['org.3 Procedimientos de seguridad', 'BAJA'],
  ['org.4 Proceso de autorización', 'BAJA'],
  ['op.pl.1 Análisis de riesgos', 'BAJA'],
  ['op.pl.2 Arquitectura de seguridad', 'BAJA'],
  ['op.pl.3 Adquisición de nuevos componentes', 'BAJA'],
  ['op.pl.4 Dimensionamiento / gestión de la capacidad', 'MEDIA'],
  ['op.acc.1 Identificación', 'BAJA'],
  ['op.acc.2 Requisitos de acceso', 'BAJA'],
  ['op.acc.3 Segregación de funciones y tareas', 'MEDIA'],
  ['op.acc.4 Proceso de gestión de derechos de acceso', 'BAJA'],
  ['op.acc.5 Mecanismo de autenticación (usuarios externos)', 'BAJA'],
  ['op.acc.6 Mecanismo de autenticación (usuarios de la organización)', 'BAJA'],
  ['op.exp.1 Inventario de activos', 'BAJA'],
  ['op.exp.2 Configuración de seguridad', 'BAJA'],
  ['op.exp.4 Mantenimiento y actualizaciones de seguridad', 'BAJA'],
  ['op.exp.6 Protección frente a código dañino', 'BAJA'],
  ['op.exp.7 Gestión de incidentes', 'MEDIA'],
  ['op.exp.8 Registro de la actividad', 'MEDIA'],
  ['op.exp.10 Protección de claves criptográficas', 'MEDIA'],
  ['op.ext.1 Contratación y acuerdos de nivel de servicio', 'MEDIA'],
  ['op.nub.1 Protección de servicios en la nube', 'BAJA'],
  ['op.cont.1 Análisis de impacto', 'MEDIA'],
  ['op.cont.2 Plan de continuidad', 'ALTA'],
  ['op.cont.3 Pruebas periódicas', 'ALTA'],
  ['op.mon.1 Detección de intrusión', 'BAJA'],
  ['op.mon.3 Vigilancia', 'MEDIA'],
  ['mp.if.1 Áreas separadas y con control de acceso', 'BAJA'],
  ['mp.if.5 Protección frente a incendios', 'BAJA'],
  ['mp.per.3 Concienciación', 'BAJA'],
  ['mp.per.4 Formación', 'BAJA'],
  ['mp.eq.2 Bloqueo de puesto de trabajo', 'MEDIA'],
  ['mp.com.1 Perímetro seguro', 'BAJA'],
  ['mp.com.2 Protección de la confidencialidad', 'MEDIA'],
  ['mp.si.2 Criptografía', 'MEDIA'],
  ['mp.info.2 Calificación de la información', 'MEDIA'],
  ['mp.info.6 Copias de seguridad', 'BAJA'],
  ['mp.s.2 Protección de servicios y aplicaciones web', 'BAJA'],
];
const EVIDENCIAS = {
  'org.1': 'PSI v2.0 aprobada por la Dirección (acta del Comité de Seguridad)',
  'org.2': 'Normativa de uso de recursos TIC publicada en la intranet',
  'op.pl.1': 'Análisis de riesgos MAGERIT revisado en el último trimestre',
  'op.acc.6': 'MFA obligatorio en el acceso corporativo (informe de configuración)',
  'op.exp.1': 'Inventario de activos en la CMDB, conciliado mensualmente',
  'op.exp.6': 'EDR desplegado en el 100 % de puestos y servidores',
  'op.exp.7': 'Procedimiento PR-SEG-04 de gestión de incidentes y brechas',
  'op.exp.8': 'Logs centralizados en el SIEM con retención de 12 meses',
  'op.cont.1': 'BIA de procesos críticos aprobado por Dirección',
  'mp.per.3': 'Campaña anual de concienciación y simulacro de phishing',
  'mp.info.6': 'Copias diarias 3-2-1 con prueba de restauración trimestral',
  'mp.si.2': 'Cifrado AES-256 de discos y bases de datos',
};
const codigo = (nombre) => nombre.split(' ')[0];

// ---------------------------------------------------------------------------
// Sistemas de información (activos), por departamento
// ---------------------------------------------------------------------------
const SISTEMAS = [
  { clave: 'lab', nombre: 'Área de laboratorio', tipo: 'Sistemas de laboratorio (GxP)', categoria: 'ALTA', depto: 'Área de laboratorio',
    niveles: 'C: Alta · I: Alta · T: Media · A: Media · D: Media',
    desc: 'Activos: LIMS (gestión de muestras, control de calidad y liberación de lotes; validado según GMP Anexo 11), repositorio de resultados analíticos con firma electrónica y audit trail, y equipos de análisis conectados (cromatógrafos HPLC, espectrómetros, balanzas). Incluye los datos de ensayos clínicos y de farmacovigilancia.',
    evaluaciones: [0.4, 0.6], noAplica: ['op.nub.1', 'mp.s.2'] },
  { clave: 'info', nombre: 'Área de informática', tipo: 'Infraestructura TIC corporativa', categoria: 'MEDIA', depto: 'Área de informática',
    niveles: 'C: Media · I: Media · T: Media · A: Alta · D: Alta',
    desc: 'Activos: Directorio activo con SSO y MFA, servidores virtualizados y red del CPD de Tres Cantos, sistema de copias de seguridad (3-2-1 con réplica externa inmutable) y videovigilancia del CPD.',
    evaluaciones: [0.68, 0.88], noAplica: [] },
  { clave: 'fin', nombre: 'Área financiera', tipo: 'Aplicaciones de gestión', categoria: 'MEDIA', depto: 'Área financiera',
    niveles: 'C: Media · I: Alta · T: Alta · A: Alta · D: Media',
    desc: 'Activos: ERP corporativo (contabilidad, compras, facturación, tesorería y nóminas, con portal del empleado) y banca electrónica para remesas de pago, cobros SEPA y conciliación.',
    evaluaciones: [0.3, 0.45], noAplica: ['op.nub.1'] },
];

// ---------------------------------------------------------------------------
async function main() {
  // 1) Vaciar datos conservando las cuentas de usuario existentes (salvo las de ejemplo anteriores)
  const tablas = MODELOS.filter(([m]) => m !== 'usuario').map(([, t]) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tablas} RESTART IDENTITY CASCADE`);
  for (const d of [DOMINIO, ...DOMINIOS_ANTERIORES]) await prisma.usuario.deleteMany({ where: { email: { endsWith: '@' + d } } });

  // 2) Usuarios: administrador de acceso garantizado + plantilla ficticia de la empresa
  const hashAdmin = await bcrypt.hash('admin1234', 12);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: { nombre: 'Administrador', email: 'admin@test.com', password_hash: hashAdmin, rol: 'ADMIN', cargo: 'Administrador de la plataforma' },
  });
  const hash = await bcrypt.hash(CLAVE_EJEMPLO, 10);
  const u = {};
  for (const [clave, d] of Object.entries(USUARIOS)) {
    const email = d.nombre.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '.' +
      d.nombre.split(' ')[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@' + DOMINIO;
    u[clave] = await prisma.usuario.create({ data: { nombre: d.nombre, email, password_hash: hash, rol: d.rol, cargo: d.cargo } });
  }
  const todosUsuarios = await prisma.usuario.findMany();

  await prisma.organizacion.create({
    data: {
      ...EMPRESA, email: 'info@' + DOMINIO, categoria_ens: 'MEDIA',
      dpd_nombre: USUARIOS.dpd.nombre, dpd_email: 'dpd@' + DOMINIO,
      responsable_informacion: USUARIOS.direccion.nombre, responsable_seguridad: USUARIOS.seguridad.nombre, responsable_sistema: USUARIOS.sistemas.nombre,
    },
  });

  // 3) Catálogo de medidas ENS (Anexo II)
  await prisma.controlEns.createMany({ data: MEDIDAS.map(([nombre, categoria]) => ({ nombre, categoria, created_at: hace(540) })) });
  await rellenarDescripciones(prisma);
  const controles = await prisma.controlEns.findMany({ orderBy: { id: 'asc' } });
  const responsableMedida = (nombre) => {
    const c = codigo(nombre);
    if (c.startsWith('org')) return u.seguridad.id;
    if (c.startsWith('op.cont')) return u.direccion.id;
    if (c.startsWith('mp.per')) return u.dpd.id;
    return u.sistemas.id;
  };

  // 4) Sistemas, evaluaciones (estado de implantación) e histórico de cambios
  const sis = {};
  const ultimaEval = {};
  const evaluaciones = {};
  for (const [i, s] of SISTEMAS.entries()) {
    sis[s.clave] = await prisma.sistema.create({
      data: {
        nombre: s.nombre, tipo_sistema: s.tipo, categoria_general: s.categoria, creado_por_id: u.seguridad.id,
        descripcion: `${s.desc}\nDepartamento: ${s.depto}. Niveles por dimensión: ${s.niveles}.`,
        created_at: hace(520 - i * 3), updated_at: hace(40 + i),
      },
    });
    let anteriores = null;
    for (const [n, ratio] of s.evaluaciones.entries()) {
      const esUltima = n === s.evaluaciones.length - 1;
      const fechaEval = s.evaluaciones.length === 1 ? hace(120 + i * 7) : n === 0 ? hace(400 + i * 5) : hace(35 + i * 4);
      const ev = await prisma.evaluacion.create({
        data: { sistema_id: sis[s.clave].id, nombre: n === 0 ? 'Evaluación inicial de adecuación' : 'Revisión anual de cumplimiento', creado_por_id: u.seguridad.id, created_at: fechaEval },
      });
      // En una revisión, lo ya implementado se mantiene y de lo pendiente se implementa la
      // proporción justa para acercarse al objetivo `ratio` de esa evaluación
      const ratioPrevio = n > 0 ? s.evaluaciones[n - 1] : 0;
      const probNuevo = n > 0 ? Math.max(0, (ratio - ratioPrevio) / (1 - ratioPrevio)) : ratio;
      const estados = controles.map((c, k) => {
        if (s.noAplica.includes(codigo(c.nombre))) return 'NO_APLICA';
        if (anteriores && anteriores[k] === 'IMPLEMENTADO') return 'IMPLEMENTADO';
        return azar() < probNuevo ? 'IMPLEMENTADO' : 'PENDIENTE';
      });
      for (const [k, c] of controles.entries()) {
        const estado = estados[k];
        const fila = await prisma.evaluacionControl.create({
          data: {
            evaluacion_id: ev.id, control_id: c.id, estado,
            responsable_id: estado === 'NO_APLICA' ? null : responsableMedida(c.nombre),
            evidencia: estado === 'IMPLEMENTADO' ? EVIDENCIAS[codigo(c.nombre)] || 'Verificado en la auditoría interna' : estado === 'NO_APLICA' ? 'No aplica al alcance del sistema' : null,
            fecha_revision: estado === 'PENDIENTE' ? null : new Date(Math.min(fechaEval.getTime() + (5 + k) * DIA, hace(1).getTime())),
          },
        });
        // Histórico: controles que pasan a implementados durante la evaluación vigente
        if (esUltima && estado !== 'PENDIENTE' && (anteriores ? anteriores[k] === 'PENDIENTE' : azar() < 0.35)) {
          await prisma.historialEstado.create({
            data: { evaluacion_control_id: fila.id, estado_anterior: 'PENDIENTE', estado_nuevo: estado, usuario_id: responsableMedida(c.nombre) || u.sistemas.id, fecha: new Date(fechaEval.getTime() + (3 + (k % 20)) * DIA) },
          });
        }
      }
      anteriores = estados;
      ultimaEval[s.clave] = ev;
      (evaluaciones[s.clave] = evaluaciones[s.clave] || []).push(ev);
    }
  }
  // Cada empleado de la plantilla trabaja en el sistema de su área (Dirección: sin sistema)
  const sistemaDeArea = { 'Área de laboratorio': sis.lab, 'Área de informática': sis.info, 'Área financiera': sis.fin };
  await prisma.usuarioSistema.createMany({
    data: Object.keys(USUARIOS).filter((k) => sistemaDeArea[USUARIOS[k].area]).map((k) => ({ usuario_id: u[k].id, sistema_id: sistemaDeArea[USUARIOS[k].area].id })),
  });

  // Cada activo pertenece al sistema de su departamento
  Object.assign(sis, {
    lims: sis.lab, repositorio: sis.lab, equipos: sis.lab,
    ad: sis.info, cpd: sis.info, copias: sis.info, video: sis.info,
    erp: sis.fin, banca: sis.fin,
  });

  // 5) Declaraciones de conformidad (con la lógica de la aplicación) y fechas realistas
  // `deLaInicial`: generarla desde la primera evaluación del sistema (declaración antigua)
  const declarar = async (clave, emitir, diasGen, diasEmision, deLaInicial = false) => {
    const ev = deLaInicial ? evaluaciones[clave][0] : ultimaEval[clave];
    const { declaracion } = await generarDeclaracion(ev.id, u.seguridad);
    if (emitir) await emitirDeclaracion(declaracion.id, u.direccion);
    await prisma.declaracionConformidad.update({
      where: { id: declaracion.id },
      data: { fecha_generacion: hace(diasGen), ...(emitir && { fecha_emision: hace(diasEmision) }), observaciones: emitir ? 'Revisada por el Comité de Seguridad de la Información.' : 'Pendiente de cerrar las medidas de continuidad antes de emitir.' },
    });
  };
  await declarar('info', true, 30, 25);
  await declarar('fin', true, 395, 390, true); // emitida hace más de 12 meses: hay que renovarla
  await declarar('lab', false, 12);

  // 6) Políticas y documentación (los datos de la empresa van en su descripción)
  const pie = `${EMPRESA.nombre} · CIF ${EMPRESA.cif} · ${EMPRESA.direccion}, ${EMPRESA.codigo_postal} ${EMPRESA.localidad} (${EMPRESA.provincia}). Responsable de la Información: ${USUARIOS.direccion.nombre}. Responsable de Seguridad: ${USUARIOS.seguridad.nombre}. Responsable del Sistema: ${USUARIOS.sistemas.nombre}. DPD: ${USUARIOS.dpd.nombre} (dpd@${DOMINIO}).`;
  const POLITICAS = [
    { titulo: 'Política de Seguridad de la Información', tipo: 'POLITICA', version: '2.0', estado: 'APROBADA', aprob: 300, rev: 65, acepta: true,
      desc: `Marco de seguridad conforme al ENS (RD 311/2022, art. 12). Categoría global de la organización: MEDIA. Define roles, comité de seguridad y estructura normativa. ${pie}` },
    { titulo: 'Política de Protección de Datos Personales', tipo: 'POLITICA', version: '1.3', estado: 'APROBADA', aprob: 210, rev: 155, acepta: true,
      desc: `Principios del RGPD y la LOPDGDD, tratamiento de categorías especiales (datos de salud en ensayos clínicos y farmacovigilancia), derechos de los interesados y funciones del DPD. ${pie}` },
    { titulo: 'Normativa de uso de los recursos TIC', tipo: 'NORMATIVA_INTERNA', version: '1.1', estado: 'APROBADA', aprob: 380, rev: -15, acepta: true,
      desc: 'Uso aceptable del correo, puestos de trabajo, dispositivos móviles e internet; contraseñas y MFA; puesto despejado y bloqueo de sesión.' },
    { titulo: 'Procedimiento de gestión de incidentes y notificación de brechas', tipo: 'PROCEDIMIENTO', version: '1.2', estado: 'APROBADA', aprob: 190, rev: 175, acepta: false,
      desc: 'Detección, clasificación, contención y cierre de incidentes; evaluación del riesgo para los interesados y notificación a la AEPD en 72 h (art. 33 RGPD) y a los afectados (art. 34). Notificación al CCN-CERT cuando proceda.' },
    { titulo: 'Plan de continuidad de negocio', tipo: 'PROCEDIMIENTO', version: '1.0', estado: 'APROBADA', aprob: 250, rev: 20, acepta: false,
      desc: 'Estrategias de recuperación de los procesos críticos (fabricación y liberación de lotes, farmacovigilancia, servicios TI) según el BIA. Pruebas anuales.' },
    { titulo: 'Instrucción técnica de copias de seguridad y restauración', tipo: 'INSTRUCCION_TECNICA', version: '1.4', estado: 'APROBADA', aprob: 120, rev: 245, acepta: false,
      desc: 'Política 3-2-1, copias inmutables, retención, cifrado y pruebas de restauración trimestrales.' },
    { titulo: 'Procedimiento de integridad de datos GxP (GMP Anexo 11)', tipo: 'PROCEDIMIENTO', version: '0.9', estado: 'PENDIENTE_APROBACION', aprob: null, rev: null, acepta: false,
      desc: 'Principios ALCOA+, audit trail, firma electrónica y validación de sistemas informatizados según las Normas de Correcta Fabricación (EudraLex vol. 4) y las inspecciones de la AEMPS.' },
    { titulo: 'Marco normativo aplicable', tipo: 'OTRO', version: '3.0', estado: 'APROBADA', aprob: 90, rev: 275, acepta: false,
      desc: `RGPD (UE) 2016/679; LOPDGDD (LO 3/2018); ENS (RD 311/2022); Reglamento (UE) 536/2014 y RD 1090/2015 de ensayos clínicos; RD 577/2013 de farmacovigilancia; Normas de Correcta Fabricación (GMP, EudraLex vol. 4, Anexo 11); Ley General Tributaria y Código de Comercio (conservación). ${pie}` },
  ];
  const politicas = {};
  for (const p of POLITICAS) {
    politicas[p.titulo] = await prisma.politica.create({
      data: {
        titulo: p.titulo, tipo_documento: p.tipo, descripcion: p.desc, version: p.version, estado: p.estado, requiere_aceptacion: p.acepta,
        fecha_aprobacion: p.aprob ? hace(p.aprob) : null, aprobado_por_id: p.aprob ? u.direccion.id : null,
        fecha_proxima_revision: p.rev === null ? null : enDias(p.rev), creado_por_id: u.seguridad.id,
        created_at: hace((p.aprob || 30) + 20), updated_at: hace(p.aprob || 10),
      },
    });
  }
  // Aceptaciones: la mayoría de la plantilla ha aceptado; algunos pendientes
  for (const p of POLITICAS.filter((x) => x.acepta)) {
    const pol = politicas[p.titulo];
    const aceptan = todosUsuarios.filter((x, i) => (i + p.titulo.length) % 4 !== 0);
    for (const [i, us] of aceptan.entries()) {
      await prisma.aceptacionPolitica.create({ data: { politica_id: pol.id, version_aceptada: p.version, usuario_id: us.id, fecha_aceptacion: hace(Math.max(1, p.aprob - 3 - i * 4), 9 + (i % 6)) } });
    }
  }

  // PDF de ejemplo de cada política (sin él no se puede leer ni aceptar)
  await adjuntarPdfsEjemplo(prisma);

  // 7) Proveedores / encargados del tratamiento (nombres ficticios)
  const PROVEEDORES = [
    { nombre_empresa: 'Hispania Cloud Hosting, S.L.', cif: 'B11223344', servicio_prestado: 'Infraestructura en la nube (IaaS) para entornos de preproducción y réplica de copias', categorias_datos_tratados: 'Datos de empleados, clientes y proveedores contenidos en copias cifradas', pais_tratamiento: 'España', fuera_ue: false, mecanismo_transferencia: 'NO_APLICA', contrato: 400, revision: 330, ens: 'ALTO', responsable: 'seguridad', contacto: 'Laura Benítez Soria' },
    { nombre_empresa: 'MailWorks Europe Ltd.', cif: null, servicio_prestado: 'Correo electrónico y ofimática en la nube', categorias_datos_tratados: 'Identificativos y de contacto de empleados, comunicaciones corporativas', pais_tratamiento: 'Irlanda (UE); soporte desde EE. UU.', fuera_ue: true, mecanismo_transferencia: 'DECISION_ADECUACION', contrato: 500, revision: 230, ens: 'MEDIO', responsable: 'sistemas', contacto: 'Support Team' },
    { nombre_empresa: 'SafeVault Backup Inc.', cif: null, servicio_prestado: 'Copia externa inmutable (offsite) de los sistemas críticos', categorias_datos_tratados: 'Copias cifradas de bases de datos (incluidos datos de salud seudonimizados)', pais_tratamiento: 'Estados Unidos', fuera_ue: true, mecanismo_transferencia: 'CLAUSULAS_TIPO', contrato: 280, revision: 85, ens: 'NO_ACREDITADO', responsable: 'seguridad', contacto: 'Compliance Desk' },
    { nombre_empresa: 'Clinical Research Partners Iberia, S.L.', cif: 'B55667788', servicio_prestado: 'Organización de investigación por contrato (CRO): monitorización de ensayos clínicos', categorias_datos_tratados: 'Datos de salud seudonimizados de participantes en ensayos clínicos', pais_tratamiento: 'España', fuera_ue: false, mecanismo_transferencia: 'NO_APLICA', contrato: 450, revision: 15, ens: 'NO_APLICA', responsable: 'laboratorio', contacto: 'Raquel Domingo Ferrer' },
    { nombre_empresa: 'Gestoría Laboral Meseta, S.L.', cif: 'B99887766', servicio_prestado: 'Apoyo en la elaboración de nóminas y seguros sociales', categorias_datos_tratados: 'Identificativos, económicos y de Seguridad Social de empleados', pais_tratamiento: 'España', fuera_ue: false, mecanismo_transferencia: 'NO_APLICA', contrato: null, revision: null, ens: 'NO_APLICA', responsable: 'finanzas', contacto: 'Tomás Herrero Pardo', estado: 'EN_REVISION' },
    { nombre_empresa: 'Vigilancia Integral Centro, S.A.', cif: 'A33445566', servicio_prestado: 'Mantenimiento del sistema de videovigilancia y control de accesos del CPD', categorias_datos_tratados: 'Imágenes de empleados y visitantes', pais_tratamiento: 'España', fuera_ue: false, mecanismo_transferencia: 'NO_APLICA', contrato: 600, revision: 130, ens: 'BASICO', responsable: 'seguridad', contacto: 'Iván Lozano Romero' },
    { nombre_empresa: 'PV Literature Screening Pvt. Ltd.', cif: null, servicio_prestado: 'Revisión de literatura científica para farmacovigilancia', categorias_datos_tratados: 'Datos de salud de casos de reacciones adversas publicados', pais_tratamiento: 'India', fuera_ue: true, mecanismo_transferencia: 'NO_APLICA', contrato: 150, revision: 215, ens: 'NO_APLICA', responsable: 'farmacovigilancia', contacto: 'PV Operations' },
  ];
  for (const [i, p] of PROVEEDORES.entries()) {
    await prisma.proveedor.create({
      data: {
        nombre_empresa: p.nombre_empresa, cif: p.cif, servicio_prestado: p.servicio_prestado, categorias_datos_tratados: p.categorias_datos_tratados,
        pais_tratamiento: p.pais_tratamiento, fuera_ue: p.fuera_ue, mecanismo_transferencia: p.mecanismo_transferencia,
        tiene_contrato_encargado: p.contrato !== null, fecha_firma_contrato: p.contrato ? hace(p.contrato) : null,
        fecha_revision_contrato: p.revision === null ? null : enDias(p.revision), nivel_cumplimiento_ens: p.ens, estado: p.estado || 'ACTIVO',
        persona_contacto: p.contacto, email_contacto: `contacto${i + 1}@proveedor${i + 1}.example`,
        responsable_id: u[p.responsable].id, creado_por_id: u.dpd.id, created_at: hace(520 - i * 20), updated_at: hace(30 + i * 7),
      },
    });
  }

  // 8) Registro de actividades de tratamiento (art. 30 RGPD) de los tres departamentos
  const ACTIVIDADES = [
    { clave: 'ensayos', nombre: 'Ensayos clínicos', resp: 'laboratorio', sistema: 'lims', base: 'CONSENTIMIENTO',
      finalidad: 'Gestión de los participantes y de los datos clínicos de los ensayos promovidos por la compañía. Categoría especial (art. 9.2.a RGPD: consentimiento explícito; Reglamento (UE) 536/2014). Sujeto a EIPD obligatoria.',
      datos: 'Identificativos seudonimizados (código de participante), datos de salud y genéticos (categoría especial, art. 9 RGPD), resultados analíticos',
      interesados: 'Participantes en ensayos clínicos, investigadores', destinatarios: 'CRO contratada, centros de investigación, comités de ética (CEIm), AEMPS, promotor del ensayo',
      intl: true, pais: 'Estados Unidos (promotor) – cláusulas contractuales tipo', plazo: '25 años desde la finalización del ensayo (art. 58 Reglamento (UE) 536/2014)',
      medidas: 'Seudonimización en origen, cifrado, control de acceso por roles en el LIMS, audit trail, EIPD aprobada por el DPD' },
    { clave: 'farmaco', nombre: 'Farmacovigilancia', resp: 'farmacovigilancia', sistema: 'lims', base: 'OBLIGACION_LEGAL',
      finalidad: 'Registro, evaluación y notificación de sospechas de reacciones adversas a medicamentos (RD 577/2013). Categoría especial (art. 9.2.i RGPD: interés público en salud).',
      datos: 'Datos de salud del paciente (iniciales, edad, sexo, reacción adversa), datos de contacto del notificador',
      interesados: 'Pacientes, profesionales sanitarios notificadores', destinatarios: 'AEMPS, EudraVigilance (EMA), proveedor de revisión de literatura',
      intl: true, pais: 'India (revisión de literatura) – pendiente de formalizar garantías', plazo: 'Vigencia de la autorización de comercialización + 10 años',
      medidas: 'Acceso restringido al equipo de farmacovigilancia, registro de accesos, revisión de calidad de casos' },
    { clave: 'personal_lab', nombre: 'Gestión del personal de laboratorio (GMP)', resp: 'laboratorio', sistema: null, base: 'OBLIGACION_LEGAL',
      finalidad: 'Registros de formación y cualificación GMP, firmas autorizadas y control de acceso a salas blancas.',
      datos: 'Identificativos, formación y cualificaciones, firma manuscrita y electrónica, registros de acceso',
      interesados: 'Personal técnico de laboratorio y producción', destinatarios: 'AEMPS (inspecciones GMP), auditores de clientes',
      intl: false, pais: null, plazo: 'Duración de la relación laboral + 5 años (requisito GMP de registros de lote)',
      medidas: 'Control de acceso a salas blancas con tarjeta, registros firmados electrónicamente' },
    { clave: 'logs', nombre: 'Registros de acceso a sistemas (logs)', resp: 'seguridad', sistema: 'cpd', base: 'INTERES_LEGITIMO',
      finalidad: 'Detección de incidentes y trazabilidad de accesos a los sistemas de información (ENS op.exp.8).',
      datos: 'Usuario, dirección IP, fecha y hora, recurso accedido, resultado', interesados: 'Empleados y usuarios externos con acceso',
      destinatarios: 'No se ceden, salvo obligación legal o requerimiento judicial', intl: false, pais: null, plazo: '12 meses (2 años si están ligados a un incidente)',
      medidas: 'SIEM con acceso restringido, integridad de logs, retención automatizada' },
    { clave: 'cuentas', nombre: 'Gestión de cuentas de usuario', resp: 'sistemas', sistema: 'ad', base: 'CONTRATO',
      finalidad: 'Alta, modificación y baja de identidades y permisos de acceso a los sistemas corporativos.',
      datos: 'Identificativos, puesto, departamento, credenciales, factores MFA', interesados: 'Empleados, personal externo',
      destinatarios: 'Proveedor de correo y ofimática', intl: true, pais: 'Estados Unidos (soporte del proveedor de correo) – decisión de adecuación', plazo: 'Mientras dure la relación y 1 año tras la baja',
      medidas: 'MFA, revisión semestral de permisos, procedimiento de bajas automatizado' },
    { clave: 'video', nombre: 'Videovigilancia del CPD', resp: 'seguridad', sistema: 'video', base: 'INTERES_PUBLICO',
      finalidad: 'Seguridad de las instalaciones del CPD (art. 22 LOPDGDD).', datos: 'Imágenes', interesados: 'Empleados, proveedores y visitantes',
      destinatarios: 'Fuerzas y Cuerpos de Seguridad en caso de delito', intl: false, pais: null, plazo: '1 mes (art. 22.3 LOPDGDD)',
      medidas: 'Cartelería informativa, grabación cifrada, acceso solo del Responsable de Seguridad' },
    { clave: 'nominas', nombre: 'Gestión de nóminas y Seguridad Social', resp: 'nominas', sistema: 'erp', base: 'OBLIGACION_LEGAL',
      finalidad: 'Elaboración de nóminas, seguros sociales, retenciones de IRPF y certificados.',
      datos: 'Identificativos, bancarios, económicos, afiliación a la Seguridad Social, situación familiar a efectos de IRPF',
      interesados: 'Empleados', destinatarios: 'Agencia Tributaria, Tesorería General de la Seguridad Social, entidades bancarias, gestoría laboral',
      intl: false, pais: null, plazo: '4 años (Ley General Tributaria y Seguridad Social); 6 años para la documentación contable (art. 30 Código de Comercio)',
      medidas: 'Acceso restringido al módulo de nóminas, cifrado de ficheros de remesas' },
    { clave: 'proveedores', nombre: 'Gestión de proveedores y compras', resp: 'finanzas', sistema: 'erp', base: 'CONTRATO',
      finalidad: 'Gestión de pedidos, homologación de proveedores, facturas recibidas y pagos.',
      datos: 'Identificativos y de contacto de personas de contacto, bancarios', interesados: 'Proveedores y sus representantes',
      destinatarios: 'Entidades bancarias, Agencia Tributaria', intl: false, pais: null, plazo: '6 años (art. 30 Código de Comercio)',
      medidas: 'Segregación de funciones entre compras y pagos, doble validación de cuentas bancarias' },
    { clave: 'clientes', nombre: 'Clientes y facturación', resp: 'finanzas', sistema: 'erp', base: 'CONTRATO',
      finalidad: 'Gestión comercial con distribuidores y farmacias, facturación y obligaciones fiscales.',
      datos: 'Identificativos y de contacto, datos de facturación', interesados: 'Clientes (distribuidores, farmacias) y sus representantes',
      destinatarios: 'Agencia Tributaria, entidades bancarias', intl: false, pais: null, plazo: '6 años (Código de Comercio); 4 años a efectos fiscales',
      medidas: 'Control de acceso por perfiles en el ERP' },
    { clave: 'cobros', nombre: 'Gestión de cobros e impagos', resp: 'finanzas', sistema: 'banca', base: 'INTERES_LEGITIMO',
      finalidad: 'Gestión de cobros SEPA, reclamación de impagos y conciliación bancaria.',
      datos: 'Identificativos, bancarios, importes adeudados', interesados: 'Clientes', destinatarios: 'Entidades bancarias, asesoría jurídica externa',
      intl: false, pais: null, plazo: 'Hasta la prescripción de las acciones (5 años, art. 1964 Código Civil)',
      medidas: 'Doble firma en la banca electrónica, MFA del banco' },
  ];
  const act = {};
  for (const [i, a] of ACTIVIDADES.entries()) {
    act[a.clave] = await prisma.actividadRat.create({
      data: {
        nombre: a.nombre, finalidad: a.finalidad, base_legal: a.base, categorias_datos: a.datos, categorias_interesados: a.interesados,
        destinatarios: a.destinatarios, transferencia_intl: a.intl, pais_transferencia: a.pais, plazo_conservacion: a.plazo,
        medidas_seguridad: a.medidas, usuario_id: u[a.resp].id, sistema_id: a.sistema ? sis[a.sistema].id : null,
        created_at: hace(500 - i * 15), updated_at: hace(60 - i * 3),
      },
    });
  }

  // 9) Riesgos (incluye los de la EIPD de ensayos clínicos); riesgo residual en las medidas
  const RIESGOS = [
    ['ensayos', 'lims', 'Reidentificación de participantes a partir de datos seudonimizados', 'MEDIA', 'ALTO', 'EIPD: seudonimización con clave custodiada por el DPD, minimización de variables. Riesgo residual: BAJO.'],
    ['ensayos', 'lims', 'Acceso no autorizado a datos de salud de participantes', 'MEDIA', 'ALTO', 'EIPD: control de acceso por roles, MFA, revisión trimestral de permisos. Riesgo residual: MEDIO.'],
    ['ensayos', null, 'Transferencia internacional al promotor sin garantías suficientes', 'BAJA', 'ALTO', 'EIPD: cláusulas contractuales tipo y evaluación de impacto de la transferencia. Riesgo residual: BAJO.'],
    ['ensayos', 'lims', 'Retirada del consentimiento no reflejada en los sistemas', 'MEDIA', 'MEDIO', null],
    ['farmaco', 'lims', 'Retraso en la notificación de reacciones adversas graves a la AEMPS', 'BAJA', 'ALTO', 'Alertas automáticas a 15 días, guardias de farmacovigilancia. Riesgo residual: BAJO.'],
    ['farmaco', null, 'Proveedor de revisión de literatura fuera del EEE sin garantías', 'ALTA', 'MEDIO', null],
    ['personal_lab', 'repositorio', 'Pérdida de integridad de registros electrónicos GMP (ALCOA+)', 'MEDIA', 'ALTO', 'Audit trail, firma electrónica y revisión periódica de registros. Riesgo residual: MEDIO.'],
    ['personal_lab', 'equipos', 'Alteración de resultados en equipos de análisis sin control de acceso', 'ALTA', 'ALTO', null],
    ['logs', 'cpd', 'Borrado o manipulación de registros de actividad', 'BAJA', 'MEDIO', 'Logs enviados en tiempo real al SIEM con almacenamiento inmutable. Riesgo residual: BAJO.'],
    ['cuentas', 'ad', 'Cuentas de empleados dados de baja que siguen activas', 'MEDIA', 'MEDIO', 'Baja automatizada desde RR. HH. y revisión mensual. Riesgo residual: BAJO.'],
    ['cuentas', 'ad', 'Robo de credenciales mediante phishing', 'ALTA', 'ALTO', 'MFA obligatorio, filtrado de correo y simulacros de phishing. Riesgo residual: MEDIO.'],
    ['video', 'video', 'Conservación de imágenes más allá de un mes', 'BAJA', 'BAJO', 'Borrado automático a los 30 días. Riesgo residual: BAJO.'],
    ['nominas', 'erp', 'Envío de nóminas a destinatarios erróneos', 'MEDIA', 'MEDIO', 'Portal del empleado en lugar de envío por correo. Riesgo residual: BAJO.'],
    ['nominas', 'erp', 'Acceso indebido a datos salariales por perfiles no autorizados', 'BAJA', 'ALTO', 'Perfiles específicos del módulo de nóminas y registro de accesos. Riesgo residual: BAJO.'],
    ['proveedores', 'erp', 'Fraude del CEO o cambio fraudulento de cuenta bancaria de proveedor', 'MEDIA', 'ALTO', 'Verificación telefónica de cambios de IBAN y doble validación. Riesgo residual: MEDIO.'],
    ['clientes', 'erp', 'Conservación de datos de clientes inactivos más allá del plazo', 'MEDIA', 'BAJO', null],
    ['cobros', 'banca', 'Acceso no autorizado a la banca electrónica', 'BAJA', 'ALTO', 'Doble firma y certificados de firma en tarjeta criptográfica. Riesgo residual: BAJO.'],
  ];
  for (const [i, [a, s, amenaza, prob, imp, medidas]] of RIESGOS.entries()) {
    await prisma.riesgo.create({
      data: {
        actividad_id: act[a].id, sistema_id: s ? sis[s].id : null, amenaza, probabilidad: prob, impacto: imp,
        nivel_riesgo: calcularNivel(prob, imp), medidas_mitigadoras: medidas, created_at: hace(450 - i * 12), updated_at: hace(90 - i * 4),
      },
    });
  }

  // 10) Incidentes de seguridad y brechas, con su histórico de estados
  const incidente = async (d, historial) => {
    const inc = await prisma.incidente.create({ data: d });
    let anterior = 'ABIERTO';
    for (const [estado, dias, quien] of historial) {
      await prisma.historialIncidente.create({ data: { incidente_id: inc.id, estado_anterior: anterior, estado_nuevo: estado, usuario_id: quien.id, fecha: hace(dias, 11) } });
      anterior = estado;
    }
    return inc;
  };
  await incidente({
    titulo: 'Ransomware bloqueado en un puesto de trabajo de administración', tipo: 'DISPONIBILIDAD', gravedad: 'MEDIA', estado: 'CERRADO',
    descripcion: 'El EDR detectó y bloqueó la ejecución de un ransomware llegado por un adjunto de correo. El equipo se aisló y se reinstaló. No hubo cifrado de datos ni exfiltración.',
    fecha_deteccion: hace(240, 9, 40), fecha_ocurrencia: hace(240, 9, 25), categorias_datos_afectados: 'Ninguna (sin acceso a datos personales)', numero_afectados_estimado: 0,
    medidas_adoptadas: 'Aislamiento del equipo, reinstalación, bloqueo del remitente y del hash, campaña de concienciación.',
    requiere_notificacion_aepd: false, requiere_notificacion_afectados: false, responsable_id: u.seguridad.id, creado_por_id: u.sistemas.id, sistema_id: sis.cpd.id,
    created_at: hace(240, 9, 45), updated_at: hace(233),
  }, [['EN_INVESTIGACION', 240, u.seguridad], ['CONTENIDO', 239, u.seguridad], ['CERRADO', 233, u.seguridad]]);
  await incidente({
    titulo: 'Envío por error del listado de participantes de un ensayo a un tercero', tipo: 'CONFIDENCIALIDAD', gravedad: 'ALTA', estado: 'CERRADO',
    descripcion: 'Un técnico envió por correo un listado con códigos de participante, fechas de visita y datos de salud a un proveedor no autorizado. Brecha de confidencialidad con datos de categoría especial: alto riesgo para los interesados → notificación a la AEPD y a los afectados.',
    fecha_deteccion: hace(150, 16, 10), fecha_ocurrencia: hace(150, 12, 30), categorias_datos_afectados: 'Datos de salud seudonimizados y fechas de visita (categoría especial)', numero_afectados_estimado: 46,
    medidas_adoptadas: 'Solicitud de borrado y certificado de destrucción al destinatario, DLP en el correo para adjuntos con datos de salud, formación al equipo.',
    requiere_notificacion_aepd: true, fecha_notificacion_aepd: hace(148, 10, 0), requiere_notificacion_afectados: true, fecha_notificacion_afectados: hace(145, 12),
    responsable_id: u.dpd.id, creado_por_id: u.laboratorio.id, sistema_id: sis.lims.id, created_at: hace(150, 16, 20), updated_at: hace(120),
  }, [['EN_INVESTIGACION', 150, u.dpd], ['CONTENIDO', 149, u.dpd], ['NOTIFICADO', 148, u.dpd], ['CERRADO', 120, u.dpd]]);
  await incidente({
    titulo: 'Caída del LIMS por fallo de la cabina de almacenamiento', tipo: 'DISPONIBILIDAD', gravedad: 'ALTA', estado: 'CONTENIDO',
    descripcion: 'Indisponibilidad del LIMS durante 9 horas por fallo de una controladora de la cabina. Se activó el procedimiento de contingencia en papel para la liberación de lotes urgentes. Sin pérdida de datos personales.',
    fecha_deteccion: hace(18, 7, 50), fecha_ocurrencia: hace(18, 7, 30), categorias_datos_afectados: 'Ninguna afectada (indisponibilidad temporal sin pérdida de datos)', numero_afectados_estimado: 0,
    medidas_adoptadas: 'Sustitución de la controladora, restauración desde réplica, análisis de causa raíz en curso con el fabricante.',
    requiere_notificacion_aepd: false, requiere_notificacion_afectados: false, responsable_id: u.sistemas.id, creado_por_id: u.laboratorio.id, sistema_id: sis.lims.id,
    created_at: hace(18, 8), updated_at: hace(10),
  }, [['EN_INVESTIGACION', 18, u.sistemas], ['CONTENIDO', 17, u.sistemas]]);
  await incidente({
    titulo: 'Phishing con robo de credenciales de un usuario del área financiera', tipo: 'CONFIDENCIALIDAD', gravedad: 'ALTA', estado: 'EN_INVESTIGACION',
    descripcion: 'Un empleado introdujo sus credenciales en una página falsa. El atacante accedió a su buzón durante 2 horas antes del bloqueo; el buzón contenía nóminas y datos bancarios de proveedores. Se está determinando el alcance: probable riesgo para los interesados → notificación a la AEPD en preparación.',
    fecha_deteccion: new Date(AHORA.getTime() - 30 * 3600 * 1000), categorias_datos_afectados: 'Identificativos, económicos y bancarios de empleados y personas de contacto de proveedores', numero_afectados_estimado: 85,
    medidas_adoptadas: 'Bloqueo de la cuenta, cambio de contraseña, revisión de reglas de reenvío, análisis de los correos accedidos.',
    requiere_notificacion_aepd: true, requiere_notificacion_afectados: false, responsable_id: u.seguridad.id, creado_por_id: u.finanzas.id, sistema_id: sis.ad.id,
    created_at: new Date(AHORA.getTime() - 29 * 3600 * 1000), updated_at: new Date(AHORA.getTime() - 3 * 3600 * 1000),
  }, [['EN_INVESTIGACION', 1, u.seguridad]]);
  await incidente({
    titulo: 'Puerta del CPD abierta fuera de horario', tipo: 'CONFIDENCIALIDAD', gravedad: 'BAJA', estado: 'CERRADO',
    descripcion: 'La videovigilancia registró la puerta del CPD entreabierta durante 20 minutos por un fallo del cierre electromagnético. No hubo accesos.',
    fecha_deteccion: hace(330, 22, 5), categorias_datos_afectados: 'Ninguna', numero_afectados_estimado: 0,
    medidas_adoptadas: 'Reparación del cierre y alarma de puerta abierta conectada a la central de seguridad.',
    requiere_notificacion_aepd: false, requiere_notificacion_afectados: false, responsable_id: u.seguridad.id, creado_por_id: u.sistemas.id, sistema_id: sis.video.id,
    created_at: hace(330, 22, 10), updated_at: hace(325),
  }, [['EN_INVESTIGACION', 330, u.seguridad], ['CERRADO', 325, u.seguridad]]);

  // 11) Solicitudes de ejercicio de derechos en distintos estados
  const solicitud = async (d, historial) => {
    const fecha_limite = calcularFechaLimite(d.fecha_recepcion, d.plazo_ampliado || false);
    const s = await prisma.solicitudDerecho.create({ data: { ...d, fecha_limite } });
    let anterior = 'RECIBIDA';
    for (const [estado, dias, detalle] of historial) {
      await prisma.historialSolicitudDerecho.create({ data: { solicitud_id: s.id, estado_anterior: anterior, estado_nuevo: estado, detalle, usuario_id: u.dpd.id, fecha: hace(dias, 12) } });
      anterior = estado;
    }
  };
  await solicitud({ nombre_solicitante: 'Rosa Prieto Alonso', email_solicitante: 'rosa.prieto@correo.example', tipo_derecho: 'ACCESO', canal_entrada: 'EMAIL',
    descripcion: 'Antigua participante del ensayo LFI-0421 solicita copia de los datos clínicos que se conservan sobre ella.', fecha_recepcion: hace(200, 9),
    estado: 'ESTIMADA', respuesta_enviada: 'Se remite copia de los datos en formato PDF cifrado y se informa de los destinatarios y del plazo de conservación.', fecha_respuesta: hace(178, 13),
    responsable_id: u.dpd.id, creado_por_id: u.dpd.id, sistema_id: sis.lims.id, created_at: hace(200, 9, 30), updated_at: hace(178) },
    [['VERIFICACION_IDENTIDAD', 199], ['EN_TRAMITACION', 195], ['ESTIMADA', 178]]);
  await solicitud({ nombre_solicitante: 'Miguel Ángel Soto Ruiz', email_solicitante: 'masoto@correo.example', tipo_derecho: 'SUPRESION', canal_entrada: 'FORMULARIO_WEB',
    descripcion: 'Participante de un ensayo finalizado solicita la supresión de todos sus datos.', fecha_recepcion: hace(110, 10),
    estado: 'DENEGADA', motivo_denegacion: 'Los datos deben conservarse 25 años por obligación legal (art. 58 Reglamento (UE) 536/2014; art. 17.3.b y c RGPD). Se informa del derecho a reclamar ante la AEPD.',
    respuesta_enviada: 'Se deniega la supresión motivadamente y se limita el tratamiento a la conservación legal.', fecha_respuesta: hace(92, 12),
    responsable_id: u.dpd.id, creado_por_id: u.dpd.id, sistema_id: sis.lims.id, created_at: hace(110, 10, 30), updated_at: hace(92) },
    [['EN_TRAMITACION', 108], ['DENEGADA', 92]]);
  await solicitud({ nombre_solicitante: 'Ana Belén Cruz Medina', email_solicitante: 'abcruz@correo.example', tipo_derecho: 'OPOSICION', canal_entrada: 'EMAIL',
    descripcion: 'Cliente (farmacia) se opone al envío de comunicaciones comerciales a su contacto personal.', fecha_recepcion: hace(20, 11),
    estado: 'EN_TRAMITACION', responsable_id: u.finanzas.id, creado_por_id: u.dpd.id, sistema_id: sis.erp.id, created_at: hace(20, 11, 30), updated_at: hace(15) },
    [['EN_TRAMITACION', 15]]);
  await solicitud({ nombre_solicitante: 'Francisco Javier Moreno Díaz', email_solicitante: 'fjmoreno@correo.example', tipo_derecho: 'ACCESO', canal_entrada: 'CORREO_POSTAL',
    descripcion: 'Exempleado solicita acceso a sus datos de nómina y a los registros de acceso a su cuenta.', fecha_recepcion: hace(4, 9),
    estado: 'VERIFICACION_IDENTIDAD', responsable_id: u.dpd.id, creado_por_id: u.dpd.id, sistema_id: sis.erp.id, created_at: hace(4, 9, 30), updated_at: hace(3) },
    [['VERIFICACION_IDENTIDAD', 3, 'Se solicita copia del DNI']]);
  await solicitud({ nombre_solicitante: 'Isabel Gómez Herrera', email_solicitante: 'isagomez@correo.example', tipo_derecho: 'RECTIFICACION', canal_entrada: 'PRESENCIAL',
    descripcion: 'Empleada solicita rectificar su dirección postal y su número de cuenta para la nómina.', fecha_recepcion: hace(60, 10),
    estado: 'ESTIMADA', respuesta_enviada: 'Datos rectificados en el ERP y confirmados a la interesada.', fecha_respuesta: hace(57, 12),
    responsable_id: u.nominas.id, creado_por_id: u.nominas.id, sistema_id: sis.erp.id, created_at: hace(60, 10, 15), updated_at: hace(57) },
    [['EN_TRAMITACION', 59], ['ESTIMADA', 57]]);
  await solicitud({ nombre_solicitante: 'Tomás Llorente Vega', email_solicitante: 'tllorente@correo.example', tipo_derecho: 'ACCESO', canal_entrada: 'EMAIL',
    descripcion: 'Paciente que notificó una reacción adversa solicita copia de los datos registrados en farmacovigilancia.', fecha_recepcion: hace(24, 16),
    estado: 'EN_TRAMITACION', responsable_id: u.farmacovigilancia.id, creado_por_id: u.dpd.id, sistema_id: sis.lims.id, created_at: hace(24, 16, 30), updated_at: hace(20) },
    [['VERIFICACION_IDENTIDAD', 23], ['EN_TRAMITACION', 20]]);
  await solicitud({ nombre_solicitante: 'Nuria Castillo Pons', email_solicitante: 'ncastillo@correo.example', tipo_derecho: 'SUPRESION', canal_entrada: 'FORMULARIO_WEB',
    descripcion: 'Persona que se suscribió al boletín de la web solicita la supresión de sus datos de contacto.', fecha_recepcion: hace(8, 18),
    estado: 'RECIBIDA', responsable_id: null, creado_por_id: u.dpd.id, sistema_id: null, created_at: hace(8, 18, 30), updated_at: hace(8) }, []);

  // 12) Continuidad: procesos de negocio (BIA) y pruebas
  const PROCESOS = [
    { nombre: 'Fabricación y liberación de lotes', sistema: 'lims', depto: 'Área de laboratorio', criticidad: 'CRITICA', rto: 24, rpo: 4, estado: 'PLAN_DEFINIDO', resp: 'laboratorio', analisis: 150,
      eco: 'Parada de la línea: ~180.000 € al día y riesgo de desabastecimiento.', legal: 'Incumplimiento GMP; posible suspensión de la autorización por la AEMPS.', recursos: 'LIMS o procedimiento en papel validado, 2 técnicos QC, persona cualificada (QP).', estrategia: 'Réplica del LIMS en el CPD secundario y procedimiento de contingencia en papel.',
      pruebas: [[160, 'PRUEBA_COMPLETA', 'SATISFACTORIO', 'Restauración del LIMS en 14 h.'], [18, 'PRUEBA_PARCIAL', 'CON_INCIDENCIAS', 'Activación real durante la caída del LIMS: el procedimiento en papel funcionó; la réplica tardó más de lo previsto.']] },
    { nombre: 'Farmacovigilancia y notificación a la AEMPS', sistema: 'lims', depto: 'Área de laboratorio', criticidad: 'CRITICA', rto: 8, rpo: 1, estado: 'PLAN_DEFINIDO', resp: 'farmacovigilancia', analisis: 140,
      eco: 'Sanciones administrativas.', legal: 'Plazo legal de 15 días para reacciones graves (RD 577/2013).', recursos: 'Acceso a EudraVigilance, 1 persona de guardia.', estrategia: 'Notificación directa vía web de la EMA desde cualquier puesto.',
      pruebas: [[90, 'SIMULACRO_DOCUMENTAL', 'SATISFACTORIO', 'Simulacro de notificación en contingencia.']] },
    { nombre: 'Gestión de ensayos clínicos', sistema: 'repositorio', depto: 'Área de laboratorio', criticidad: 'ALTA', rto: 72, rpo: 24, estado: 'ANALIZADO', resp: 'laboratorio', analisis: 200,
      eco: 'Retrasos en hitos del ensayo y penalizaciones con el promotor.', legal: 'Obligaciones de trazabilidad del Reglamento 536/2014.', recursos: 'Repositorio documental y acceso de la CRO.', estrategia: 'Pendiente de definir el plan específico.',
      pruebas: [] },
    { nombre: 'Servicios TI corporativos (CPD)', sistema: 'cpd', depto: 'Área de informática', criticidad: 'CRITICA', rto: 12, rpo: 4, estado: 'PLAN_DEFINIDO', resp: 'sistemas', analisis: 420,
      eco: 'Parada general de la actividad.', legal: 'Incumplimiento de medidas ENS de continuidad.', recursos: 'CPD secundario, copias inmutables, 3 técnicos.', estrategia: 'Conmutación al CPD secundario y restauración desde copias.',
      pruebas: [[410, 'PRUEBA_COMPLETA', 'SATISFACTORIO', 'Conmutación completa en 10 h.']] },
    { nombre: 'Nóminas', sistema: 'erp', depto: 'Área financiera', criticidad: 'MEDIA', rto: 120, rpo: 24, estado: 'PLAN_DEFINIDO', resp: 'nominas', analisis: 300,
      eco: 'Retraso en el pago de salarios.', legal: 'Infracción laboral por impago.', recursos: 'Gestoría laboral externa.', estrategia: 'Elaboración de nóminas por la gestoría con los datos del mes anterior.',
      pruebas: [[280, 'SIMULACRO_DOCUMENTAL', 'SATISFACTORIO', null]] },
    { nombre: 'Pagos a proveedores y tesorería', sistema: 'banca', depto: 'Área financiera', criticidad: 'ALTA', rto: 48, rpo: 24, estado: 'REQUIERE_PLAN', resp: 'finanzas', analisis: 75,
      eco: 'Intereses de demora y bloqueo de suministros críticos.', legal: 'Ley de morosidad.', recursos: 'Acceso alternativo a la banca y firmantes autorizados.', estrategia: null,
      pruebas: [] },
  ];
  for (const [i, p] of PROCESOS.entries()) {
    const proc = await prisma.procesoNegocio.create({
      data: {
        nombre: p.nombre, sistema_id: sis[p.sistema].id, departamento_responsable: p.depto, criticidad: p.criticidad, rto_horas: p.rto, rpo_horas: p.rpo,
        impacto_economico: p.eco, impacto_legal_reputacional: p.legal, recursos_minimos_necesarios: p.recursos, estrategia_continuidad: p.estrategia,
        estado_revision: p.estado, responsable_id: u[p.resp].id, fecha_ultimo_analisis: hace(p.analisis), creado_por_id: u.seguridad.id,
        created_at: hace(p.analisis + 30), updated_at: hace(Math.max(5, p.analisis - 10 - i)),
      },
    });
    for (const [dias, tipo, resultado, obs] of p.pruebas) {
      await prisma.pruebaContinuidad.create({ data: { proceso_id: proc.id, fecha_prueba: hace(dias, 9), tipo_prueba: tipo, resultado, observaciones: obs, realizado_por_id: u[p.resp].id, created_at: hace(dias, 18) } });
    }
  }

  await ajustarSecuencias();
  return { admin, cuentas: Object.keys(USUARIOS).length };
}

main()
  .then(async ({ admin }) => {
    console.log('Datos de ejemplo cargados.');
    console.log(await contarTodo());
    console.log(`Acceso: ${admin.email} / admin1234 · plantilla ficticia: <nombre.apellido>@${DOMINIO} / ${CLAVE_EJEMPLO}`);
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
