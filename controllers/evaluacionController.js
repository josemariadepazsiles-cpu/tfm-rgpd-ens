// Evaluaciones ENS de un sistema: checklist de controles, cambios de estado, evidencias y
// responsables, y eliminación de evaluaciones.
const prisma = require('../lib/prisma');
// FALLO DETECTADO (menor): ID_MAXIMO se importa pero no se usa en este archivo.
const { esAdmin, idValido, idDeFormulario, ID_MAXIMO } = require('../lib/permisos');
const { guardarControl, crearFilasEvaluacion, resumenEvaluaciones } = require('../lib/evaluaciones');
const { CATEGORIAS, ESTADOS, esEstado } = require('../lib/ens');
const { LIMITES, excesos } = require('../lib/validacion');

// Dentro de una evaluación, el estado y la evidencia de un control solo los cambia el
// Administrador o el responsable del control (como en incidentes, derechos y BIA). Un control
// sin responsable puede asignárselo cualquier usuario; uno ya asignado solo lo reasigna el
// Administrador. Crear y eliminar evaluaciones es solo para el Administrador.
/**
 * @param {object} user
 * @param {object|null} fila Fila EvaluacionControl
 * @returns {boolean}
 */
const puedeGestionarControl = (user, fila) => esAdmin(user) || (!!fila && fila.responsable_id === user.id);

/**
 * Responde 403 explicando quién puede modificar el control.
 * @param {import('express').Response} res
 */
const sinPermiso = (res) =>
  res.status(403).render('error', {
    title: 'Acceso denegado',
    mensaje: 'Solo el Administrador o el responsable del control pueden modificarlo. Si no tiene responsable, pulsa «Asignarme».',
  });

/**
 * @param {import('express').Response} res
 */
const noEncontrada = (res) =>
  res.status(404).render('error', {
    title: 'Evaluación no encontrada',
    mensaje: 'La evaluación o el control no existen.',
  });

/**
 * @param {number|null} id
 * @returns {Promise<object|null>|null} Evaluación con su sistema
 */
const buscarEvaluacion = (id) =>
  id ? prisma.evaluacion.findUnique({ where: { id }, include: { sistema: true } }) : null;

// Evaluación + control + su fila en la evaluación. Un control que no forma parte de la
// evaluación (se añadió al catálogo después de cerrarla) no se encuentra
/**
 * @param {import('express').Request} req
 * @returns {Promise<{ evaluacion: object, control: object, fila: object }|null>}
 */
const buscarControl = async (req) => {
  const evaluacionId = idValido(req.params.id);
  const controlId = idValido(req.params.controlId);
  if (!evaluacionId || !controlId) return null;

  const [evaluacion, control, fila] = await Promise.all([
    buscarEvaluacion(evaluacionId),
    prisma.controlEns.findUnique({ where: { id: controlId } }),
    prisma.evaluacionControl.findUnique({
      where: { evaluacion_id_control_id: { evaluacion_id: evaluacionId, control_id: controlId } },
      include: { responsable: { select: { id: true, nombre: true } } },
    }),
  ]);
  if (!evaluacion || !control || !fila) return null;
  return { evaluacion, control, fila };
};

/**
 * Vuelve al checklist con el control a la vista (ancla #control-ID).
 * @param {import('express').Response} res
 * @param {number} evaluacionId
 * @param {number} controlId
 */
const volverAlControl = (res, evaluacionId, controlId) =>
  res.redirect(`/evaluaciones/${evaluacionId}#control-${controlId}`);

/**
 * @param {unknown} valor
 * @returns {string}
 */
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

