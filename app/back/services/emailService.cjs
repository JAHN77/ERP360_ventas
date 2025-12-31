const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getCompanyLogo } = require('../utils/imageUtils.cjs');

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
 * Genera una plantilla de correo profesional
 */
const getProfessionalEmailTemplate = ({ 
    title, 
    subtitle, 
    mainMessage, 
    processSteps, 
    detailsGrid, 
    companyName,
    logoCid // ID del logo embebido
}) => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f8;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f8; padding: 20px 0;">
        <tr>
            <td align="center">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 25px 20px; text-align: center;">
                            ${logoCid 
                                ? `<img src="cid:${logoCid}" alt="${companyName}" style="max-width: 240px; max-height: 100px; object-fit: contain; margin-bottom: 5px;">` 
                                : `<h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">${title}</h1>`
                            }
                            ${!logoCid && subtitle ? `<p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 16px; font-weight: 500;">${subtitle}</p>` : ''}
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 40px 20px 40px;">
                            <div style="color: #334155; font-size: 16px; line-height: 1.6;">
                                ${mainMessage}
                            </div>
                        </td>
                    </tr>

                    <!-- Details Grid (Antes de Process Steps) -->
                    ${detailsGrid ? `
                    <tr>
                        <td style="padding: 0 40px 30px 40px;">
                            <p style="margin: 0 0 15px 0; color: #1e40af; font-size: 16px; font-weight: 600;">Detalles del documento:</p>
                            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                                ${detailsGrid}
                            </table>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Process Info / Specific Text -->
                    ${processSteps ? `
                    <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 20px;">
                                <div style="color: #1e3a8a; font-size: 14px; line-height: 1.5;">
                                    ${processSteps}
                                </div>
                            </div>
                        </td>
                    </tr>
                    ` : ''}
                    
                    <!-- Footer Message -->
                     <tr>
                        <td style="padding: 0 40px 20px 40px;">
                            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                                Puede descargar el documento oficial en el archivo adjunto a este correo. Quedamos atentos a cualquier duda o requerimiento adicional.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 30px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #64748b; font-size: 14px;">Atentamente,</p>
                            <p style="margin: 5px 0 0 0; color: #0f172a; font-weight: bold; font-size: 16px;">El Equipo de ${companyName}</p>
                            
                            <div style="margin-top: 20px; border-top: 1px solid #cbd5e1; width: 40px; display: inline-block;"></div>

                            <p style="margin: 20px 0 0 0; font-size: 12px; color: #94a3b8;">
                                Este es un correo automático generado por ERP360. Por favor no responder directamente a menos que se indique lo contrario.
                            </p>
                            <p style="margin-top: 10px; font-size: 12px; color: #94a3b8; text-align: center;">
                                &copy; ${new Date().getFullYear()} ${companyName}. Todos los derechos reservados.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
};



/**
 * Envia un correo genérico con soporte para adjuntos
 */
const sendGenericEmail = async ({ to, subject, html, attachments = [] }) => {
    try {
        const mailTransporter = createTransporter();
        const mailOptions = {
            from: `"${process.env.SMTP_FROM_NAME || 'ERP360'}" <${process.env.SMTP_USER}>`,
            to: to,
            subject: subject,
            html: html,
            attachments: attachments
        };

        const result = await mailTransporter.sendMail(mailOptions);
        console.log(`✅ Correo enviado a ${to}: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
    } catch (error) {
        console.error('❌ Error enviando email genérico:', error);
        throw error;
    }
};

/**
 * Envia un documento (Cotización, Pedido, Factura, etc.) por correo con plantilla profesional
 */
