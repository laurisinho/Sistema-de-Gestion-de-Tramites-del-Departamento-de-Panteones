// Varios registros históricos traen el mismo agente escrito con una coma en
// vez del punto ("LIC, EDGAR ...") o con espacios de más. Se unifica al
// sembrar el catálogo y al ofrecer sugerencias, para que un mismo nombre no
// aparezca dos veces en la lista.
export function normalizarAgenteMp(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^LIC\s*[,.]\s*/i, "LIC. ");
}