// Solo administradores: crea una evaluación nueva para el sistema
/**
 * POST /sistemas/:id/evaluaciones · Administrador. Con «copiar», parte de los estados de la última evaluación del sistema.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const create = async (req, res) => {
  const sistemaId = idValido(req.params.id);
  const sistema = sistemaId && (await prisma.sistema.findUnique({ where: { id: sistemaId } }));
  if (!sistema) return noEncontrada(res);

  const nombre = texto(req.body.nombre);
  if (!nombre) {
    req.session.flash = { tipo: 'error', mensaje: 'El nombre de la evaluación es obligatorio.' };
    return res.redirect(`/sistemas/${sistema.id}#ens`);
  }

  const anterior =
    req.body.copiar === 'on'
      ? await prisma.evaluacion.findFirst({
          where: { sistema_id: sistema.id },
          orderBy: { created_at: 'desc' },
          include: { controles: true },
        })
      : null;

  const evaluacion = await prisma.$transaction(async (tx) => {
    const nueva = await tx.evaluacion.create({
      data: { sistema_id: sistema.id, nombre, creado_por_id: req.user.id },
    });
    // Foto del catálogo actual; si se copia, parte de los estados de la evaluación anterior
    // (el histórico empieza de cero)
    await crearFilasEvaluacion(tx, nueva.id, anterior ? anterior.controles : []);
    return nueva;
  });

  req.session.flash = {
    tipo: 'exito',
    mensaje: `Evaluación "${evaluacion.nombre}" creada${anterior ? ` a partir de "${anterior.nombre}"` : ''}.`,
  };
  res.redirect(`/evaluaciones/${evaluacion.id}`);
};

// Checklist de la evaluación: sus controles agrupados por categoría
/**
 * GET /evaluaciones/:id · con sesión. Cada control indica si el usuario puede gestionarlo.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const show = async (req, res) => {
  const evaluacion = await buscarEvaluacion(idValido(req.params.id));
  if (!evaluacion) return noEncontrada(res);

  const [filas, resumenes] = await Promise.all([
    prisma.evaluacionControl.findMany({
      where: { evaluacion_id: evaluacion.id },
      orderBy: [{ control: { categoria: 'asc' } }, { control: { nombre: 'asc' } }],
      include: {
        control: true,
        responsable: { select: { id: true, nombre: true } },
        historial: {
          orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
          take: 1,
          include: { usuario: { select: { nombre: true } } },
        },
      },
    }),
    resumenEvaluaciones([evaluacion.id]),
  ]);

  const resumen = resumenes.get(evaluacion.id);
  const grupos = resumen.map((r) => ({
    ...r,
    controles: filas
      .filter((f) => f.control.categoria === r.categoria)
      .map((f) => ({
        ...f.control,
        estado: f.estado,
        evidencia: f.evidencia,
        responsable: f.responsable,
        fecha_revision: f.fecha_revision,
        ultimoCambio: f.historial[0] || null,
        gestionable: puedeGestionarControl(req.user, f),
      })),
  }));

  const otras = await prisma.evaluacion.findMany({
    where: { sistema_id: evaluacion.sistema_id },
    orderBy: { created_at: 'desc' },
    select: { id: true, nombre: true },
  });

  res.render('evaluaciones/show', {
    title: `${evaluacion.sistema.nombre} · ${evaluacion.nombre}`,
    evaluacion,
    grupos,
    otras,
    categorias: CATEGORIAS,
    estados: ESTADOS,
  });
};

// Cambio de estado directo desde el checklist
/**
 * POST /evaluaciones/:id/controles/:controlId/estado · Administrador o responsable del control.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const cambiarEstado = async (req, res) => {
  const encontrado = await buscarControl(req);
  if (!encontrado) return noEncontrada(res);
  const { evaluacion, control, fila } = encontrado;
  if (!puedeGestionarControl(req.user, fila)) return sinPermiso(res);

  if (!esEstado(req.body.estado)) {
    req.session.flash = { tipo: 'error', mensaje: 'El estado no es válido.' };
    return volverAlControl(res, evaluacion.id, control.id);
  }

  const { estadoCambiado, anterior } = await guardarControl(
    evaluacion.id, control.id, { estado: req.body.estado }, req.user.id
  );
  if (estadoCambiado) {
    req.session.flash = {
      tipo: 'exito',
      mensaje: `"${control.nombre}": ${ESTADOS[anterior]} → ${ESTADOS[req.body.estado]}.`,
    };
  }
  volverAlControl(res, evaluacion.id, control.id);
};

/**
 * POST /evaluaciones/:id/controles/:controlId/asignarme · con sesión; solo si el control no tiene responsable (el Administrador, siempre).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const asignarme = async (req, res) => {
  const encontrado = await buscarControl(req);
  if (!encontrado) return noEncontrada(res);
  const { evaluacion, control, fila } = encontrado;
  // Un control ya asignado a otra persona solo lo reasigna el Administrador
  if (fila.responsable_id && fila.responsable_id !== req.user.id && !esAdmin(req.user)) {
    req.session.flash = { tipo: 'error', mensaje: `"${control.nombre}" ya tiene responsable. Solo el Administrador puede reasignarlo.` };
    return volverAlControl(res, evaluacion.id, control.id);
  }

  await guardarControl(evaluacion.id, control.id, { responsable_id: req.user.id }, req.user.id);
  req.session.flash = { tipo: 'exito', mensaje: `Ahora eres responsable de "${control.nombre}".` };
  volverAlControl(res, evaluacion.id, control.id);
};

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {{ evaluacion: object, control: object, valores: object, errores?: string[], status?: number }} opciones
 */
