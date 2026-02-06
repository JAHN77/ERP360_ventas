const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'M0b1l$2026&yvK@',
    server: process.env.DB_SERVER || '179.33.214.87',
    port: parseInt(process.env.DB_PORT) || 1537,
    database: 'CicleBike',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function testSP() {
    try {
        console.log('Connecting to DB...');
        let pool = await sql.connect(config);
        console.log('Connected.');

        const request = new sql.Request(pool);

        const pagosJson = JSON.stringify([{
            DETAPAGO: {
                formapago: 'EF',
                valor: 874.29,
                fecha: '2026-02-05',
                nombre: 'EFECTIVO',
                bco: '90',
                cheque: '',
                franquicia: '',
                codcue: ''
            }
        }]);

        const detalleJson = JSON.stringify([{
            detalle_fac: {
                numped: '',
                codins: '02020769',
                undvta: 'UND',
                factor: 1,
                cantidad: 1,
                codalm: '001',
                preciound: 734.7,
                valunitario: 734.7,
                precio_base: 734.7,
                precio_lista: 734.7,
                costo_unidad: 0,
                tasa_iva: 19,
                valor_iva: 139.59,
                valor_parcial: 734.7,
                codmedida_vta: 'UND',
                qtyvta: 1,
                cosvta: 0,
                tasa_descuento: 0,
                codusuario: 'SISTEMA',
                base_retencion: 0,
                tasa_retencion: 0,
                valdescuento: 0,
                totdescuento: 0,
                excedente: 0,
                tasa_reteica: 0,
                tasa_reteiva: 0
            }
        }]);

        request.input('codalm', sql.Char(3), '001');
        request.input('codter', sql.VarChar(15), '27005494');
        request.input('fecha', sql.DateTime, new Date());
        request.input('codven', sql.Char(3), '001');
        request.input('tipfac', sql.Char(2), 'FV');
        request.input('subtotal', sql.Numeric(18, 2), 734.7);
        request.input('Totdescuento', sql.Numeric(18, 2), 0);
        request.input('total_iva', sql.Numeric(18, 2), 139.59);
        request.input('anticipo_aplicado', sql.Numeric(18, 2), 0);
        request.input('valdomicilio', sql.Numeric(18, 0), 0);
        request.input('total_factura', sql.Numeric(18, 2), 874.29);
        request.input('Aplicar_Retencion', sql.Bit, 0);
        request.input('codusu', sql.Char(10), 'SISTEMA');
        request.input('codigo_dian', sql.Char(2), '09');
        request.input('clase', sql.Char(2), 'FE');
        request.input('venfac', sql.DateTime, new Date());
        request.input('valcosto', sql.Numeric(18, 2), 0);
        request.input('valret', sql.Numeric(18, 2), 0);
        request.input('Tasaret', sql.Numeric(5, 2), 0);
        request.input('valrica', sql.Numeric(12, 0), 0);
        request.input('valriva', sql.Numeric(12, 0), 0);
        request.input('observa', sql.VarChar(150), 'Test Debug');
        request.input('Lugar_Entrega', sql.NVarChar(50), 'Test Address');
        request.input('orden', sql.NVarChar(10), '');
        request.input('codtar', sql.VarChar(2), '01');
        request.input('pagos', sql.NVarChar(sql.MAX), pagosJson);
        request.input('DETALLE', sql.NVarChar(sql.MAX), detalleJson);

        console.log('Executing SP...');
        const result = await request.execute('Sp_Grabar_Factura_Venta');
        console.log('Result:', JSON.stringify(result, null, 2));

    } catch (err) {
        console.error('Error Details:', err);
        if (err.precedingErrors) {
            console.error('Preceding Errors:', err.precedingErrors);
        }
    } finally {
        sql.close();
    }
}

testSP();
