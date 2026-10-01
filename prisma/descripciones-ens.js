// Descripciones de las medidas de seguridad del Anexo II del Esquema Nacional de Seguridad
// (Real Decreto 311/2022), redactadas para la aplicación (no son el texto literal del BOE).
// Se identifican por el código con el que empieza el nombre del control: "op.acc.1 …".
const DESCRIPCIONES = {
  // --- Marco organizativo ---
  'org.1': 'Documento aprobado por la dirección que fija los objetivos de seguridad de la organización, el marco legal aplicable, los roles y responsabilidades (incluido el comité de seguridad) y cómo se resuelven los conflictos entre ellos. Debe difundirse a todo el personal y revisarse periódicamente.',
  'org.2': 'Conjunto de normas internas de obligado cumplimiento que concretan la política: uso correcto de equipos, servicios e información, lo que se considera uso indebido y las consecuencias de incumplirlo. Todo el personal debe conocerla.',
  'org.3': 'Procedimientos escritos que describen cómo realizar las tareas habituales de forma segura, quién debe hacerlas y cómo detectar y comunicar comportamientos anómalos. Traducen la normativa en instrucciones operativas.',
  'org.4': 'Mecanismo formal de autorización previa para incorporar al sistema nuevas instalaciones, equipos, aplicaciones, medios de comunicación o soportes, y para su uso en entornos o con fines distintos de los habituales.',
  // --- Marco operacional: planificación ---
  'op.pl.1': 'Análisis de riesgos que identifica los activos, las amenazas y las salvaguardas existentes y estima el riesgo residual. Su formalidad crece con la categoría del sistema y debe repetirse cuando cambie el sistema o el contexto.',
  'op.pl.2': 'Documentación de la arquitectura de seguridad del sistema: instalaciones, componentes, puntos de interconexión y líneas de defensa, de modo que se entienda cómo se protege la información de extremo a extremo.',
  'op.pl.3': 'Proceso para planificar la adquisición de nuevos componentes que tenga en cuenta las conclusiones del análisis de riesgos, la arquitectura de seguridad y las necesidades técnicas, formativas y de financiación.',
  'op.pl.4': 'Estudio previo a la puesta en servicio, y revisión durante la explotación, de las necesidades de procesamiento, almacenamiento, comunicaciones, personal e instalaciones para que el sistema mantenga su capacidad.',
  // --- Marco operacional: control de acceso ---
  'op.acc.1': 'Cada usuario, proceso o entidad que accede al sistema debe tener un identificador único y personal que permita saber quién hace qué. Las cuentas se gestionan durante todo su ciclo de vida y se inhabilitan al dejar de ser necesarias.',
  'op.acc.2': 'Los recursos del sistema se protegen con mecanismos que impiden su uso salvo a quienes tienen derechos suficientes. Los permisos de acceso se asignan según la necesidad de conocer y el mínimo privilegio.',
  'op.acc.3': 'Las funciones críticas se reparten entre personas distintas para que nadie pueda realizar en solitario acciones que comprometan la seguridad, como autorizar y ejecutar una misma operación o administrar y auditar.',
  'op.acc.4': 'Procedimiento para conceder, revisar periódicamente y retirar los derechos de acceso, de forma que cada usuario tenga solo los privilegios imprescindibles para su función y estos se actualicen ante cambios de puesto o bajas.',
  'op.acc.5': 'Mecanismos de autenticación para usuarios ajenos a la organización (ciudadanos, clientes, proveedores) proporcionales a la categoría del sistema, incluido el uso de varios factores cuando el nivel de seguridad lo exija.',
  'op.acc.6': 'Mecanismos de autenticación para el personal propio, más exigentes en accesos remotos y con privilegios. Incluye la gestión segura de credenciales y, según el nivel, la autenticación multifactor.',
  // --- Marco operacional: explotación ---
  'op.exp.1': 'Inventario actualizado de todos los elementos del sistema (equipos, aplicaciones, comunicaciones, soportes) con su responsable y ubicación. Es la base para saber qué hay que proteger.',
  'op.exp.2': 'Configuración segura de los equipos antes de su puesta en producción: eliminar cuentas y funciones innecesarias, cambiar contraseñas por defecto y aplicar el principio de mínima funcionalidad.',
  'op.exp.4': 'Mantenimiento de equipos y software según las especificaciones del fabricante y aplicación controlada de parches y actualizaciones de seguridad, evaluando antes su urgencia y su impacto.',
  'op.exp.6': 'Protección de equipos y servidores frente a virus, ransomware y otro software malicioso mediante herramientas de detección y respuesta actualizadas y de forma continua.',
  'op.exp.7': 'Proceso integral para detectar, registrar, clasificar, contener y resolver incidentes de seguridad, con su seguimiento y las lecciones aprendidas. Incluye la notificación a las autoridades competentes cuando proceda.',
  'op.exp.8': 'Registro de las actividades de los usuarios en el sistema con la información necesaria para saber quién, qué, cuándo y sobre qué actuó, protegido frente a modificaciones y conservado el tiempo establecido.',
  'op.exp.10': 'Protección de las claves criptográficas durante todo su ciclo de vida: generación, distribución, uso, almacenamiento, custodia, renovación y destrucción, de forma proporcional al nivel requerido.',
  // --- Marco operacional: servicios externos y en la nube ---
  'op.ext.1': 'Antes de contratar un servicio externo se establecen por contrato sus características, las responsabilidades de cada parte y el nivel de servicio y de seguridad exigido, así como las consecuencias de incumplirlo.',
  'op.nub.1': 'Los servicios en la nube que use el sistema deben cumplir medidas de seguridad acordes con su categoría, preferentemente acreditadas (certificación de conformidad con el ENS) y con una configuración segura.',
  // --- Marco operacional: continuidad del servicio ---
  'op.cont.1': 'Análisis de impacto que identifica los servicios esenciales, los requisitos de disponibilidad de cada uno y los elementos críticos de los que dependen, para dimensionar las medidas de continuidad.',
  'op.cont.2': 'Plan de continuidad que define las funciones y responsabilidades, los medios alternativos y las acciones para restablecer los servicios dentro de los plazos fijados tras una interrupción grave.',
  'op.cont.3': 'Realización periódica de pruebas del plan de continuidad para localizar fallos y deficiencias, con su registro y las correcciones que resulten.',
  // --- Marco operacional: monitorización ---
  'op.mon.1': 'Herramientas de detección o prevención de intrusiones que vigilan el tráfico y la actividad del sistema para identificar intentos de acceso no autorizado o comportamientos anómalos.',
  'op.mon.3': 'Vigilancia continua del sistema para detectar y correlacionar eventos de seguridad, con capacidad de alerta y de respuesta que se refuerza según la categoría del sistema.',
  // --- Medidas de protección ---
  'mp.if.1': 'Los equipos se instalan en áreas separadas destinadas a ese fin, con acceso controlado y limitado a las personas autorizadas, y registro de quién entra.',
  'mp.if.5': 'Los locales donde se ubican los sistemas de información se protegen frente a incendios con medidas de prevención, detección y extinción adecuadas a la normativa industrial.',
  'mp.per.3': 'Actividades periódicas de concienciación para que todo el personal conozca su papel en la seguridad, la normativa, cómo reconocer amenazas como el phishing y cómo comunicar incidentes.',
  'mp.per.4': 'Formación específica del personal en las materias de seguridad necesarias para su puesto: configuración y operación segura de los sistemas, gestión de incidentes y procedimientos aplicables.',
  'mp.eq.2': 'Bloqueo automático del puesto de usuario tras un tiempo prudencial de inactividad, que obliga a autenticarse de nuevo; en niveles superiores, cierre de las sesiones abiertas.',
  'mp.com.1': 'Perímetro de red delimitado y protegido mediante cortafuegos que separa el sistema de otras redes y filtra el tráfico entrante y saliente según una política definida.',
  'mp.com.2': 'Protección de la confidencialidad de la información transmitida por redes no controladas mediante cifrado (por ejemplo, redes privadas virtuales) con algoritmos y protocolos acreditados.',
  'mp.si.2': 'Uso de mecanismos criptográficos para proteger la confidencialidad e integridad de la información almacenada en soportes, especialmente en los que salen de las instalaciones de la organización.',
  'mp.info.2': 'Clasificación de la información según su nivel de seguridad y criterios para su marcado y tratamiento, de modo que cada información reciba la protección que le corresponde.',
  'mp.info.6': 'Realización periódica de copias de seguridad que permitan recuperar la información y los servicios ante pérdidas o ataques, protegidas como la información original y con pruebas de restauración.',
  'mp.s.2': 'Protección de las aplicaciones y servicios web frente a ataques conocidos (inyección, secuestro de sesión, accesos indebidos), con auditorías de seguridad y pruebas antes de su puesta en producción.',
};

// Código ENS al inicio del nombre: "op.acc.1 Identificación" → "op.acc.1"
const codigoDe = (nombre) => {
  const m = /^((?:org|op|mp)(?:\.[a-z]+)*\.\d+)\b/i.exec((nombre || '').trim());
  return m ? m[1].toLowerCase() : null;
};

// Rellena las descripciones vacías del catálogo. No sobrescribe las que ya existan.
const rellenarDescripciones = async (prisma) => {
  const controles = await prisma.controlEns.findMany({ orderBy: { id: 'asc' } });
  const resultado = { rellenados: [], yaTenian: [], sinDescripcion: [] };
  for (const c of controles) {
    if (c.descripcion && c.descripcion.trim()) {
      resultado.yaTenian.push(c.nombre);
      continue;
    }
    const texto = DESCRIPCIONES[codigoDe(c.nombre)];
    if (!texto) {
      resultado.sinDescripcion.push(c.nombre);
      continue;
    }
    await prisma.controlEns.update({ where: { id: c.id }, data: { descripcion: texto } });
    resultado.rellenados.push(c.nombre);
  }
  return resultado;
};

module.exports = { DESCRIPCIONES, codigoDe, rellenarDescripciones };