const renderFormulario = async (req, res, { evaluacion, control, valores, errores = [], status = 200 }) => {
  const usuarios = esAdmin(req.user)
    ? await prisma.usuario.findMany({ select: { id: true, nombre: true, cargo: true }, orderBy: { nombre: 'asc' } })
    : [];
  res.status(status).render('evaluaciones/control-form', {
    title: `Editar · ${control.nombre}`,
    evaluacion,
    control,
    valores,
    errores,
    usuarios,
    categorias: CATEGORIAS,
    estados: ESTADOS,
  });
};

/**
 * GET /evaluaciones/:id/controles/:controlId/editar · Administrador o responsable del control.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const editControlForm = async (req, res) => {
  const encontrado = await buscarControl(req);
  if (!encontrado) return noEncontrada(res);
  const { evaluacion, control, fila } = encontrado;
  if (!puedeGestionarControl(req.user, fila)) return sinPermiso(res);

  renderFormulario(req, res, {
    evaluacion,
    control,
    valores: {
      estado: fila ? fila.estado : 'PENDIENTE',
      evidencia: fila ? fila.evidencia : null,
      responsable_id: fila ? fila.responsable_id : null,
      responsable: fila ? fila.responsable : null,
      fecha_revision: fila ? fila.fecha_revision : null,
    },
  });
};

/**
 * POST /evaluaciones/:id/controles/:controlId · Administrador o responsable. Solo el Administrador asigna a otras personas; el responsable puede liberarse desmarcando «Soy el responsable».
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateControl = async (req, res) => {
  const encontrado = await buscarControl(req);
  if (!encontrado) return noEncontrada(res);
  const { evaluacion, control, fila } = encontrado;
  const { body, user } = req;
  if (!puedeGestionarControl(user, fila)) return sinPermiso(res);

  const cambios = { estado: body.estado, evidencia: texto(body.evidencia) || null };
  const errores = excesos(body, LIMITES.evidencia);
  if (!esEstado(cambios.estado)) errores.push('El estado no es válido.');

  const responsableActual = fila ? fila.responsable_id : null;
  if (esAdmin(user)) {
    cambios.responsable_id = idDeFormulario(body.responsable_id);
    if (cambios.responsable_id !== null) {
      const existe =
        Number.isInteger(cambios.responsable_id) &&
        (await prisma.usuario.findUnique({ where: { id: cambios.responsable_id } }));
      if (!existe) errores.push('El responsable no es válido.');
    }
  } else if (body.asignarme === 'on') {
    cambios.responsable_id = user.id;
  } else if (responsableActual === user.id) {
    // Un usuario solo puede liberar la responsabilidad si era suya
    cambios.responsable_id = null;
  }

  if (errores.length) {
    return renderFormulario(req, res, {
      evaluacion,
      control,
      valores: { ...cambios, responsable: fila ? fila.responsable : null, fecha_revision: fila ? fila.fecha_revision : null },
      errores,
      status: 400,
    });
  }

  await guardarControl(evaluacion.id, control.id, cambios, user.id);
  req.session.flash = { tipo: 'exito', mensaje: `Control "${control.nombre}" actualizado.` };
  volverAlControl(res, evaluacion.id, control.id);
};

// Solo administradores. Borra también su histórico
/**
 * POST /evaluaciones/:id/eliminar · Administrador.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const remove = async (req, res) => {
  const evaluacion = await buscarEvaluacion(idValido(req.params.id));
  if (!evaluacion) return noEncontrada(res);

  // Si se borra la última evaluación, la anterior vuelve a ser la vigente, pero su foto no incluye
  // los controles añadidos al catálogo después de crearla (para tenerlos, hay que crear otra).
  await prisma.evaluacion.delete({ where: { id: evaluacion.id } });
  req.session.flash = { tipo: 'exito', mensaje: `Evaluación "${evaluacion.nombre}" eliminada.` };
  res.redirect(`/sistemas/${evaluacion.sistema_id}#ens`);
};

module.exports = { create, show, cambiarEstado, asignarme, editControlForm, updateControl, remove };
