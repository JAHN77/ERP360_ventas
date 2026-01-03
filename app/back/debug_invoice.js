const { getConnection } = require('./services/sqlServerClient.cjs');

async function run() {
  try {
    const pool = await getConnection();
    console.log("Querying 88xxx invoices...");
    const res = await pool.request().query("SELECT TOP 20 ID, numfact, CUFE, estfac, fecfac FROM ven_facturas WHERE numfact LIKE '88%' ORDER BY numfact DESC");
    console.log(JSON.stringify(res.recordset, null, 2));
    
    console.log("Querying 88994 specific...");
    const resSpecific = await pool.request().query("SELECT ID, numfact, CUFE, estfac FROM ven_facturas WHERE numfact LIKE '%88994%'");
    console.log(JSON.stringify(resSpecific.recordset, null, 2));

  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

run();
