const sql = require('mssql');
require('dotenv').config({ path: './.env' });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function checkData() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT TOP 5 * FROM gen_movimiento_notas WHERE consecutivo = 99999 ORDER BY id DESC
    `;
    
    console.log('--- NOTAS (gen_movimiento_notas) ---');
    console.log(result.recordset);

    if (result.recordset.length > 0) {
      const notaId = result.recordset[0].id;
      const consecutivo = result.recordset[0].consecutivo;
      const comprobante = result.recordset[0].comprobante;

      console.log(`\nChecking Ven_Devolucion for id_nota=${notaId}, Numdev=${consecutivo}, comprobante='${comprobante}'`);
      
      const detailsById = await sql.query`SELECT * FROM Ven_Devolucion WHERE id_nota = ${notaId}`;
      console.log(`By id_nota (${notaId}): ${detailsById.recordset.length} rows`);
      if (detailsById.recordset.length > 0) console.log(detailsById.recordset[0]);

      const detailsByNumdev = await sql.query`SELECT * FROM Ven_Devolucion WHERE Numdev = ${consecutivo}`;
      console.log(`By Numdev (${consecutivo}): ${detailsByNumdev.recordset.length} rows`);
      
      const detailsByComprobante = await sql.query`SELECT * FROM Ven_Devolucion WHERE comprobante = ${comprobante}`;
      console.log(`By comprobante ('${comprobante}'): ${detailsByComprobante.recordset.length} rows`);

       // Check inv_insumos join
       if (detailsById.recordset.length > 0) {
           const codins = detailsById.recordset[0].Codins;
           console.log(`\nChecking inv_insumos for codins='${codins}'`);
           const product = await sql.query`SELECT * FROM inv_insumos WHERE codins = ${codins}`;
           console.log(`Direct match: ${product.recordset.length} rows`);
           
           const productTrim = await sql.query`SELECT * FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(${codins}))`;
           console.log(`Trim match: ${productTrim.recordset.length} rows`);
       }
    } else {
        console.log('No note found with consecutivo 99999');
        // List recent notes
        const recent = await sql.query`SELECT TOP 5 * FROM gen_movimiento_notas ORDER BY id DESC`;
        console.log('Recent notes:', recent.recordset.map(r => ({id: r.id, consecutivo: r.consecutivo})));
    }

  } catch (err) {
    console.error('SQL Error:', err);
  } finally {
    await sql.close();
  }
}

checkData();
