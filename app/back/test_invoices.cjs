const invoiceController = require('./controllers/invoiceController.js');

const req = {
    query: {
        page: '1',
        pageSize: '10'
    },
    db_name: 'CicleBike' // Mocking req.db_name
};

const res = {
    json: (data) => console.log(JSON.stringify(data, null, 2)),
    status: (code) => {
        console.log('Status:', code);
        return res;
    }
};

invoiceController.getAllInvoices(req, res).catch(err => console.error(err));
