const fs = require('fs');
const path = require('path');

/**
 * Convierte una imagen en un Data URL base64
 * @param {string} relativePath - Ruta relativa desde la raíz del backend (o absoluta)
 * @returns {string|null} - Data URL en formato 'data:image/png;base64,...' o null si falla
 */
const getImageAsBase64 = (relativePath) => {
  try {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    
    if (!fs.existsSync(absolutePath)) {
      console.warn(`⚠️ Archivo de imagen no encontrado: ${absolutePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const ext = path.extname(absolutePath).toLowerCase().replace('.', '');
    const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    
    const base64Image = fileBuffer.toString('base64');
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error(`❌ Error convirtiendo imagen a base64 (${relativePath}):`, error);
    return null;
  }
};

/**
 * Obtiene el logo de la empresa por defecto
 */
const getCompanyLogo = () => {
  return getImageAsBase64('public/assets/images.png');
};

module.exports = {
  getImageAsBase64,
  getCompanyLogo
};
