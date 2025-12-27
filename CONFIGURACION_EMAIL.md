# Documentación Técnica: Configuración de Email

Esta sección detalla cómo funciona el backend de envío de correos y los requisitos técnicos.

## Requisitos
- Node.js en el backend.
- Dependencias: `nodemailer`, `@react-pdf/renderer`, `react`.

## Estructura de Archivos (Backend)
- `app/back/services/emailService.cjs`: Configuración del transporter.
- `app/back/services/pdfService.cjs`: Renderizado de componentes React a Buffer.
- `app/back/services/pdf/pdfTheme.cjs`: Estilos compartidos (Slate, Helvetica).
- `app/back/services/pdf/CotizacionPDFDocument.cjs`: Estructura del documento PDF.

## Variables de Entorno Requeridas
| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SMTP_HOST` | Servidor de correo | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario de correo | `ventas@empresa.com` |
| `SMTP_PASS` | Contraseña | `xxxx xxxx xxxx xxxx` |
| `SMTP_SECURE`| Usar TLS/SSL | `false` para 587, `true` para 465 |

## Notas sobre Gmail
Gmail requiere el uso de **Contraseñas de Aplicación**. 
1. Ve a tu Cuenta de Google.
2. Seguridad -> Verificación en 2 pasos.
3. Al final, selecciona "Contraseñas de aplicación".
4. Genera una para "Correo" en "Otro (ERP360)".
5. Usa los 16 caracteres generados como tu `SMTP_PASS`.
