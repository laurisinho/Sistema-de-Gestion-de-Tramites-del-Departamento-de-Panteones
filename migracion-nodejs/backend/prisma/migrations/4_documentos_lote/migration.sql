-- CreateTable
CREATE TABLE "documentos_lote" (
    "documento_id" SERIAL NOT NULL,
    "lote_id" INTEGER NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "ruta_storage" VARCHAR(500) NOT NULL,
    "tipo_mime" VARCHAR(100) NOT NULL,
    "tamanio_bytes" INTEGER NOT NULL,
    "usuario_subio_id" INTEGER NOT NULL,
    "fecha_subida" TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_lote_pkey" PRIMARY KEY ("documento_id")
);

-- CreateIndex
CREATE INDEX "ix_documentos_lote_lote" ON "documentos_lote"("lote_id");

-- AddForeignKey
ALTER TABLE "documentos_lote" ADD CONSTRAINT "documentos_lote_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lotes"("lote_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_lote" ADD CONSTRAINT "documentos_lote_usuario_subio_id_fkey" FOREIGN KEY ("usuario_subio_id") REFERENCES "usuarios"("usuario_id") ON DELETE RESTRICT ON UPDATE CASCADE;
