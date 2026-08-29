import puppeteer, { type Browser } from "puppeteer";

// Un solo navegador reutilizado entre requests -- abrir Chromium en cada PDF
// sería lentísimo. Se cierra solo cuando el proceso termina.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  browserPromise ??= puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
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
