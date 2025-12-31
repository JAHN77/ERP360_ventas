export const generateEmailHtml = (
    empresaNombre: string,
    bodyContent: string,
    details?: { label: string; value: string }[],
    logoUrl?: string
) => {
    // Convertir saltos de línea a <br> si es texto plano
    const formattedBody = bodyContent.replace(/\n/g, '<br>');

    const detailsHtml = details && details.length > 0 ? `
        <div style="background-color: #f8fafc; border-radius: 6px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0 0 10px; font-weight: 600; color: #334155; font-size: 14px; text-transform: uppercase;">Resumen del Documento</p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${details.map(detail => `
                    <tr>
                        <td style="padding: 6px 0; color: #64748b; font-size: 14px; border-bottom: 1px solid #e2e8f0;">${detail.label}</td>
                        <td style="padding: 6px 0; color: #0f172a; font-weight: 600; font-size: 14px; text-align: right; border-bottom: 1px solid #e2e8f0;">${detail.value}</td>
                    </tr>
                `).join('')}
            </table>
        </div>
    ` : '';

    // Si hay logo, usarlo en lugar del texto del nombre.
    // Ojo: muchos clientes de correo bloquean imagenes base64. 
    // Usaremos un diseño híbrido: Si hay logo, lo mostramos, si no, texto.
    // Para mayor compatibilidad, el nombre de la empresa siempre va en el title/alt.

    // NOTA: Asumimos que logoUrl es un string base64 data:image...
    const headerContent = logoUrl
        ? `<img src="${logoUrl}" alt="${empresaNombre}" style="max-height: 50px; max-width: 200px; object-fit: contain;">`
        : `<h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">${empresaNombre}</h1>`;

    const headerBg = logoUrl ? '#ffffff' : '#2563eb';
    const headerBorder = logoUrl ? 'border-bottom: 3px solid #2563eb;' : '';

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Notificación de ${empresaNombre}</title>
    </head>
    <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <!-- Encabezado -->
            <div style="background-color: ${headerBg}; padding: 30px 40px; text-align: center; ${headerBorder}">
               ${headerContent}
            </div>
            
            <!-- Contenido -->
            <div style="padding: 40px 40px 30px;">
                <div style="font-size: 16px; color: #4b5563;">
                    ${formattedBody}
                </div>
                
                ${detailsHtml}
                
                <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 25px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                        <strong>Nota:</strong> El documento solicitado se encuentra adjunto a este correo en formato PDF.
                    </p>
                </div>
            </div>
            
            <!-- Pie de página -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    Este es un mensaje automático enviado por el sistema ERP de <strong>${empresaNombre}</strong>.
                </p>
                <p style="margin: 5px 0 0; color: #9ca3af; font-size: 12px;">
                    Por favor no responda directamente a este mensaje si no es necesario.
                </p>
                <p style="margin: 15px 0 0; color: #d1d5db; font-size: 11px;">
                    &copy; ${new Date().getFullYear()} ${empresaNombre}. Todos los derechos reservados.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
};
