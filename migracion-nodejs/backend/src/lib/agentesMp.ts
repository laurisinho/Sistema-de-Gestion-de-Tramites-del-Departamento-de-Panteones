// Varios registros históricos traen el mismo agente con una coma en lugar del
// punto ("LIC, EDGAR ...") o con espacios de más. Se unifica al sembrar el
// catálogo y al ofrecer sugerencias para que un nombre no aparezca dos veces.
export function normalizarAgenteMp(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^LIC\s*[,.]\s*/i, "LIC. ");
}
