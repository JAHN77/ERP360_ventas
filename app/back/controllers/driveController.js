const driveService = require('../services/driveService');

const driveController = {
    archiveDocument: async (req, res) => {
        try {
            const { type, number, date, recipientName, fileBase64 } = req.body;

            if (!fileBase64 || !type || !number) {
                return res.status(400).json({ error: 'Faltan datos requeridos (fileBase64, type, number)' });
            }

            console.log(`📥 Iniciando archivo en Drive: ${type} #${number} para ${recipientName}`);

            // 1. Decodificar Base64 a Buffer
            const fileBuffer = Buffer.from(fileBase64, 'base64');

            // 2. Preparar metadatos
            // Mapear tipos a nombres de carpetas amigables
            const folderMap = {
                'cotizacion': 'Cotizaciones',
                'pedido': 'Pedidos',
                'remision': 'Remisiones',
                'factura': 'Facturas',
                'nota_credito': 'NotasCredito'
            };
            const folderName = folderMap[type] || 'Otros';
            
            // Parsear fecha, fallback a hoy si no es válida
            const dateObj = date ? new Date(date) : new Date();

            // 3. Crear nombre de archivo seguro
            const safeRecipient = (recipientName || 'SinNombre').replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${ folderName.slice(0,3).toUpperCase() }-${number}-${safeRecipient}.pdf`;

            // 4. Asegurar estructura de carpetas (Tipo -> Año -> Mes)
            const targetFolderId = await driveService.ensureHierarchy(folderName, dateObj);

            // 5. Subir archivo
            const replace = req.body.replace === true; // Asegurar booleano
            const result = await driveService.uploadFile(fileName, 'application/pdf', fileBuffer, targetFolderId, replace);

            res.json({
                success: true,
                message: 'Documento archivado correctamente',
                driveId: result.id,
                link: result.webViewLink
            });

        } catch (error) {
            if (error.code === 'FILE_EXISTS') {
                return res.status(409).json({
                    success: false,
                    error: 'El archivo ya existe',
                    code: 'FILE_EXISTS',
                    fileId: error.fileId
                });
            }

            console.error('❌ Error en driveController.archiveDocument:', error);
            res.status(500).json({ 
                error: 'Error interno al archivar documento', 
                details: error.message 
            });
        }
    }
};

module.exports = driveController;
