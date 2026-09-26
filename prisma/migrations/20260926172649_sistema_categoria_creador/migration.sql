-- AlterTable
ALTER TABLE "sistemas" ADD COLUMN     "categoria_general" "CategoriaEns",
ADD COLUMN     "creado_por_id" INTEGER;

-- AddForeignKey
ALTER TABLE "sistemas" ADD CONSTRAINT "sistemas_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
