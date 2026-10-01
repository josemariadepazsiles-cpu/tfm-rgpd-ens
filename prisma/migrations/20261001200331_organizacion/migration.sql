-- CreateTable
CREATE TABLE "organizacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cif" TEXT,
    "sector" TEXT,
    "direccion" TEXT,
    "codigo_postal" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "web" TEXT,
    "categoria_ens" "CategoriaEns",
    "dpd_nombre" TEXT,
    "dpd_email" TEXT,
    "responsable_informacion" TEXT,
    "responsable_seguridad" TEXT,
    "responsable_sistema" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizacion_pkey" PRIMARY KEY ("id")
);
