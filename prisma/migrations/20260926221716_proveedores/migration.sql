-- CreateEnum
CREATE TYPE "MecanismoTransferencia" AS ENUM ('NO_APLICA', 'CLAUSULAS_TIPO', 'DECISION_ADECUACION', 'NORMAS_CORPORATIVAS', 'OTRO');

-- CreateEnum
CREATE TYPE "NivelEnsProveedor" AS ENUM ('NO_APLICA', 'BASICO', 'MEDIO', 'ALTO', 'NO_ACREDITADO');

-- CreateEnum
CREATE TYPE "EstadoProveedor" AS ENUM ('ACTIVO', 'EN_REVISION', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoDocumentoProveedor" AS ENUM ('CONTRATO', 'ANEXO', 'CERTIFICADO', 'CLAUSULAS_TRANSFERENCIA', 'OTRO');

-- CreateTable
CREATE TABLE "proveedores" (
    "id" SERIAL NOT NULL,
    "nombre_empresa" TEXT NOT NULL,
    "cif" TEXT,
    "direccion" TEXT,
    "persona_contacto" TEXT,
    "email_contacto" TEXT,
    "telefono_contacto" TEXT,
    "servicio_prestado" TEXT NOT NULL,
    "categorias_datos_tratados" TEXT NOT NULL,
    "pais_tratamiento" TEXT NOT NULL,
    "fuera_ue" BOOLEAN NOT NULL DEFAULT false,
    "mecanismo_transferencia" "MecanismoTransferencia" NOT NULL DEFAULT 'NO_APLICA',
    "tiene_contrato_encargado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_firma_contrato" TIMESTAMP(3),
    "fecha_revision_contrato" TIMESTAMP(3),
    "nivel_cumplimiento_ens" "NivelEnsProveedor" NOT NULL DEFAULT 'NO_APLICA',
    "estado" "EstadoProveedor" NOT NULL DEFAULT 'ACTIVO',
    "responsable_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_proveedores" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "nombre_documento" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoProveedor" NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "nombre_archivo_original" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "subido_por_id" INTEGER,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proveedores_estado_idx" ON "proveedores"("estado");

-- CreateIndex
CREATE INDEX "proveedores_responsable_id_idx" ON "proveedores"("responsable_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_proveedores_ruta_archivo_key" ON "documentos_proveedores"("ruta_archivo");

-- CreateIndex
CREATE INDEX "documentos_proveedores_proveedor_id_idx" ON "documentos_proveedores"("proveedor_id");

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_proveedores" ADD CONSTRAINT "documentos_proveedores_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_proveedores" ADD CONSTRAINT "documentos_proveedores_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