const sendDocumentEmail = async ({ 
    to, 
    customerName, 
    documentNumber, 
    documentType = 'Documento', 
    pdfBuffer, 
    subject, 
    body, // Mensaje personalizado opcional, si se usa reemplaza el saludo estándar
    documentDetails,
    processSteps 
}) => {
    try {
        const mailTransporter = createTransporter();
        const companyName = process.env.SMTP_FROM_NAME || 'ERP360';
        
        // 1. Asunto Estándar: [TIPO] No. [000] | [EMPRESA] - [CLIENTE]
        const finalSubject = subject || `${documentType} No. ${documentNumber} | ${companyName} - ${customerName}`;
        const title = `${documentType} No. ${documentNumber}`;

        // 2. Mensaje Principal Estándar
        const defaultMessage = `
            <p>Estimado/a <strong>${customerName || 'Cliente'}</strong>:</p>
            <p>Reciba un cordial saludo de parte del equipo de <strong>${companyName}</strong>.</p>
            <p>En seguimiento a nuestra gestión comercial, le hacemos entrega de la <strong>${documentType}</strong> adjunta.</p>
        `;

        const mainMessage = body 
            ? body.split('\n').filter(p => p.trim()).map(p => `<p style="margin-bottom: 15px;">${p}</p>`).join('')
            : defaultMessage;

        // 3. Grid de detalles
        let detailsGrid = '';
        if (documentDetails && Array.isArray(documentDetails)) {
             // Construir grid de 2 columnas dinámica
             let rows = '';
             for (let i = 0; i < documentDetails.length; i += 2) {
                 const item1 = documentDetails[i];
                 const item2 = documentDetails[i + 1];
                 
                 rows += `
                    <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; width: 50%; vertical-align: top;">
                            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">${item1.label}</p>
                            <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a; font-weight: 600;">${item1.value}</p>
                        </td>
                        ${item2 ? `
                        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; width: 50%; vertical-align: top;">
                            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">${item2.label}</p>
                            <p style="margin: 4px 0 0 0; font-size: 16px; color: #0f172a; font-weight: 600;">${item2.value}</p>
                        </td>
                        ` : '<td style="width: 50%;"></td>'}
                    </tr>
                 `;
             }
             detailsGrid = rows;
        }



        // Asegurar que pdfBuffer es Buffer y Validar Header PDF
        let finalAttachment;
        
        if (Buffer.isBuffer(pdfBuffer)) {
            finalAttachment = pdfBuffer;
        } else if (typeof pdfBuffer === 'string') {
            console.log(`🔍 Recibido PDF String (inicio): ${pdfBuffer.substring(0, 50)}...`);
            
            // Limpieza robusta de prefijos Data URI
            let base64Data = pdfBuffer
                .replace(/^data:application\/pdf;base64,/, "")
                .replace(/^data:application\/octet-stream;base64,/, "")
                .replace(/^data:;base64,/, ""); // A veces viene sin mime type
            
            // Eliminar espacios en blanco que puedan corromper
            base64Data = base64Data.trim();
            
            finalAttachment = Buffer.from(base64Data, 'base64');
        }

        // Validación de Cabecera PDF (%PDF-)
        if (finalAttachment) {
            const header = finalAttachment.toString('utf8', 0, 5); // Leer primeros 5 caracteres
            console.log(`📄 Check PDF Header: '${header}' (${finalAttachment.length} bytes)`);
            
            if (!header.startsWith('%PDF-')) {
                 console.warn('⚠️ ALERTA: El adjunto no parece ser un PDF válido (Header incorrecto). Posible corrupción.');
            }
        } else {
            if (pdfBuffer) console.warn('⚠️ pdfBuffer no se pudo convertir a Buffer válido');
        }

        // Preparar adjuntos (PDF + Logo)
        const attachments = [];
        let logoCid = null;

        // 1. Adjuntar Logo (CID)
        const logoPath = path.join(process.cwd(), 'public/assets/images.png');
        try {
            if (require('fs').existsSync(logoPath)) {
                attachments.push({
                    filename: 'logo.png',
                    path: logoPath,
                    cid: 'companyLogo' // ID único para referenciar en el HTML
                });
                logoCid = 'companyLogo';
            }
        } catch (err) {
            console.warn('⚠️ No se pudo adjuntar el logo:', err.message);
        }

        // 2. Adjuntar PDF
        if (finalAttachment) {
            attachments.push({
                filename: `${documentType}_${documentNumber}.pdf`,
                content: finalAttachment,
                contentType: 'application/pdf',
                encoding: 'base64' // Asegurar encoding explícito
            });
        }

        const htmlContent = getProfessionalEmailTemplate({
            title,
            subtitle: companyName,
            mainMessage,
            processSteps,
            detailsGrid,
            companyName,
            logoCid // Pasar el CID del logo
        });

        const mailOptions = {
            from: `"${companyName}" <${process.env.SMTP_USER}>`,
            to: to,
            subject: finalSubject,
            html: htmlContent,
            attachments: attachments
        };

        const result = await mailTransporter.sendMail(mailOptions);
        console.log(`✅ Correo (${documentType}) enviado a ${to}: ${result.messageId}`);
        return { success: true, messageId: result.messageId };

    } catch (error) {
        console.error(`❌ Error enviando email de ${documentType}:`, error);
        throw error;
    }
};

module.exports = {
    sendGenericEmail,
    sendDocumentEmail
};
