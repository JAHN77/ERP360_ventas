/**
 * Servicio Puppeteer: Gestiona Puppeteer para generación de PDF
 * Compatible con Vercel Serverless Functions usando @sparticuz/chromium
 */
let puppeteer;
let chromium;

// Detectar si estamos en Vercel (serverless)
const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

if (isVercel) {
  // En Vercel, usar puppeteer-core con @sparticuz/chromium
  try {
    chromium = require('@sparticuz/chromium');
    puppeteer = require('puppeteer-core');
  } catch (e) {
    console.warn('⚠️ @sparticuz/chromium no disponible, usando puppeteer estándar');
    puppeteer = require('puppeteer');
  }
} else {
  // En desarrollo/local, usar puppeteer estándar
  puppeteer = require('puppeteer');
}

class PuppeteerService {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    if (!this.browser) {
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ],
      };

      // En Vercel, usar chromium empaquetado
      if (isVercel && chromium) {
        launchOptions.executablePath = await chromium.executablePath();
        launchOptions.args = [
          ...chromium.args,
          '--hide-scrollbars',
          '--disable-web-security',
        ];
      }

      this.browser = await puppeteer.launch(launchOptions);
    }

    if (!this.page) {
      this.page = await this.browser.newPage();
      await this.page.setViewport({
        width: 816, // A4 width at 96 DPI (approx)
        height: 1056, // A4 height at 96 DPI (approx)
        deviceScaleFactor: 2
      });
    }

    return this.page;
  }

  async loadContent(html) {
    const page = await this.initialize();
    
    await page.setContent(html, {
      waitUntil: ['load', 'networkidle0'],
      timeout: 60000
    });

    return page;
  }

  async waitForRender(page, timeout = 15000) {
    // Esperar a que el contenedor exista y tenga contenido
    try {
      await page.waitForFunction(() => {
        const container = document.getElementById('pdf-container');
        if (!container) return false;

        const style = window.getComputedStyle(container);
        const hasContent = container.innerHTML.trim().length > 100;
        const isVisible = 
          style.display !== 'none' && 
          style.visibility !== 'hidden' && 
          style.opacity !== '0';
        const hasText = container.textContent && container.textContent.trim().length > 50;

        return hasContent && isVisible && hasText;
      }, { timeout, polling: 100 });

      // Esperar adicional para estilos
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(resolve).catch(() => setTimeout(resolve, 500));
          } else {
            setTimeout(resolve, 500);
          }
        });
      });

      // Esperar imágenes
      await page.evaluate(() => {
        return Promise.all(
          Array.from(document.images)
            .filter(img => !img.complete)
            .map(img => new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              setTimeout(resolve, 2000);
            }))
        );
      });

      return true;
    } catch (error) {
      console.warn('[PDF] Timeout esperando renderizado:', error.message);
      return false;
    }
  }

  async validateContent(page) {
    const result = await page.evaluate(() => {
      const container = document.getElementById('pdf-container');
      if (!container) {
        return { valid: false, reason: 'Container no existe' };
      }

      const style = window.getComputedStyle(container);
      const hasContent = container.innerHTML.trim().length > 100;
      const hasText = container.textContent && container.textContent.trim().length > 50;
      const isVisible = 
        style.display !== 'none' && 
        style.visibility !== 'hidden' && 
        style.opacity !== '0';

      // Verificar que CSS se cargó
      const tailwindCssExists = document.getElementById('pdf-all-css') !== null;

      // Verificar que estilos se aplicaron
      const testElement = container.querySelector('.p-10, [class*="p-"]');
      const testPadding = testElement 
        ? window.getComputedStyle(testElement).padding 
        : '0px';

      return {
        valid: hasContent && hasText && isVisible && tailwindCssExists && testPadding !== '0px',
        hasContent,
        hasText,
        isVisible,
        tailwindCssExists,
        testPadding,
        containerText: container.textContent?.substring(0, 200) || ''
      };
    });

    return result;
  }

  async generatePdf(page, options = {}) {
    const pdfOptions = {
      format: options.format || 'A4',
      printBackground: true,
      margin: options.margin || {
        top: '10mm',
        right: '12mm',
        bottom: '12mm',
        left: '12mm'
      },
      preferCSSPageSize: false,
    };

    // Forzar media type 'screen' para asegurar que se vea igual que en el navegador
    await page.emulateMediaType('screen');

    return await page.pdf(pdfOptions);
  }

  async cleanup() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = PuppeteerService;

