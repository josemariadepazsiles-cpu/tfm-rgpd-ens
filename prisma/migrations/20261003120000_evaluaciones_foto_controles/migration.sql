-- Cada evaluación pasa a guardar la foto de sus controles: se crean como Pendiente las filas
-- que faltaban (hasta ahora un control sin fila contaba como Pendiente), de modo que los
-- porcentajes actuales no cambian
INSERT INTO "evaluacion_controles" ("evaluacion_id", "control_id")
SELECT e."id", c."id"
FROM "evaluaciones" e
CROSS JOIN "controles_ens" c
ON CONFLICT ("evaluacion_id", "control_id") DO NOTHING;
