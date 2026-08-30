import puppeteerCore, { type Browser } from "puppeteer-core";
import { env } from "../env";

// Un solo navegador reutilizado entre requests -- abrir Chromium en cada PDF
// sería lentísimo. Se cierra solo cuando el proceso termina.
let browserPromise: Promise<Browser> | null = null;

// Render (y la mayoría de hosts tipo contenedor mínimo) no trae las librerías
// del sistema que el Chromium normal de Puppeteer necesita para arrancar
// (libnss3, libatk, etc.), así que en producción se usa un build de Chromium
// que no depende de ellas. En local se sigue usando el Puppeteer completo,
// que trae su propio Chrome descargado y sí corre tal cual en Windows/Mac.
async function launchBrowser(): Promise<Browser> {
  if (env.isProduction) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteerCore.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }
  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }) as unknown as Promise<Browser>;
}

function getBrowser(): Promise<Browser> {
  browserPromise ??= launchBrowser();
  return browserPromise;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // "load" basta: los logos van embebidos como data URI, no hay red que esperar.
    await page.setContent(html, { waitUntil: "load" });
    const buffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

export async function cerrarNavegadorPdf(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
