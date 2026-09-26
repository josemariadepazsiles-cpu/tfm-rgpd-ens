-- Evaluaciones ENS por sistema con histórico de cambios de estado.
-- ControlEns pasa a ser un catálogo; el estado de cada control vive ahora en cada evaluación.

-- 1. Tablas nuevas
CREATE TABLE "sistemas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sistemas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluaciones" (
    "id" SERIAL NOT NULL,
    "sistema_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "creado_por_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evaluacion_controles" (
    "id" SERIAL NOT NULL,
    "evaluacion_id" INTEGER NOT NULL,
    "control_id" INTEGER NOT NULL,
    "estado" "EstadoControl" NOT NULL DEFAULT 'PENDIENTE',
    "evidencia" TEXT,
    "responsable_id" INTEGER,
    "fecha_revision" TIMESTAMP(3),
    CONSTRAINT "evaluacion_controles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historial_estados" (
    "id" SERIAL NOT NULL,
    "evaluacion_control_id" INTEGER NOT NULL,
    "estado_anterior" "EstadoControl" NOT NULL,
    "estado_nuevo" "EstadoControl" NOT NULL,
    "usuario_id" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historial_estados_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sistemas_nombre_key" ON "sistemas"("nombre");
CREATE INDEX "evaluaciones_sistema_id_idx" ON "evaluaciones"("sistema_id");
CREATE INDEX "evaluacion_controles_responsable_id_idx" ON "evaluacion_controles"("responsable_id");
CREATE UNIQUE INDEX "evaluacion_controles_evaluacion_id_control_id_key" ON "evaluacion_controles"("evaluacion_id", "control_id");
CREATE INDEX "historial_estados_evaluacion_control_id_fecha_idx" ON "historial_estados"("evaluacion_control_id", "fecha");

ALTER TABLE "evaluaciones" ADD CONSTRAINT "evaluaciones_sistema_id_fkey" FOREIGN KEY ("sistema_id") REFERENCES "sistemas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluaciones" ADD CONSTRAINT "evaluaciones_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evaluacion_controles" ADD CONSTRAINT "evaluacion_controles_evaluacion_id_fkey" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evaluacion_controles" ADD CONSTRAINT "evaluacion_controles_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "controles_ens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evaluacion_controles" ADD CONSTRAINT "evaluacion_controles_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_evaluacion_control_id_fkey" FOREIGN KEY ("evaluacion_control_id") REFERENCES "evaluacion_controles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Migración de datos: si el checklist global tenía progreso, se conserva en
--    "Sistema principal" > "Evaluación inicial", con su histórico
CREATE TEMP TABLE "_controles_con_datos" AS
SELECT "id", "estado", "evidencia", "responsable_id", "fecha_revision"
FROM "controles_ens"
WHERE "estado" <> 'PENDIENTE' OR "evidencia" IS NOT NULL
   OR "responsable_id" IS NOT NULL OR "fecha_revision" IS NOT NULL;

INSERT INTO "sistemas" ("nombre", "descripcion", "updated_at")
SELECT 'Sistema principal', 'Creado automáticamente al migrar el checklist ENS global', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "_controles_con_datos");

INSERT INTO "evaluaciones" ("sistema_id", "nombre", "created_at")
SELECT "id", 'Evaluación inicial', "created_at" FROM "sistemas" WHERE "nombre" = 'Sistema principal';

INSERT INTO "evaluacion_controles" ("evaluacion_id", "control_id", "estado", "evidencia", "responsable_id", "fecha_revision")
SELECT e."id", c."id", c."estado", c."evidencia", c."responsable_id", c."fecha_revision"
FROM "_controles_con_datos" c
CROSS JOIN "evaluaciones" e
JOIN "sistemas" s ON s."id" = e."sistema_id" AND s."nombre" = 'Sistema principal';

-- El usuario que hizo esos cambios no se registraba, por eso queda vacío
INSERT INTO "historial_estados" ("evaluacion_control_id", "estado_anterior", "estado_nuevo", "usuario_id", "fecha")
SELECT "id", 'PENDIENTE', "estado", NULL, "fecha_revision"
FROM "evaluacion_controles"
WHERE "estado" <> 'PENDIENTE' AND "fecha_revision" IS NOT NULL;

DROP TABLE "_controles_con_datos";

-- 3. ControlEns queda como catálogo
ALTER TABLE "controles_ens" DROP CONSTRAINT "controles_ens_responsable_id_fkey";
DROP INDEX "controles_ens_responsable_id_idx";
ALTER TABLE "controles_ens" DROP COLUMN "estado",
DROP COLUMN "evidencia",
DROP COLUMN "fecha_revision",
DROP COLUMN "responsable_id";
