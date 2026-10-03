-- El área del usuario se sustituye por su cargo (el área la indican ahora sus sistemas)
ALTER TABLE "usuarios" RENAME COLUMN "area" TO "cargo";
