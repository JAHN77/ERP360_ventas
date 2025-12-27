const nodemailer = require('nodemailer');

// Configuración del transporter (reutilizable)
let transporter = null;

const createTransporter = () => {
  if (transporter) return transporter;

  // Verificar variables de entorno requeridas
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️ Advertencia: Faltan variables de entorno SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS). El envío de correos no funcionará.');
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false // Deshabilitar verificación exigente de certificados (útil en dev)
    }
  });

  return transporter;
};

/**
 * Envia la cotización por correo con el PDF adjunto
 * @param {Object} params 
 * @param {string} params.clienteEmail - Email del destinatario
 * @param {string} params.clienteNombre - Nombre del destinatario
 * @param {string} params.numeroCotizacion - Número de cotización para el asunto
 * @param {Buffer} params.pdfBuffer - Buffer del PDF generado
 */
const sendCotizacionEmail = async ({ clienteEmail, clienteNombre, numeroCotizacion, pdfBuffer, subject, body, quoteDetails }) => {
    try {
        const mailTransporter = createTransporter();
        
        const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
        const companyName = process.env.SMTP_FROM_NAME || 'ERP360';

        // Parse body text to paragraphs if it's plain text
        const messageParagraphs = (body || '').split('\n').filter(p => p.trim()).map(p => `<p style="margin-bottom: 15px;">${p}</p>`).join('');

        const defaultMessage = `
            <p style="margin-bottom: 15px;">Estimado/a <strong>${clienteNombre || 'Cliente'}</strong>,</p>
            <p style="margin-bottom: 15px;">Adjunto encontrará la cotización <strong>#${numeroCotizacion}</strong> solicitada.</p>
            <p style="margin-bottom: 15px;">Si tiene alguna pregunta o necesita información adicional, no dude en contactarnos.</p>
        `;

        const mainMessage = messageParagraphs || defaultMessage;

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 40px; margin-bottom: 40px;">
        <!-- Header -->
        <tr>
            <td style="background-color: #2563eb; padding: 40px 40px; text-align: left;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Cotización ${numeroCotizacion}</h1>
                <p style="color: #bfdbfe; margin: 10px 0 0 0; font-size: 16px;">${companyName}</p>
            </td>
        </tr>

        <!-- Content -->
        <tr>
            <td style="padding: 40px 40px 20px 40px;">
                <div style="color: #334155; font-size: 16px; line-height: 1.6;">
                    ${mainMessage}
                </div>
            </td>
        </tr>

        <!-- Document Details -->
        ${quoteDetails ? `
        <tr>
            <td style="padding: 0 40px 30px 40px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; padding: 20px;">
                    <tr>
                        <td style="padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Total</p>
                            <p style="margin: 5px 0 0 0; font-size: 18px; color: #0f172a; font-weight: bold;">${quoteDetails.total}</p>
                        </td>
                        <td style="padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
                             <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Vence</p>
                            <p style="margin: 5px 0 0 0; font-size: 16px; color: #0f172a;">${quoteDetails.fechaVencimiento}</p>
                        </td>
                    </tr>
                    <tr>
                         <td style="padding-top: 10px;">
                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Fecha Emisión</p>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #334155;">${quoteDetails.fechaCotizacion}</p>
                        </td>
                         <td style="padding-top: 10px;">
                            <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold;">Vendedor</p>
                            <p style="margin: 5px 0 0 0; font-size: 14px; color: #334155;">${quoteDetails.vendedor}</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        ` : ''}

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 14px;">Atentamente,</p>
                <p style="margin: 5px 0 0 0; color: #0f172a; font-weight: bold; font-size: 16px;">Equipo ${companyName}</p>
                
                <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8;">
                    Este es un correo automático, por favor no responder directamente si no es necesario.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'ERP360'}" <${process.env.SMTP_USER}>`,
            to: 'juanandres072004@hotmail.com', // OVERRIDE TEMPORAL SOLICITADO
            // to: clienteEmail, // Original
            subject: subject || `Cotización #${numeroCotizacion} - ${process.env.SMTP_FROM_NAME || 'ERP360'}`,
            html: htmlContent,
            attachments: [
                {
                    filename: `Cotizacion_${numeroCotizacion}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const result = await mailTransporter.sendMail(mailOptions);
        console.log(`✅ Correo enviado a ${clienteEmail}: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error('❌ Error enviando email:', error);
        throw error; // Re-lanzar para que el controlador lo maneje
    }
};

module.exports = {
    sendCotizacionEmail
};
