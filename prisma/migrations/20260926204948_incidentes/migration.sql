-- CreateEnum
CREATE TYPE "TipoIncidente" AS ENUM ('CONFIDENCIALIDAD', 'INTEGRIDAD', 'DISPONIBILIDAD');

-- CreateEnum
CREATE TYPE "GravedadIncidente" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "EstadoIncidente" AS ENUM ('ABIERTO', 'EN_INVESTIGACION', 'CONTENIDO', 'NOTIFICADO', 'CERRADO');

-- CreateTable
CREATE TABLE "incidentes" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fecha_deteccion" TIMESTAMP(3) NOT NULL,
    "fecha_ocurrencia" TIMESTAMP(3),
    "tipo" "TipoIncidente" NOT NULL,
    "categorias_datos_afectados" TEXT NOT NULL,
    "numero_afectados_estimado" INTEGER,
    "gravedad" "GravedadIncidente" NOT NULL,
    "estado" "EstadoIncidente" NOT NULL DEFAULT 'ABIERTO',
    "medidas_adoptadas" TEXT,
    "requiere_notificacion_aepd" BOOLEAN NOT NULL DEFAULT false,
    "fecha_notificacion_aepd" TIMESTAMP(3),
    "requiere_notificacion_afectados" BOOLEAN NOT NULL DEFAULT false,
    "fecha_notificacion_afectados" TIMESTAMP(3),
    "responsable_id" INTEGER,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_incidentes" (
    "id" SERIAL NOT NULL,
    "incidente_id" INTEGER NOT NULL,
    "estado_anterior" "EstadoIncidente" NOT NULL,
    "estado_nuevo" "EstadoIncidente" NOT NULL,
    "usuario_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidentes_estado_idx" ON "incidentes"("estado");

-- CreateIndex
CREATE INDEX "incidentes_gravedad_idx" ON "incidentes"("gravedad");

-- CreateIndex
CREATE INDEX "incidentes_responsable_id_idx" ON "incidentes"("responsable_id");

-- CreateIndex
CREATE INDEX "historial_incidentes_incidente_id_fecha_idx" ON "historial_incidentes"("incidente_id", "fecha");

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_incidentes" ADD CONSTRAINT "historial_incidentes_incidente_id_fkey" FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_incidentes" ADD CONSTRAINT "historial_incidentes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
