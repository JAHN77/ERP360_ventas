const fs = require('fs');
const path = require('path');

let cachedCiiuList = null;

const loadCiiuData = () => {
    if (cachedCiiuList) return cachedCiiuList;

    const filePath = path.join(__dirname, '../data/CIIU.json');

    try {
        if (!fs.existsSync(filePath)) {
            console.warn('CIIU.json not found at:', filePath);
            return [];
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        const flattened = [];

        // Traverse the nested structure
        // Structure: { "A": { "divisiones": { "01": { "subdivisiones": { "011": { "actividades": { "0111": "Description" } } } } } } }

        Object.values(data).forEach(section => {
            if (!section.divisiones) return;

            Object.values(section.divisiones).forEach(division => {
                if (!division.subdivisiones) return;

                Object.values(division.subdivisiones).forEach(subdivision => {
                    if (!subdivision.actividades) return;

                    Object.entries(subdivision.actividades).forEach(([codigo, nombre]) => {
                        flattened.push({
                            codigo,
                            nombre
                        });
                    });
                });
            });
        });

        cachedCiiuList = flattened;
        console.log(`Loaded ${flattened.length} CIIU codes from file.`);
        return flattened;

    } catch (error) {
        console.error('Error loading CIIU data:', error);
        return [];
    }
};

const searchCiiu = (term) => {
    const list = loadCiiuData();
    if (!term || !term.trim()) return list.slice(0, 20);

    const lowerTerm = term.toLowerCase().trim();
    // Simple inclusion search
    return list.filter(item =>
        item.codigo.includes(lowerTerm) ||
        item.nombre.toLowerCase().includes(lowerTerm)
    );
};

module.exports = {
    loadCiiuData,
    searchCiiu
};
