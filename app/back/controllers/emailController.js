const { sendGenericEmail } = require('../services/emailService.cjs');

const emailController = {
  sendEmail: async (req, res) => {
    try {
      const { to, subject, body, attachment } = req.body;

      if (!to || !subject) {
        return res.status(400).json({ success: false, message: 'Faltan campos requeridos (to, subject)' });
      }

      let attachments = [];
      if (attachment && attachment.content && attachment.filename) {
        // Convertir base64 a Buffer si es necesario, o enviarlo como string si nodemailer lo soporta
        // Nodemailer soporta base64 string si se pone encoding: 'base64' o si es un buffer.
        // Asumiremos que el frontend envía el contenido en base64 puro (sin data:application/pdf;base64,) o lo limpiaremos.
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

      // Convertir body simple a HTML básico si no es HTML
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
  }
};

module.exports = emailController;
