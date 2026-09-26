/*
  Warnings:

  - Added the required column `generado_por_nombre` to the `declaraciones_conformidad` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sistema_nombre` to the `declaraciones_conformidad` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "declaraciones_conformidad" ADD COLUMN     "emitido_por_nombre" TEXT,
ADD COLUMN     "generado_por_nombre" TEXT NOT NULL,
ADD COLUMN     "sistema_nombre" TEXT NOT NULL;
