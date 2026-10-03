-- Sesiones de usuario en PostgreSQL (connect-pg-simple): la sesión sobrevive a los reinicios
-- del servidor (despliegues y reposo de la instancia gratuita de Render)
-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");
