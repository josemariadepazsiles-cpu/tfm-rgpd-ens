-- CreateEnum
CREATE TYPE "BaseLegal" AS ENUM ('CONSENTIMIENTO', 'CONTRATO', 'OBLIGACION_LEGAL', 'INTERES_VITAL', 'INTERES_PUBLICO', 'INTERES_LEGITIMO');

-- CreateTable
CREATE TABLE "actividades_rat" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "finalidad" TEXT NOT NULL,
    "base_legal" "BaseLegal" NOT NULL,
    "categorias_datos" TEXT NOT NULL,
    "categorias_interesados" TEXT NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "transferencia_intl" BOOLEAN NOT NULL DEFAULT false,
    "pais_transferencia" TEXT,
    "plazo_conservacion" TEXT NOT NULL,
    "medidas_seguridad" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actividades_rat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "actividades_rat_usuario_id_idx" ON "actividades_rat"("usuario_id");

-- AddForeignKey
ALTER TABLE "actividades_rat" ADD CONSTRAINT "actividades_rat_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
