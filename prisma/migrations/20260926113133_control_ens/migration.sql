-- CreateEnum
CREATE TYPE "CategoriaEns" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "EstadoControl" AS ENUM ('IMPLEMENTADO', 'PENDIENTE', 'NO_APLICA');

-- CreateTable
CREATE TABLE "controles_ens" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaEns" NOT NULL,
    "estado" "EstadoControl" NOT NULL DEFAULT 'PENDIENTE',
    "evidencia" TEXT,
    "responsable_id" INTEGER,
    "fecha_revision" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controles_ens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "controles_ens_nombre_key" ON "controles_ens"("nombre");

-- CreateIndex
CREATE INDEX "controles_ens_categoria_idx" ON "controles_ens"("categoria");

-- CreateIndex
CREATE INDEX "controles_ens_responsable_id_idx" ON "controles_ens"("responsable_id");

-- AddForeignKey
ALTER TABLE "controles_ens" ADD CONSTRAINT "controles_ens_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
