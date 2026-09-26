-- CreateEnum
CREATE TYPE "Probabilidad" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "Impacto" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('BAJO', 'MEDIO', 'ALTO');

-- CreateTable
CREATE TABLE "riesgos" (
    "id" SERIAL NOT NULL,
    "actividad_id" INTEGER NOT NULL,
    "amenaza" TEXT NOT NULL,
    "probabilidad" "Probabilidad" NOT NULL,
    "impacto" "Impacto" NOT NULL,
    "nivel_riesgo" "NivelRiesgo" NOT NULL,
    "medidas_mitigadoras" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riesgos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "riesgos_actividad_id_idx" ON "riesgos"("actividad_id");

-- CreateIndex
CREATE INDEX "riesgos_nivel_riesgo_idx" ON "riesgos"("nivel_riesgo");

-- AddForeignKey
ALTER TABLE "riesgos" ADD CONSTRAINT "riesgos_actividad_id_fkey" FOREIGN KEY ("actividad_id") REFERENCES "actividades_rat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
