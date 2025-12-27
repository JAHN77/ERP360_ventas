const React = require('react');
const { renderToStream } = require('@react-pdf/renderer');
const CotizacionPDFDocument = require('./pdf/CotizacionPDFDocument.cjs');

/**
 * Genera el stream del PDF de una cotización
 * @param {Object} data - Datos necesarios para el PDF (cotizacion, cliente, vendedor, empresa)
 * @returns {Promise<NodeJS.ReadableStream>}
 */
const generateQuotePdfStream = async (data) => {
    try {
        const doc = React.createElement(CotizacionPDFDocument, data);
        return await renderToStream(doc);
    } catch (error) {
        console.error('❌ Error rendering PDF to stream:', error);
        throw error;
    }
};

/**
 * Genera el buffer de un PDF de cotización
 * @param {Object} data 
 * @returns {Promise<Buffer>}
 */
const generateQuotePdfBuffer = async (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const stream = await generateQuotePdfStream(data);
            const chunks = [];
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', (err) => reject(err));
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    generateQuotePdfStream,
    generateQuotePdfBuffer
};
