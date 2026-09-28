-- El sistema pasa a ser el eje de RGPD y ENS: RAT, riesgos, incidentes y solicitudes de
-- derechos pueden asociarse a un sistema. La columna es opcional y los registros existentes
-- quedan con sistema_id = NULL (transversales a toda la organización), sin forzar un sistema.
-- Al borrar un sistema, sus registros vuelven a quedar como transversales (ON DELETE SET NULL).

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
