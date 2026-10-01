-- AlterTable
ALTER TABLE "actividades_rat" ADD COLUMN     "sistema_id" INTEGER;

-- AlterTable
ALTER TABLE "incidentes" ADD COLUMN     "sistema_id" INTEGER;

-- AlterTable
ALTER TABLE "riesgos" ADD COLUMN     "sistema_id" INTEGER;

-- AlterTable
ALTER TABLE "sistemas" ADD COLUMN     "tipo_sistema" TEXT;

-- AlterTable
ALTER TABLE "solicitudes_derechos" ADD COLUMN     "sistema_id" INTEGER;

-- CreateIndex
CREATE INDEX "actividades_rat_sistema_id_idx" ON "actividades_rat"("sistema_id");

-- CreateIndex
CREATE INDEX "incidentes_sistema_id_idx" ON "incidentes"("sistema_id");

-- CreateIndex
CREATE INDEX "riesgos_sistema_id_idx" ON "riesgos"("sistema_id");

-- CreateIndex
CREATE INDEX "solicitudes_derechos_sistema_id_idx" ON "solicitudes_derechos"("sistema_id");

-- AddForeignKey
ALTER TABLE "actividades_rat" ADD CONSTRAINT "actividades_rat_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "riesgos" ADD CONSTRAINT "riesgos_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_derechos" ADD CONSTRAINT "solicitudes_derechos_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
