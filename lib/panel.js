// Panel de control por sistema de información. Una sola ronda de consultas agregadas (en
// paralelo) calcula los datos de TODOS los sistemas a la vez —sin consultas por sistema (N+1)—;
// la vista de un sistema concreto y la vista «Todos los sistemas» salen del mismo resultado.
//
// Consultas: sistemas (+ su última evaluación), resumen de esas evaluaciones, conteos RGPD
// agrupados por sistema, última declaración emitida por sistema, procesos BIA con su última
// prueba, y los registros en alerta (notificaciones AEPD pendientes, solicitudes de derechos
// vencidas o próximas, políticas con revisión vencida o próxima).
const prisma = require('./prisma');
const { esAdmin } = require('./permisos');
const { resumenEvaluaciones } = require('./evaluaciones');
const { resumenGlobal } = require('./ens');
const { PLAZO_AEPD_HORAS } = require('./incidentes');
const { TIPOS_DERECHO, ESTADOS_RESUELTOS, DIAS_AVISO, urgencia } = require('./derechos');
const { pendientesDeRevision } = require('./politicas');
const { CRITICIDADES, CRITICIDADES_ALTAS, inicioVentanaPruebas } = require('./bia');
const { SIN_SISTEMA, resumenRgpdPorSistema } = require('./sistemas');

const DIA = 24 * 3600 * 1000;
const HORA = 3600 * 1000;
// Una prueba de continuidad «caduca» a los 12 meses; se avisa en los 30 días anteriores
const DIAS_AVISO_PRUEBA = 30;
const MESES_DECLARACION = 12;
const ORDEN_CRITICIDAD = Object.keys(CRITICIDADES); // BAJA < MEDIA < ALTA < CRITICA

const haceMeses = (meses, ahora) => {
  const d = new Date(ahora);
  d.setMonth(d.getMonth() - meses);
  return d;
};
const clave = (sistemaId) => sistemaId ?? SIN_SISTEMA;

// Alerta: `critico` (plazo vencido, en rojo) o `atencion` (próximo a vencer, en ámbar).
// `vence`: fecha límite del plazo (para mostrar el próximo vencimiento)
const alerta = (nivel, modulo, icono, titulo, detalle, href, vence = null) => ({ nivel, modulo, icono, titulo, detalle, href, vence });
const masMeses = (fecha, meses) => { const d = new Date(fecha); d.setMonth(d.getMonth() + meses); return d; };
const ordenarAlertas = (lista) =>
  lista.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'critico' ? -1 : 1));

