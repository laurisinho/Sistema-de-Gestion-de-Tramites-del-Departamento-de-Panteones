import puppeteerCore, { type Browser } from "puppeteer-core";
import puppeteerCompleto from "puppeteer";
import { env } from "../env";

// Un solo navegador compartido entre peticiones: abrir Chromium por cada PDF
// es muy lento. Se cierra al terminar el proceso.
let browserPromise: Promise<Browser> | null = null;

// En hospedajes con contenedores mínimos faltan las librerías del sistema que
// necesita el Chromium de Puppeteer (libnss3, libatk, etc.), por lo que en
// producción se usa @sparticuz/chromium, que no depende de ellas. En local se
// usa Puppeteer completo, que descarga su propio Chrome.
async function launchBrowser(): Promise<Browser> {
  // Chromium del sistema (imagen de Docker), con sus librerías y fuentes.
  // --no-sandbox porque el sandbox de Chromium no puede crear namespaces dentro
  // de un contenedor; el propio contenedor hace de aislamiento.
  if (env.chromiumPath) {
    return puppeteerCore.launch({
      executablePath: env.chromiumPath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      headless: true,
    });
  }
  if (env.isProduction) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteerCore.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });
  }
  // "puppeteer" se importa de forma estática (arriba) y no con await import():
  // bajo "tsx watch" el import() dinámico de este paquete se queda colgado.
  return puppeteerCompleto.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }) as unknown as Promise<Browser>;
}

function getBrowser(): Promise<Browser> {
  browserPromise ??= launchBrowser();
  return browserPromise;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Con "load" basta: los logos van embebidos como data URI.
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
