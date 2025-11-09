const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL) ||
  'http://localhost:3001/api';

const PDF_ENDPOINT = `${API_BASE_URL}/generar-pdf`;

export interface GeneratePdfOptions {
  fileName?: string;
}

const buildHtmlDocument = (content: string): string => {
  const headNodes = Array.from(
    document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], link[rel="preconnect"], link[rel="dns-prefetch"], style',
    ),
  )
    .map((node) => node.outerHTML)
    .join('\n');

  const collectedCss: string[] = [];

  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      if (!sheet.cssRules) {
        return;
      }
      collectedCss.push(
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join('\n'),
      );
    } catch (error) {
      if ((error as DOMException).name === 'SecurityError' && sheet.href) {
        collectedCss.push(`@import url('${sheet.href}');`);
      }
    }
  });

  const classList = document.documentElement.className
    .split(/\s+/)
    .filter((cls) => cls && cls !== 'dark')
    .join(' ');
  const langAttr = document.documentElement.getAttribute('lang') ?? 'es';

  return `<!DOCTYPE html>
<html lang="${langAttr}" class="${classList}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<base href="${window.location.origin}/" />
${headNodes}
<style id="pdf-inline-styles">
${collectedCss.join('\n')}
</style>
<style>
  html, body { margin: 0; padding: 0; background: #ffffff; color: #0f172a; }
  body { display: flex; justify-content: center; }
  #pdf-container { background: #ffffff !important; color: #0f172a !important; width: 100%; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
  @media print {
    body > * { display: block !important; }
  }
</style>
</head>
<body>
<div id="pdf-container">
${content}
</div>
</body>
</html>`;
};

export const descargarElementoComoPDF = async (
  element: HTMLElement,
  options: GeneratePdfOptions = {},
): Promise<void> => {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-ignore-pdf="true"]').forEach((node) => node.remove());

  const serialized = new XMLSerializer().serializeToString(clone);
  const htmlDocument = buildHtmlDocument(serialized);

  const response = await fetch(PDF_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html: htmlDocument, fileName: options.fileName }),
  });

  if (!response.ok) {
    throw new Error(`Error generando PDF (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName ?? 'documento.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
