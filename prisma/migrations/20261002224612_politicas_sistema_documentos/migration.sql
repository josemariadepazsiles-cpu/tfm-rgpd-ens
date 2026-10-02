-- CreateEnum
CREATE TYPE "TipoDocumentoPolitica" AS ENUM ('ANEXO', 'PLANTILLA', 'REGISTRO', 'EVIDENCIA', 'OTRO');

-- AlterTable
ALTER TABLE "politicas" ADD COLUMN     "sistema_id" INTEGER;

-- CreateTable
CREATE TABLE "documentos_politicas" (
    "id" SERIAL NOT NULL,
    "politica_id" INTEGER NOT NULL,
    "nombre_documento" TEXT NOT NULL,
    "tipo_documento" "TipoDocumentoPolitica" NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "nombre_archivo_original" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "subido_por_id" INTEGER,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_politicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documentos_politicas_ruta_archivo_key" ON "documentos_politicas"("ruta_archivo");

-- CreateIndex
CREATE INDEX "documentos_politicas_politica_id_idx" ON "documentos_politicas"("politica_id");

-- CreateIndex
CREATE INDEX "politicas_sistema_id_idx" ON "politicas"("sistema_id");

-- AddForeignKey
ALTER TABLE "politicas" ADD CONSTRAINT "politicas_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_politicas" ADD CONSTRAINT "documentos_politicas_politica_id_fkey" FOREIGN KEY ("politica_id") REFERENCES "politicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_politicas" ADD CONSTRAINT "documentos_politicas_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
