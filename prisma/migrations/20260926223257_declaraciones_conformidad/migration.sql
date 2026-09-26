-- CreateEnum
CREATE TYPE "EstadoDeclaracion" AS ENUM ('BORRADOR', 'EMITIDA', 'SUPERADA');

-- CreateTable
CREATE TABLE "declaraciones_conformidad" (
    "id" SERIAL NOT NULL,
    "sistema_id" INTEGER NOT NULL,
    "evaluacion_id" INTEGER,
    "evaluacion_nombre" TEXT NOT NULL,
    "categoria_ens" "CategoriaEns" NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "porcentaje_implementacion" DECIMAL(5,2) NOT NULL,
    "numero_controles_total" INTEGER NOT NULL,
    "numero_controles_implementados" INTEGER NOT NULL,
    "numero_controles_pendientes" INTEGER NOT NULL,
    "numero_controles_no_aplica" INTEGER NOT NULL,
    "observaciones" TEXT,
    "estado" "EstadoDeclaracion" NOT NULL DEFAULT 'BORRADOR',
    "version" INTEGER NOT NULL,
    "generado_por_id" INTEGER,
    "emitido_por_id" INTEGER,
    "fecha_emision" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "declaraciones_conformidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalles_declaracion_control" (
    "id" SERIAL NOT NULL,
    "declaracion_id" INTEGER NOT NULL,
    "control_nombre" TEXT NOT NULL,
    "control_categoria" "CategoriaEns" NOT NULL,
    "estado_control" "EstadoControl" NOT NULL,
    "responsable" TEXT,
    "evidencia" TEXT,
    "fecha_revision" TIMESTAMP(3),

    CONSTRAINT "detalles_declaracion_control_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "declaraciones_conformidad_estado_idx" ON "declaraciones_conformidad"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "declaraciones_conformidad_sistema_id_version_key" ON "declaraciones_conformidad"("sistema_id", "version");

-- CreateIndex
CREATE INDEX "detalles_declaracion_control_declaracion_id_idx" ON "detalles_declaracion_control"("declaracion_id");

-- AddForeignKey
ALTER TABLE "declaraciones_conformidad" ADD CONSTRAINT "declaraciones_conformidad_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_conformidad" ADD CONSTRAINT "declaraciones_conformidad_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_conformidad" ADD CONSTRAINT "declaraciones_conformidad_generado_por_id_fkey" FOREIGN KEY ("generado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "declaraciones_conformidad" ADD CONSTRAINT "declaraciones_conformidad_emitido_por_id_fkey" FOREIGN KEY ("emitido_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalles_declaracion_control" ADD CONSTRAINT "detalles_declaracion_control_declaracion_id_fkey" FOREIGN KEY ("declaracion_id") REFERENCES "declaraciones_conformidad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
