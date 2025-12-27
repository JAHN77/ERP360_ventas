# Resumen de Implementación: Sistema de Email

Se ha implementado un sistema robusto para el envío de cotizaciones en formato PDF directamente desde la aplicación.

### Componentes Creados:
1. **Servicio de Email (`emailService.cjs`)**: Maneja la conexión SMTP y el envío de adjuntos usando `nodemailer`.
2. **Servicio de PDF (`pdfService.cjs`)**: Orquestador que convierte componentes React-PDF en buffers listos para enviar.
3. **Controlador de Cotizaciones (`quoteController.js`)**: Nuevo endpoint `sendQuoteEmail` que integra datos de la DB con la generación de PDF.
4. **Utilidad de Imágenes (`imageUtils.cjs`)**: Conversión de logos a base64 para inclusión correcta en los PDFs.
5. **Interfaz de Usuario**: Botón de envío directo en la tabla y en el modal de previsualización.

### Flujo de Datos:
1. El usuario solicita envío -> `apiClient.sendCotizacionEmail(id, firmaVendedor)`.
2. Backend recibe ID -> Consulta datos de Cotización, Cliente, Vendedor y Empresa.
3. El logo se convierte a base64.
4. Se instancia `CotizacionPDFDocument` con los datos obtenidos.
5. `pdfService` genera un buffer de bytes.
6. `emailService` envía el correo con el buffer como adjunto `.pdf`.
