-- CreateEnum
CREATE TYPE "TipoDocumentoSolicitud" AS ENUM ('IDENTIFICACION', 'ESCRITO_SOLICITUD', 'RESPUESTA', 'JUSTIFICANTE_ENVIO', 'OTRO');

-- CreateTable
CREATE TABLE "documentos_solicitudes_derechos" (
    "id" SERIAL NOT NULL,
    "solicitud_id" INTEGER NOT NULL,
    "nombre_documento" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoSolicitud" NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "nombre_archivo_original" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "subido_por_id" INTEGER,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_solicitudes_derechos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_solicitudes_derechos_ruta_archivo_key" ON "documentos_solicitudes_derechos"("ruta_archivo");

-- CreateIndex
CREATE INDEX "documentos_solicitudes_derechos_solicitud_id_idx" ON "documentos_solicitudes_derechos"("solicitud_id");

-- AddForeignKey
ALTER TABLE "documentos_solicitudes_derechos" ADD CONSTRAINT "documentos_solicitudes_derechos_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitudes_derechos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_solicitudes_derechos" ADD CONSTRAINT "documentos_solicitudes_derechos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
