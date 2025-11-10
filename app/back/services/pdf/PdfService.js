/**
 * Servicio principal de generación de PDF (Backend)
 */
const PuppeteerService = require('./PuppeteerService');
const HtmlValidator = require('../../validators/HtmlValidator');

class PdfService {
  constructor() {
    this.puppeteerService = new PuppeteerService();
  }

  async generatePdf(html, options = {}) {
    // 1. Validar HTML
    const validation = HtmlValidator.validate(html);
    if (!validation.valid) {
      throw new Error(`HTML inválido: ${validation.errors.join(', ')}`);
    }

    let page = null;
    try {
      // 2. Cargar contenido en Puppeteer
      page = await this.puppeteerService.loadContent(html);

      // 3. Esperar renderizado
      const renderSuccess = await this.puppeteerService.waitForRender(page, 15000);
      if (!renderSuccess) {
        throw new Error('Timeout esperando renderizado del contenido');
      }

      // 4. Validar contenido renderizado
      const contentValidation = await this.puppeteerService.validateContent(page);
      if (!contentValidation.valid) {
        throw new Error(
          `Contenido no válido: ${JSON.stringify(contentValidation)}`
        );
      }

      // 5. Generar PDF
      const pdfBuffer = await this.puppeteerService.generatePdf(page, options);

      // 6. Validar PDF generado
      if (!pdfBuffer || pdfBuffer.length < 1000) {
        throw new Error('PDF generado está vacío o es muy pequeño');
      }

      return pdfBuffer;

    } catch (error) {
      throw new Error(`Error generando PDF: ${error.message}`);
    } finally {
      await this.puppeteerService.cleanup();
    }
  }
}

module.exports = PdfService;