const panelSistemas = async (user, ahora = new Date()) => {
  const limiteAepd = new Date(ahora.getTime() - PLAZO_AEPD_HORAS * HORA);
  const [sistemas, rgpd, declaraciones, procesos, aepd, solicitudes, revisiones] = await Promise.all([
    prisma.sistema.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true, nombre: true, tipo_sistema: true, categoria_general: true,
        evaluaciones: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true, nombre: true } },
      },
    }),
    resumenRgpdPorSistema(user),
    prisma.$queryRaw`
      SELECT "sistema_id", max("fecha_emision") AS emitida
      FROM "declaraciones_conformidad" WHERE "estado" = 'EMITIDA'
      GROUP BY "sistema_id"`,
    prisma.$queryRaw`
      SELECT p."id", p."nombre", p."sistema_id", p."criticidad"::text AS criticidad,
             p."estado_revision"::text AS estado_revision, max(t."fecha_prueba") AS ultima
      FROM "procesos_negocio" p
      LEFT JOIN "pruebas_continuidad" t ON t."proceso_id" = p."id"
      GROUP BY p."id"`,
    prisma.incidente.findMany({
      where: { requiere_notificacion_aepd: true, fecha_notificacion_aepd: null },
      select: { id: true, titulo: true, fecha_deteccion: true, sistema_id: true },
      orderBy: { fecha_deteccion: 'asc' },
    }),
    // Abiertas que vencen en los próximos días de aviso (o ya vencidas)
    prisma.solicitudDerecho.findMany({
      where: { estado: { notIn: ESTADOS_RESUELTOS }, fecha_limite: { lte: new Date(ahora.getTime() + (DIAS_AVISO + 1) * DIA) } },
      select: { id: true, nombre_solicitante: true, tipo_derecho: true, fecha_limite: true, estado: true, sistema_id: true },
      orderBy: { fecha_limite: 'asc' },
    }),
    pendientesDeRevision(ahora),
  ]);

  const resumenes = await resumenEvaluaciones(sistemas.flatMap((s) => s.evaluaciones.map((e) => e.id)));

  // ---- Alertas, agrupadas por sistema (clave SIN_SISTEMA para lo transversal) ----
  const alertas = new Map();
  const anadir = (sistemaId, a) => {
    const k = clave(sistemaId);
    if (!alertas.has(k)) alertas.set(k, []);
    alertas.get(k).push(a);
  };

  aepd.forEach((i) => {
    const vencida = i.fecha_deteccion <= limiteAepd;
    const venceAepd = new Date(i.fecha_deteccion.getTime() + PLAZO_AEPD_HORAS * HORA);
    const horas = Math.abs(Math.round((i.fecha_deteccion.getTime() + PLAZO_AEPD_HORAS * HORA - ahora.getTime()) / HORA));
    anadir(i.sistema_id, vencida
      ? alerta('critico', 'Incidentes', 'siren', 'Plazo de notificación a la AEPD vencido', `${i.titulo} · vencido hace ${horas} h (art. 33)`, `/incidentes/${i.id}`, venceAepd)
      : alerta('atencion', 'Incidentes', 'siren', 'Notificación a la AEPD pendiente', `${i.titulo} · quedan ${horas} h de las 72 h`, `/incidentes/${i.id}`, venceAepd));
  });

  solicitudes.forEach((s) => {
    const u = urgencia(s, ahora);
    const texto = `${TIPOS_DERECHO[s.tipo_derecho]} · ${s.nombre_solicitante}`;
    if (u.nivel === 'rojo') {
      anadir(s.sistema_id, alerta('critico', 'Derechos', 'users', 'Solicitud de derechos fuera de plazo', `${texto} · vencida hace ${u.diasVencida} día(s)`, `/derechos/${s.id}`, s.fecha_limite));
    } else if (u.nivel === 'amarillo') {
      anadir(s.sistema_id, alerta('atencion', 'Derechos', 'users', 'Solicitud de derechos próxima a vencer', `${texto} · ${u.dias === 0 ? 'vence hoy' : `vence en ${u.dias} día(s)`}`, `/derechos/${s.id}`, s.fecha_limite));
    }
  });

  // Continuidad: procesos de criticidad alta o crítica con la prueba caducada o a punto de caducar
  const caducaAntesDe = inicioVentanaPruebas(ahora);
  const avisoAntesDe = inicioVentanaPruebas(new Date(ahora.getTime() + DIAS_AVISO_PRUEBA * DIA));
  procesos.forEach((p) => {
    if (!CRITICIDADES_ALTAS.includes(p.criticidad)) return;
    const texto = `${p.nombre} · criticidad ${CRITICIDADES[p.criticidad].toLowerCase()}`;
    if (!p.ultima || p.ultima < caducaAntesDe) {
      anadir(p.sistema_id, alerta('critico', 'Continuidad', 'life-buoy',
        p.ultima ? 'Prueba de continuidad caducada' : 'Proceso crítico sin prueba de continuidad',
        p.ultima ? `${texto} · última prueba hace más de 12 meses` : `${texto} · nunca se ha probado`, `/bia/${p.id}#pruebas`, p.ultima ? masMeses(p.ultima, 12) : null));
    } else if (p.ultima < avisoAntesDe) {
      anadir(p.sistema_id, alerta('atencion', 'Continuidad', 'life-buoy', 'Prueba de continuidad próxima a caducar', `${texto} · la última prueba cumple 12 meses en menos de ${DIAS_AVISO_PRUEBA} días`, `/bia/${p.id}#pruebas`, masMeses(p.ultima, 12)));
    }
  });

  // Políticas: en su sistema o, si son generales, transversales. Un Usuario solo ve las aprobadas.
  revisiones
    .filter((p) => esAdmin(user) || p.estado === 'APROBADA')
    .forEach((p) => anadir(p.sistema_id, p.alerta.nivel === 'vencida'
      ? alerta('critico', 'Políticas', 'book-open-check', 'Revisión de política vencida', `${p.titulo} · ${p.alerta.texto.toLowerCase()}`, `/politicas/${p.id}`, p.fecha_proxima_revision)
      : alerta('atencion', 'Políticas', 'book-open-check', 'Revisión de política próxima', `${p.titulo} · ${p.alerta.texto.toLowerCase()}`, `/politicas/${p.id}`, p.fecha_proxima_revision)));

  // ---- Continuidad (BIA) por sistema ----
  const resumenBia = (lista) => {
    const criticidadMax = lista.reduce((max, p) => (ORDEN_CRITICIDAD.indexOf(p.criticidad) > ORDEN_CRITICIDAD.indexOf(max) ? p.criticidad : max), null);
    const conPlan = lista.filter((p) => p.estado_revision === 'PLAN_DEFINIDO').length;
    const altos = lista.filter((p) => CRITICIDADES_ALTAS.includes(p.criticidad));
    return {
      procesos: lista.length,
      criticidadMax,
      conPlan,
      sinPlan: lista.length - conPlan,
      altosSinPlan: altos.filter((p) => p.estado_revision !== 'PLAN_DEFINIDO').length,
    };
  };
  const procesosDe = new Map();
  procesos.forEach((p) => {
    const k = clave(p.sistema_id);
    if (!procesosDe.has(k)) procesosDe.set(k, []);
    procesosDe.get(k).push(p);
  });

  // ---- Vista de cada sistema ----
  const caducaDeclaracion = haceMeses(MESES_DECLARACION, ahora);
  const emitidas = new Map(declaraciones.filter((d) => d.sistema_id !== null).map((d) => [d.sistema_id, d.emitida]));
  const vistas = sistemas.map((s) => {
    const ultima = s.evaluaciones[0] || null;
    const global = ultima ? resumenGlobal(resumenes.get(ultima.id)) : null;
    const emitida = emitidas.get(s.id) || null;
    return {
      id: s.id,
      nombre: s.nombre,
      tipo: s.tipo_sistema,
      categoria: s.categoria_general,
      ens: { global, porcentaje: global ? global.porcentaje : null, ultima },
      declaracion: { emitida, estado: !emitida ? 'ninguna' : emitida < caducaDeclaracion ? 'caducada' : 'vigente' },
      rgpd: rgpd.de(s.id),
      bia: resumenBia(procesosDe.get(s.id) || []),
      // Cada alerta lleva el sistema al que pertenece (se muestra en «Acciones pendientes»)
      alertas: ordenarAlertas((alertas.get(s.id) || []).map((a) => ({ ...a, sistema: { id: s.id, nombre: s.nombre } }))),
    };
  });

  // ---- Información transversal (sin sistema) ----
  const transversal = {
    rgpd: rgpd.de(null),
    bia: resumenBia(procesosDe.get(SIN_SISTEMA) || []),
    alertas: ordenarAlertas((alertas.get(SIN_SISTEMA) || []).map((a) => ({ ...a, transversal: true }))),
  };

  // ---- Vista «Todos los sistemas»: todos los sistemas + lo transversal ----
  const sumar = (listas) => listas.reduce((acc, r) => {
    Object.entries(r).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
    return acc;
  }, {});
  const evaluados = vistas.filter((v) => v.ens.global);
  const ensMedio = evaluados.length ? Math.round(evaluados.reduce((a, v) => a + v.ens.porcentaje, 0) / evaluados.length) : null;
  const todas = ordenarAlertas([...vistas.flatMap((v) => v.alertas), ...transversal.alertas]);
  const todos = {
    id: null,
    nombre: 'Todos los sistemas',
    ens: { porcentaje: ensMedio, evaluados: evaluados.length, sinEvaluar: vistas.length - evaluados.length, total: vistas.length },
    declaracion: {
      vigentes: vistas.filter((v) => v.declaracion.estado === 'vigente').length,
      caducadas: vistas.filter((v) => v.declaracion.estado === 'caducada').length,
      ninguna: vistas.filter((v) => v.declaracion.estado === 'ninguna').length,
    },
    rgpd: sumar([...vistas.map((v) => v.rgpd), transversal.rgpd]),
    bia: resumenBia(procesos),
    alertas: todas,
  };

  return {
    generado: ahora,
    // Cabecera: visión global de toda la organización (no depende del sistema elegido)
    global: {
      sistemas: vistas.length,
      evaluados: evaluados.length,
      ensMedio,
      incidentesAbiertos: todos.rgpd.incidentesActivos || 0,
      alertas: todas.length,
      alertasVencidas: todas.filter((a) => a.nivel === 'critico').length,
      alertasProximas: todas.filter((a) => a.nivel === 'atencion').length,
    },
    sistemas: vistas,
    todos,
    transversal,
    // Comparativa ENS: primero los sistemas sin evaluar, después de menor a mayor cumplimiento
    comparativa: [...vistas].sort((a, b) => (a.ens.porcentaje ?? -1) - (b.ens.porcentaje ?? -1) || a.nombre.localeCompare(b.nombre, 'es')),
  };
};

module.exports = { panelSistemas, DIAS_AVISO_PRUEBA, MESES_DECLARACION };
