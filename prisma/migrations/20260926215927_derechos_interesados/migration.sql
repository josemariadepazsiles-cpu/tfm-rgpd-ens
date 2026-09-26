-- CreateEnum
CREATE TYPE "TipoDerecho" AS ENUM ('ACCESO', 'RECTIFICACION', 'SUPRESION', 'OPOSICION', 'LIMITACION', 'PORTABILIDAD');

-- CreateEnum
CREATE TYPE "CanalEntrada" AS ENUM ('EMAIL', 'FORMULARIO_WEB', 'CORREO_POSTAL', 'PRESENCIAL', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('RECIBIDA', 'VERIFICACION_IDENTIDAD', 'EN_TRAMITACION', 'ESTIMADA', 'DENEGADA', 'AMPLIADA');

-- CreateTable
CREATE TABLE "solicitudes_derechos" (
    "id" SERIAL NOT NULL,
    "nombre_solicitante" TEXT NOT NULL,
    "email_solicitante" TEXT NOT NULL,
    "telefono_solicitante" TEXT,
    "tipo_derecho" "TipoDerecho" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "canal_entrada" "CanalEntrada" NOT NULL,
    "fecha_recepcion" TIMESTAMP(3) NOT NULL,
    "fecha_limite" TIMESTAMP(3) NOT NULL,
    "plazo_ampliado" BOOLEAN NOT NULL DEFAULT false,
    "motivo_ampliacion" TEXT,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'RECIBIDA',
    "motivo_denegacion" TEXT,
    "respuesta_enviada" TEXT,
    "fecha_respuesta" TIMESTAMP(3),
    "responsable_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_derechos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_solicitudes_derechos" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "estado_anterior" "EstadoSolicitud" NOT NULL,
    "estado_nuevo" "EstadoSolicitud" NOT NULL,
    "detalle" TEXT,
    "usuario_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_solicitudes_derechos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_derechos_estado_idx" ON "solicitudes_derechos"("estado");

-- CreateIndex
CREATE INDEX "solicitudes_derechos_tipo_derecho_idx" ON "solicitudes_derechos"("tipo_derecho");

-- CreateIndex
CREATE INDEX "solicitudes_derechos_fecha_limite_idx" ON "solicitudes_derechos"("fecha_limite");

-- CreateIndex
CREATE INDEX "solicitudes_derechos_responsable_id_idx" ON "solicitudes_derechos"("responsable_id");

-- CreateIndex
CREATE INDEX "historial_solicitudes_derechos_solicitud_id_fecha_idx" ON "historial_solicitudes_derechos"("solicitud_id", "fecha");

-- AddForeignKey
ALTER TABLE "solicitudes_derechos" ADD CONSTRAINT "solicitudes_derechos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_derechos" ADD CONSTRAINT "solicitudes_derechos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_solicitudes_derechos" ADD CONSTRAINT "historial_solicitudes_derechos_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_derechos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_solicitudes_derechos" ADD CONSTRAINT "historial_solicitudes_derechos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
