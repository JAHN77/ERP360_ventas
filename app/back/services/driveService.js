const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
require('dotenv').config();

// Configuración de OAuth2
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
);

// Establecer credenciales (Refresh Token es clave para acceso offline)
if (process.env.GOOGLE_REFRESH_TOKEN) {
    oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
} else {
    console.warn('⚠️ Advertencia: No se encontró GOOGLE_REFRESH_TOKEN. La integración con Drive no funcionará.');
}

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const driveService = {
    /**
     * Obtiene el ID de la carpeta raíz "Archivos ERP-360".
     * Si está en .env, usa ese. Si no, busca la carpeta. Si no existe, la crea.
     */
    async getRootFolderId() {
        // 1. Si ya tenemos el ID en variables de entorno, usarlo (lo más rápido)
        if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
            return process.env.GOOGLE_DRIVE_FOLDER_ID;
        }

        const folderName = 'Archivos ERP-360';
        
        try {
            // 2. Buscar si existe
            const res = await drive.files.list({
                q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            if (res.data.files.length > 0) {
                console.log(`Carpeta '${folderName}' encontrada: ${res.data.files[0].id}`);
                return res.data.files[0].id;
            }

            // 3. Si no existe, crearla
            console.log(`Carpeta '${folderName}' no encontrada. Creando...`);
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
            };
            const file = await drive.files.create({
                resource: fileMetadata,
                fields: 'id',
            });
            console.log(`Carpeta creada con ID: ${file.data.id}`);
            return file.data.id;

        } catch (error) {
            console.error('Error obteniendo carpeta raíz de Drive:', error);
            throw error;
        }
    },

    /**
     * Busca o crea una subcarpeta dentro de un padre específico
     */
    async findOrCreateFolder(folderName, parentId) {
        try {
            const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and '${parentId}' in parents and trashed=false`;
            const res = await drive.files.list({
                q: query,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            if (res.data.files.length > 0) {
                return res.data.files[0].id;
            }

            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            };
            const file = await drive.files.create({
                resource: fileMetadata,
                fields: 'id',
            });
            return file.data.id;
        } catch (error) {
            console.error(`Error buscando/creando carpeta ${folderName}:`, error);
            throw error;
        }
    },

    /**
     * Asegura la estructura de carpetas: Raíz -> Tipo -> Año -> Mes
     */
    async ensureHierarchy(docType, dateObj) {
        const rootId = await this.getRootFolderId();
        
        // 1. Carpeta Tipo (Cotizaciones, Facturas, etc.)
        const typeFolderId = await this.findOrCreateFolder(docType, rootId);

        // 2. Carpeta Año
        const year = dateObj.getFullYear().toString();
        const yearFolderId = await this.findOrCreateFolder(year, typeFolderId);

        // 3. Carpeta Mes (01, 02, etc.)
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const monthFolderId = await this.findOrCreateFolder(month, yearFolderId);

        return monthFolderId;
    },

    /**
     * Sube un archivo a Drive
     * @param {string} fileName Nombre del archivo
     * @param {string} mimeType Tipo MIME (application/pdf)
     * @param {Buffer} fileBuffer Buffer del archivo
     * @param {string} folderId ID de la carpeta destino
     */
    async uploadFile(fileName, mimeType, fileBuffer, folderId, replace = false) {
        try {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);

            const media = {
                mimeType: mimeType,
                body: bufferStream,
            };

            // 1. Verificar si el archivo ya existe
            const q = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
            const existingFiles = await drive.files.list({
                q: q,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            const existingFile = existingFiles.data.files[0];

            if (existingFile) {
                if (!replace) {
                    // Si existe y no queremos reemplazar, lanzamos error específico
                    const error = new Error('El archivo ya existe');
                    error.code = 'FILE_EXISTS';
                    error.fileId = existingFile.id;
                    throw error;
                }

                // Si existe y queremos reemplazar (UPDATE)
                console.log(`Reemplazando archivo existente: ${fileName} (${existingFile.id})`);
                const updatedFile = await drive.files.update({
                    fileId: existingFile.id,
                    media: media,
                    fields: 'id, webViewLink, webContentLink',
                });
                return updatedFile.data;
            }

            // 2. Si no existe, crear (CREATE)
            const fileMetadata = {
                name: fileName,
                parents: [folderId],
            };

            const file = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id, webViewLink, webContentLink',
            });

            console.log(`Archivo subido exitosamente: ${fileName} (${file.data.id})`);
            return file.data;
        } catch (error) {
            console.error('Error subiendo/actualizando archivo a Drive:', error);
            throw error;
        }
    }
};

module.exports = driveService;
