const quoteController = require('../controllers/quoteController');
const { closeConnection } = require('../services/sqlServerClient.cjs');

const req = {
    body: {
        clienteId: 73611, // Numeric ID that was failing before
        fechaCotizacion: new Date().toISOString(),
        items: [
            {
                productoId: 41574,
                codProducto: '01010001',
                descripcion: 'Test Product',
                cantidad: 1,
                precioUnitario: 1000,
                descuentoPorcentaje: 0,
                ivaPorcentaje: 19,
                total: 1190,
                codigoMedida: 'UND'
            }
        ],
        subtotal: 1000,
        formaPago: '1',
        observaciones: 'Test from script with ID lookup'
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
        console.log('Testing createQuote with NUMERIC CLIENT ID...');
        await quoteController.createQuote(req, res);
    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        await closeConnection();
        process.exit();
    }
})();
