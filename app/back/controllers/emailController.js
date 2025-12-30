const { sendGenericEmail } = require('../services/emailService.cjs');

const emailController = {
  sendEmail: async (req, res) => {
    // ... existing logic ... (keep it identical)
    try {
      const { to, subject, body, attachment } = req.body;
      console.log('DEBUG Email Body:', body ? body.substring(0, 50) : 'No body');
      if (body) console.log('DEBUG Body trim starts with <:', body.trim().startsWith('<'));

      if (!to || !subject) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos (to, subject)' });
      }

      let attachments = [];
      if (attachment && attachment.content && attachment.filename) {
        let content = attachment.content;
        if (typeof content === 'string' && content.startsWith('data:')) {
            content = content.split(',')[1];
        }
        
        attachments.push({
          filename: attachment.filename,
          content: content,
          encoding: 'base64',
          contentType: 'application/pdf'
        });
      }

      let htmlContent = body;
      if (!body.trim().startsWith('<')) {
        htmlContent = `
          <div style="font-family: Arial, sans-serif; color: #333;">
            <p>${body.replace(/\n/g, '<br>')}</p>
            <br>
            <hr>
            <p style="font-size: 12px; color: #777;">Enviado desde ERP360</p>
          </div>
        `;
      }

      const result = await sendGenericEmail({
        to,
        subject,
        html: htmlContent,
        attachments
      });

      res.json({
        success: true,
        message: 'Correo enviado correctamente',
        messageId: result.messageId
      });

    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({
        success: false,
        message: 'Error enviando el correo',
        error: error.message
      });
    }
  },

  sendCreditNoteEmail: async (req, res) => {
    try {
      const { id, to, body, pdfBase64, customerName } = req.body;

      if (!to || !pdfBase64) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos (to, pdfBase64)' });
      }

      const { sendDocumentEmail } = require('../services/emailService.cjs');

      const result = await sendDocumentEmail({
        to,
        customerName: customerName || 'Cliente',
        documentNumber: id,
        documentType: 'Nota de Crédito',
        pdfBuffer: pdfBase64,
        subject: req.body.subject, // Optional, sendDocumentEmail generates one if missing
        body: body // Optional custom message
      });

      res.json({
        success: true,
        message: 'Nota de crédito enviada correctamente',
        messageId: result.messageId
      });
    } catch (error) {
      console.error('Error sending credit note email:', error);
      res.status(500).json({
        success: false,
        message: 'Error enviando nota de crédito',
        error: error.message
      });
    }
  }
};

module.exports = emailController;
