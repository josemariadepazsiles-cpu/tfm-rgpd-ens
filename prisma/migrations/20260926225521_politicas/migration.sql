-- CreateEnum
CREATE TYPE "TipoPolitica" AS ENUM ('POLITICA', 'PROCEDIMIENTO', 'INSTRUCCION_TECNICA', 'NORMATIVA_INTERNA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPolitica" AS ENUM ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'OBSOLETA');

-- CreateTable
CREATE TABLE "politicas" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo_documento" "TipoPolitica" NOT NULL,
    "descripcion" TEXT,
    "version" TEXT NOT NULL,
    "estado" "EstadoPolitica" NOT NULL DEFAULT 'BORRADOR',
    "fecha_aprobacion" TIMESTAMP(3),
    "aprobado_por_id" INTEGER,
    "fecha_proxima_revision" TIMESTAMP(3),
    "requiere_aceptacion" BOOLEAN NOT NULL DEFAULT false,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "politicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivos_politicas" (
    "id" SERIAL NOT NULL,
    "politica_id" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "historico" BOOLEAN NOT NULL DEFAULT false,
    "ruta_archivo" TEXT NOT NULL,
    "nombre_archivo_original" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "subido_por_id" INTEGER,
    "fecha_subida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivos_politicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aceptaciones_politicas" (
    "id" SERIAL NOT NULL,
    "politica_id" INTEGER NOT NULL,
    "version_aceptada" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "fecha_aceptacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aceptaciones_politicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "politicas_estado_idx" ON "politicas"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "archivos_politicas_ruta_archivo_key" ON "archivos_politicas"("ruta_archivo");

-- CreateIndex
CREATE UNIQUE INDEX "archivos_politicas_politica_id_version_key" ON "archivos_politicas"("politica_id", "version");

-- CreateIndex
CREATE INDEX "aceptaciones_politicas_usuario_id_idx" ON "aceptaciones_politicas"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "aceptaciones_politicas_politica_id_version_aceptada_usuario_key" ON "aceptaciones_politicas"("politica_id", "version_aceptada", "usuario_id");

-- AddForeignKey
ALTER TABLE "politicas" ADD CONSTRAINT "politicas_aprobado_por_id_fkey" FOREIGN KEY ("aprobado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "politicas" ADD CONSTRAINT "politicas_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos_politicas" ADD CONSTRAINT "archivos_politicas_politica_id_fkey" FOREIGN KEY ("politica_id") REFERENCES "politicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos_politicas" ADD CONSTRAINT "archivos_politicas_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceptaciones_politicas" ADD CONSTRAINT "aceptaciones_politicas_politica_id_fkey" FOREIGN KEY ("politica_id") REFERENCES "politicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aceptaciones_politicas" ADD CONSTRAINT "aceptaciones_politicas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
