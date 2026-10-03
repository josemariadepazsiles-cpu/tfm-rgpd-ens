-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "usuarios_sistemas" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "sistema_id" INTEGER NOT NULL,

    CONSTRAINT "usuarios_sistemas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuarios_sistemas_sistema_id_idx" ON "usuarios_sistemas"("sistema_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_sistemas_usuario_id_sistema_id_key" ON "usuarios_sistemas"("usuario_id", "sistema_id");

-- AddForeignKey
ALTER TABLE "usuarios_sistemas" ADD CONSTRAINT "usuarios_sistemas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_sistemas" ADD CONSTRAINT "usuarios_sistemas_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
