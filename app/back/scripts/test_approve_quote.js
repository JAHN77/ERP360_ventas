const quoteController = require('../controllers/quoteController');
const { closeConnection } = require('../services/sqlServerClient.cjs');

// Mock request/response
const req = {
    params: { id: '000011' }, // Use the quote we created in previous test
    body: {
        estado: 'APROBADA'
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
        console.log('Testing updateQuote (Approval)...');
        await quoteController.updateQuote(req, res);
    } catch (e) {
        console.error('Script Error:', e);
    } finally {
        await closeConnection();
        process.exit();
    }
})();
