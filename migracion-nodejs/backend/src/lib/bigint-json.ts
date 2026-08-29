// Bitacora.bitacoraId es BigInt en Prisma (columna BIGINT). JSON.stringify no
// sabe serializar BigInt de forma nativa y truena -- este es el arreglo
// estándar: se serializa como string, sin perder precisión en IDs grandes.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export {};
