-- CreateEnum
CREATE TYPE "CriticidadProceso" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoRevisionBia" AS ENUM ('PENDIENTE_ANALISIS', 'ANALIZADO', 'REQUIERE_PLAN', 'PLAN_DEFINIDO');

-- CreateEnum
CREATE TYPE "TipoPruebaContinuidad" AS ENUM ('SIMULACRO_DOCUMENTAL', 'PRUEBA_PARCIAL', 'PRUEBA_COMPLETA');

-- CreateEnum
CREATE TYPE "ResultadoPrueba" AS ENUM ('SATISFACTORIO', 'CON_INCIDENCIAS', 'FALLIDO');

-- CreateTable
CREATE TABLE "procesos_negocio" (
    "id" SERIAL NOT NULL,
    "sistema_id" INTEGER,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "departamento_responsable" TEXT NOT NULL,
    "criticidad" "CriticidadProceso" NOT NULL,
    "rto_horas" DECIMAL(8,2) NOT NULL,
    "rpo_horas" DECIMAL(8,2) NOT NULL,
    "impacto_economico" TEXT,
    "impacto_legal_reputacional" TEXT,
    "recursos_minimos_necesarios" TEXT,
    "estrategia_continuidad" TEXT,
    "estado_revision" "EstadoRevisionBia" NOT NULL DEFAULT 'PENDIENTE_ANALISIS',
    "responsable_id" INTEGER,
    "fecha_ultimo_analisis" TIMESTAMP(3),
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procesos_negocio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pruebas_continuidad" (
    "id" SERIAL NOT NULL,
    "proceso_id" INTEGER NOT NULL,
    "fecha_prueba" TIMESTAMP(3) NOT NULL,
    "tipo_prueba" "TipoPruebaContinuidad" NOT NULL,
    "resultado" "ResultadoPrueba" NOT NULL,
    "observaciones" TEXT,
    "realizado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pruebas_continuidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procesos_negocio_criticidad_idx" ON "procesos_negocio"("criticidad");

-- CreateIndex
CREATE INDEX "procesos_negocio_estado_revision_idx" ON "procesos_negocio"("estado_revision");

-- CreateIndex
CREATE INDEX "pruebas_continuidad_proceso_id_fecha_prueba_idx" ON "pruebas_continuidad"("proceso_id", "fecha_prueba");

-- AddForeignKey
ALTER TABLE "procesos_negocio" ADD CONSTRAINT "procesos_negocio_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procesos_negocio" ADD CONSTRAINT "procesos_negocio_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procesos_negocio" ADD CONSTRAINT "procesos_negocio_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pruebas_continuidad" ADD CONSTRAINT "pruebas_continuidad_proceso_id_fkey" FOREIGN KEY ("proceso_id") REFERENCES "procesos_negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pruebas_continuidad" ADD CONSTRAINT "pruebas_continuidad_realizado_por_id_fkey" FOREIGN KEY ("realizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
