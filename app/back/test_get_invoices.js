const { executeQuery } = require('./services/sqlServerClient.cjs');
const { QUERIES, TABLE_NAMES } = require('./services/dbConfig.cjs');

async function testGetInvoices() {
    const dbName = 'orquidea';
    console.log(`Testing GET_FACTURAS in ${dbName}...`);

    try {
        // We need to construct the query similar to invoiceController.js
        // But for testing, we can just run the raw query from QUERIES.GET_FACTURAS
        // However, GET_FACTURAS in dbConfig might have ${TABLE_NAMES} which are already resolved in the string if we require it?
        // No, dbConfig exports the string with resolved table names.

        // Wait, dbConfig.cjs exports QUERIES object where properties are strings with ${TABLE_NAMES...} interpolated AT DEFINITION TIME.
        // So QUERIES.GET_FACTURAS is already a string with table names.

        // But invoiceController.js constructs the query dynamically.
        // Let's copy the query construction from invoiceController.js (simplified)

        const query = `
        SELECT TOP 5
          f.ID as id,
          f.numfact as numeroFactura,
          f.codalm as empresaId,
          f.tipfac as tipoFactura,
          f.codter as clienteId,
          f.doccoc as documentoContable,
          f.fecfac as fechaFactura,
          f.venfac as fechaVencimiento,
          f.codven as vendedorId,
          f.valvta as subtotal,
          f.valiva as ivaValor,
          f.valotr as otrosValores,
          f.valant as anticipos,
          f.valdev as devoluciones,
          f.abofac as abonos,
          f.valdcto as descuentoValor,
          f.valret as retenciones,
          f.valrica as retencionICA,
          f.valriva as retencionIVA,
          f.netfac as total,
          f.valcosto as costo,
          f.codcue as cuenta,
          f.efectivo,
          f.cheques,
          f.credito,
          f.tarjetacr as tarjetaCredito,
          f.TarjetaDB as tarjetaDebito,
          f.Transferencia,
          f.valpagado as valorPagado,
          f.resolucion_dian as resolucionDian,
          f.Observa as observaciones,
          f.TARIFA_CREE as tarifaCREE,
          f.RETECREE as retencionCREE,
          f.codusu as usuarioId,
          f.fecsys as fechaSistema,
          f.estfac as estado,
          f.VALDOMICILIO as valorDomicilio,
          f.estado_envio as estadoEnvio,
          f.sey_key as seyKey,
          f.CUFE as cufe,
          f.IdCaja as cajaId,
          f.Valnotas as valorNotas,
          t.nomter as nombreCliente,
          (SELECT STRING_AGG(r.numero_remision, ', ') FROM ${TABLE_NAMES.remisiones} r WHERE r.factura_id = f.ID) as remisionesNumeros,
          (SELECT STRING_AGG(CAST(r.id AS VARCHAR), ',') FROM ${TABLE_NAMES.remisiones} r WHERE r.factura_id = f.ID) as remisionesIds
        FROM ${TABLE_NAMES.facturas} f
        LEFT JOIN ${TABLE_NAMES.clientes} t ON f.codter = t.codter
        ORDER BY f.fecfac DESC
    `;

        const results = await executeQuery(query, {}, dbName);
        console.log(`Success! Retrieved ${results.length} invoices.`);
        if (results.length > 0) {
            console.log('Sample invoice:', results[0]);
        }
        process.exit(0);

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

testGetInvoices();
