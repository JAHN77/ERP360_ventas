const quoteController = require('../controllers/quoteController');
const { closeConnection } = require('../services/sqlServerClient.cjs');

const req = {
    body: {
        clienteId: '222222222',
        fechaCotizacion: new Date(),
        vendedorId: '001',
        empresaId: '001',
        // Simulate potential frontend payload structure
        items: [
            {
                productoId: 41574,
                codProducto: '01010001',
                descripcion: 'Test Product with potentially long description or weird chars',
                cantidad: 1.5,
                precioUnitario: 1000.55,
                descuentoPorcentaje: 10, // Check if this passes now
                ivaPorcentaje: 19,
                total: 1190,
                codigoMedida: 'UND'
            }
        ],
        subtotal: 1000,
        descuentoValor: 100,
        ivaValor: 171,
        formaPago: 'Credit', // Test text mapping
        observaciones: 'Test creation from script with new logging'
    },
    db_name: null // Use default
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
        console.log('Testing createQuote with logging...');
        await quoteController.createQuote(req, res);
    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        await closeConnection();
        process.exit();
    }
})();
