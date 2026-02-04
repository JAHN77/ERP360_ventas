const { executeQuery } = require('../services/sqlServerClient.cjs');

async function checkClient() {
    try {
        const searchVal = '73611';
        console.log(`Searching for client with value: ${searchVal}`);

        const query = `
      SELECT id, codter, nomter, codven 
      FROM con_terceros 
      WHERE id = ${searchVal} 
         OR codter LIKE '%${searchVal}%'
    `;

        const result = await executeQuery(query);
        console.table(result);
    } catch (error) {
        console.error('Error checking client:', error);
    } finally {
        process.exit();
    }
}

checkClient();
