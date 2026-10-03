// Datos de las páginas legales (aviso legal, privacidad y cookies), en un único sitio para poder
// cambiarlos sin tocar las vistas. TODOS LOS DATOS SON FICTICIOS: la aplicación es un proyecto
// académico (Trabajo Fin de Máster). Son coherentes con la empresa de los datos de ejemplo
// (prisma/seed-ejemplo.js) y usan el dominio reservado .example.

// Fecha de la última actualización de los textos legales (AAAA-MM-DD)
const FECHA_ACTUALIZACION = '2026-10-03';

// Proyecto académico al que pertenece la web
const PROYECTO = {
  tipo: 'Trabajo Fin de Máster',
  autor: 'José María de Paz Siles',
  aviso: 'Datos ficticios — proyecto académico',
};

// Titular del sitio web y responsable del tratamiento (art. 10 LSSI-CE y art. 13 RGPD)
const TITULAR = {
  razon_social: 'Laboratorios Farmacéuticos Reunidos, S.A.',
  nombre_comercial: 'Laboratorios Farmacéuticos Reunidos',
  nif: 'A87654321',
  domicilio: 'Avenida de la Innovación 14, Parque Tecnológico',
  codigo_postal: '28760',
  localidad: 'Tres Cantos',
  provincia: 'Madrid',
  pais: 'España',
  email: 'info@labfarmareunidos.example',
  telefono: '910 000 000',
  web: 'https://www.labfarmareunidos.example',
  registro_mercantil: 'Registro Mercantil de Madrid, tomo 41.207, folio 118, sección 8.ª, hoja M-731542, inscripción 1.ª',
  actividad: 'Industria farmacéutica',
};

// Delegado de Protección de Datos (art. 37 RGPD y art. 34 LOPDGDD)
const DPD = {
  nombre: 'Javier Ortega Llamas',
  email: 'dpd@labfarmareunidos.example',
  direccion: 'Avenida de la Innovación 14, Parque Tecnológico, 28760 Tres Cantos (Madrid)',
};

// Encargados del tratamiento y terceros que reciben datos (según el código de la aplicación)
const ENCARGADOS = [
  {
    nombre: 'Neon, Inc.',
    servicio: 'Alojamiento de la base de datos PostgreSQL (Neon)',
    datos: 'Todos los datos que guarda la aplicación',
    ubicacion: 'Servidores de Amazon Web Services en la región eu-west-2 (Londres, Reino Unido); empresa con sede en Estados Unidos',
  },
  {
    nombre: 'jsDelivr (CDN público)',
    servicio: 'Entrega de la librería Alpine.js que usa la interfaz',
    datos: 'Dirección IP y datos técnicos del navegador al descargar el archivo (no instala cookies)',
    ubicacion: 'Red de distribución mundial (servidores también fuera del Espacio Económico Europeo)',
  },
];

// Entorno en el que se ejecuta la aplicación
const ALOJAMIENTO_APP = 'Entorno de demostración del proyecto académico: el servidor de la aplicación no está publicado en ningún proveedor de alojamiento.';

// Plazos de conservación (los plazos fijos los marca el código; el resto son ficticios)
const CONSERVACION = [
  ['Cuentas de usuario', 'Mientras la persona trabaje en la organización. Al dejar de hacerlo, la cuenta se desactiva (no se borra) y se conserva bloqueada 5 años como registro de auditoría de las actuaciones que constan a su nombre.'],
  ['Solicitudes de ejercicio de derechos y sus documentos', 'Hasta su resolución y, después, 3 años bloqueadas para atender posibles reclamaciones (plazo de prescripción de las infracciones muy graves, art. 72 LOPDGDD).'],
  ['Incidentes y brechas de seguridad', 'Se conservan como documentación obligatoria de las brechas (art. 33.5 RGPD); la aplicación no permite eliminarlos.'],
  ['Datos de contacto de proveedores', 'Mientras dure la relación con el proveedor y 5 años después de su baja.'],
  ['Registro de aceptación de políticas', 'Mientras la política esté vigente y 5 años después de quedar obsoleta, como evidencia para auditorías del ENS.'],
  ['Sesión iniciada', '8 horas desde el inicio de sesión (o hasta cerrar sesión).'],
  ['Registro de intentos fallidos de inicio de sesión', '15 minutos, solo en la memoria del servidor.'],
];

// Cookies y almacenamiento local que usa realmente la aplicación (revisado en el código:
// app.js, middlewares/seguridad.js y views/partials/head.ejs)
const COOKIES = [
  {
    nombre: 'sid',
    titular: 'Propia',
    finalidad: 'Mantener la sesión iniciada. Guarda solo un identificador aleatorio y firmado; los datos de la sesión (usuario, token antifalsificación de formularios y avisos) se guardan en el servidor.',
    tipo: 'Técnica, necesaria (cookie HTTP con HttpOnly y SameSite=Lax; además Secure cuando la web funciona por HTTPS)',
    duracion: '8 horas desde el inicio de sesión. Se crea al iniciar sesión y se borra al cerrarla.',
  },
  {
    nombre: 'compliance-ai:plegables-abiertos',
    titular: 'Propia',
    finalidad: 'Recordar qué secciones del panel de control has dejado desplegadas.',
    tipo: 'Técnica de personalización de la interfaz elegida por el usuario (almacenamiento local del navegador, no es una cookie HTTP y no se envía al servidor)',
    duracion: 'Persistente hasta que borres los datos del sitio en el navegador.',
  },
];

module.exports = { FECHA_ACTUALIZACION, PROYECTO, TITULAR, DPD, ENCARGADOS, ALOJAMIENTO_APP, CONSERVACION, COOKIES };
