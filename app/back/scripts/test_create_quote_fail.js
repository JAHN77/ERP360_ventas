const quoteController = require('../controllers/quoteController');
const { closeConnection } = require('../services/sqlServerClient.cjs');

const req = {
    body: {
        clienteId: '222222222',
        fechaCotizacion: "INVALID-DATE-STRING",
        items: [
            {
                productoId: 41574,
                codProducto: '01010001',
                descripcion: 'Test Product',
                cantidad: 1,
                precioUnitario: 1000,
                descuentoPorcentaje: 100, // This should trigger the new error
                ivaPorcentaje: 19,
                total: 0,
                codigoMedida: 'UND'
            }
        ],
        subtotal: 1000
    },
    db_name: null
};

const res = {
    status: (code) => {
        console.log(`Status: ${code}`);
        return res;
    },
    json: (data) => {
        console.log('Response:', JSON.stringify(data, null, 2));
    }
};

(async () => {
    try {
        console.log('Testing createQuote with LIMIT EXCEEDED payload...');
        await quoteController.createQuote(req, res);
    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        await closeConnection();
        process.exit();
    }
})();
