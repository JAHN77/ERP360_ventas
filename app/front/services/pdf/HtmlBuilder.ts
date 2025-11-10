/**
 * Constructor de HTML: Construye documento HTML completo con CSS embebido
 */
export class HtmlBuilder {
  private static readonly CSS_CACHE_KEY = 'pdf_tailwind_css_cache';
  private static readonly CSS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Construye documento HTML completo con CSS embebido
   */
  static async buildDocument(content: string): Promise<string> {
    const tailwindCss = await this.collectTailwindCss();
    const otherCss = await this.collectOtherCss();
    const allCss = [tailwindCss, otherCss].filter(Boolean).join('\n\n');

    if (!tailwindCss || tailwindCss.length < 1000) {
      throw new Error('CSS de Tailwind no encontrado o muy pequeño');
    }

    return this.buildHtmlString(content, allCss);
  }

  /**
   * Recopila CSS de Tailwind con caché
   */
  private static async collectTailwindCss(): Promise<string> {
    // Intentar desde caché
    const cached = this.getCachedCss();
    if (cached) return cached;

    // Buscar en style tags
    let css = this.findTailwindInStyleTags();
    if (css) {
      this.cacheCss(css);
      return css;
    }

    // Buscar en stylesheets
    css = await this.findTailwindInStylesheets();
    if (css) {
      this.cacheCss(css);
      return css;
    }

    // Cargar desde servidor
    css = await this.loadTailwindFromServer();
    if (css) {
      this.cacheCss(css);
      return css;
    }

    throw new Error('No se pudo encontrar CSS de Tailwind');
  }

  /**
   * Busca Tailwind en tags <style>
   */
  private static findTailwindInStyleTags(): string {
    const styleTags = Array.from(document.querySelectorAll('style'));
    let largestCss = '';
    let largestSize = 0;

    styleTags.forEach(tag => {
      const content = tag.textContent || tag.innerHTML;
      if (this.isTailwindCss(content) && content.length > largestSize) {
        largestCss = content;
        largestSize = content.length;
      }
    });

    return largestCss;
  }

  /**
   * Busca Tailwind en stylesheets
   */
  private static async findTailwindInStylesheets(): Promise<string> {
    const sheets = Array.from(document.styleSheets);
    const promises = sheets.map(async (sheet) => {
      try {
        if (sheet.cssRules && sheet.cssRules.length > 0) {
          const rules: string[] = [];
          for (let i = 0; i < sheet.cssRules.length; i++) {
            try {
              rules.push(sheet.cssRules[i].cssText);
            } catch (e) {
              // Ignorar reglas no accesibles
            }
          }
          const cssText = rules.join('\n');
          if (this.isTailwindCss(cssText) && cssText.length > 50000) {
            return cssText;
          }
        }
      } catch (e) {
        // Ignorar sheets con errores
      }
      return '';
    });

    const results = await Promise.all(promises);
    return results.find(css => css.length > 0) || '';
  }

  /**
   * Carga Tailwind desde servidor
   */
  private static async loadTailwindFromServer(): Promise<string> {
    const urls = [
      `${window.location.origin}/src/index.css`,
      `${window.location.origin}/index.css`,
      `${window.location.origin}/assets/index.css`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const css = await response.text();
          if (this.isTailwindCss(css)) {
            return css;
          }
        }
      } catch (e) {
        // Continuar con siguiente URL
      }
    }

    return '';
  }

  /**
   * Recopila otros CSS (no Tailwind)
   */
  private static async collectOtherCss(): Promise<string> {
    const externalUrls = new Set<string>();
    const internalCss: string[] = [];

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        if (sheet.cssRules && sheet.cssRules.length > 0) {
          const rules: string[] = [];
          for (let i = 0; i < sheet.cssRules.length; i++) {
            try {
              rules.push(sheet.cssRules[i].cssText);
            } catch (e) {
              // Ignorar
            }
          }
          const cssText = rules.join('\n');
          if (!this.isTailwindCss(cssText) && cssText.length > 0) {
            internalCss.push(cssText);
          }
        } else if (sheet.href) {
          externalUrls.add(sheet.href);
        }
      } catch (e) {
        if ((e as DOMException).name === 'SecurityError' && sheet.href) {
          externalUrls.add(sheet.href);
        }
      }
    });

    // Cargar CSS externos en paralelo
    const externalPromises = Array.from(externalUrls).map(async (url) => {
      try {
        const absoluteUrl = url.startsWith('http') 
          ? url 
          : new URL(url, window.location.origin).href;
        const response = await fetch(absoluteUrl);
        if (response.ok) {
          return await response.text();
        }
      } catch (e) {
        // Ignorar
      }
      return '';
    });

    const externalCss = await Promise.all(externalPromises);
    return [...internalCss, ...externalCss.filter(Boolean)].join('\n\n');
  }

  /**
   * Detecta si un CSS es de Tailwind
   */
  private static isTailwindCss(css: string): boolean {
    if (!css || css.length < 1000) return false;
    
    const tailwindIndicators = [
      '.p-', '.m-', '.text-', '.bg-', '.flex', '.grid',
      '.border-', '.rounded-', '@tailwind', '.space-'
    ];

    return tailwindIndicators.some(indicator => css.includes(indicator));
  }

  /**
   * Construye string HTML final
   */
  private static buildHtmlString(content: string, css: string): string {
    const lang = document.documentElement.getAttribute('lang') || 'es';
    const classList = document.documentElement.className
      .split(/\s+/)
      .filter(cls => cls && cls !== 'dark')
      .join(' ');

    return `<!DOCTYPE html>
<html lang="${lang}" class="${classList}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<base href="${window.location.origin}/" />
<style id="pdf-all-css">
${css}
</style>
<style>
  * { 
    -webkit-print-color-adjust: exact !important; 
    print-color-adjust: exact !important; 
    color-adjust: exact !important; 
  }
  html, body { 
    margin: 0 !important; 
    padding: 0 !important; 
    background: #ffffff !important; 
    color: #0f172a !important; 
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  }
  body { 
    display: flex !important; 
    justify-content: center !important; 
    align-items: flex-start !important;
  }
  #pdf-container { 
    background: #ffffff !important; 
    color: #0f172a !important; 
    width: 100% !important;
    max-width: 100% !important;
  }
  #pdf-container * {
    visibility: visible !important;
    opacity: 1 !important;
  }
  img {
    max-width: 100% !important;
    height: auto !important;
  }
</style>
</head>
<body>
<div id="pdf-container">
${content}
</div>
</body>
</html>`;
  }

  private static getCachedCss(): string | null {
    try {
      const cached = sessionStorage.getItem(this.CSS_CACHE_KEY);
      if (!cached) return null;

      const { css, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > this.CSS_CACHE_TTL) {
        sessionStorage.removeItem(this.CSS_CACHE_KEY);
        return null;
      }

      return css;
    } catch (e) {
      return null;
    }
  }

  private static cacheCss(css: string): void {
    try {
      sessionStorage.setItem(
        this.CSS_CACHE_KEY,
        JSON.stringify({ css, timestamp: Date.now() })
      );
    } catch (e) {
      // Ignorar errores de storage
    }
  }
}

