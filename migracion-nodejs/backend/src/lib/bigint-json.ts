// Bitacora.bitacoraId es BigInt (columna BIGINT) y JSON.stringify no serializa
// BigInt de forma nativa. Se serializa como string para no perder precisión.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export {};
