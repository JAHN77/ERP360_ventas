const { executeQuery, checkTableExists } = require('../services/sqlServerClient.cjs');
const readline = require('readline');

// Definición de esquemas de tablas (SQL)
const TABLE_SCHEMAS = {
    'gen_departamentos': `
    CREATE TABLE gen_departamentos (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
  `,
    'gen_municipios': `
    CREATE TABLE gen_municipios (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        departamento_id INT,
        coddane VARCHAR(10),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        FOREIGN KEY (departamento_id) REFERENCES gen_departamentos(id)
    );
  `,
    'Dian_tipodocumento': `
    CREATE TABLE Dian_tipodocumento (
        id VARCHAR(10) PRIMARY KEY,
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BIT DEFAULT 1
    );
  `,
    'Dian_Regimenes': `
    CREATE TABLE Dian_Regimenes (
        id VARCHAR(10) PRIMARY KEY,
        codigo VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(200) NOT NULL,
        activo BIT DEFAULT 1
    );
  `,
    'inv_medidas': `
    CREATE TABLE inv_medidas (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10) UNIQUE NOT NULL,
        codmed VARCHAR(10) UNIQUE NOT NULL,
        nombre VARCHAR(50) NOT NULL,
        nommed VARCHAR(50) NOT NULL,
        abreviatura VARCHAR(10) NOT NULL,
        activo BIT DEFAULT 1
    );
  `,
    'inv_categorias': `
    CREATE TABLE inv_categorias (
        id INT PRIMARY KEY IDENTITY(1,1),
        codigo VARCHAR(10),
        nombre VARCHAR(100) NOT NULL,
        isreceta BIT DEFAULT 0,
        requiere_empaques BIT DEFAULT 0,
        estado INT DEFAULT 1,
        imgruta VARCHAR(255),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
  `,
    'inv_almacen': `
    CREATE TABLE inv_almacen (
        codalm VARCHAR(3) PRIMARY KEY,
        nomalm VARCHAR(100) NOT NULL,
        diralm VARCHAR(255),
        ciualm VARCHAR(100),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
  `,
    'ven_vendedor': `
    CREATE TABLE ven_vendedor (
        codi_emple VARCHAR(20) PRIMARY KEY,
        cedula VARCHAR(20) UNIQUE NOT NULL,
        nomb_emple VARCHAR(100) NOT NULL,
        NOMB_EMPLE AS nomb_emple,
        codi_labor VARCHAR(20),
        email VARCHAR(100),
        activo BIT DEFAULT 1,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
  `,
    'transportadoras': `
    CREATE TABLE transportadoras (
        id VARCHAR(36) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        nit_identificacion VARCHAR(20),
        activo BIT DEFAULT 1,
        empresa_id INT,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
  `,
    'con_terceros': `
    CREATE TABLE con_terceros (
        id INT PRIMARY KEY IDENTITY(1,1),
        codter VARCHAR(20) UNIQUE NOT NULL,
        tipter INT NOT NULL DEFAULT 1,
        nomter VARCHAR(200) NOT NULL,
        nom1 VARCHAR(50),
        nom2 VARCHAR(50),
        apl1 VARCHAR(50),
        apl2 VARCHAR(50),
        dirter VARCHAR(255),
        TELTER VARCHAR(20),
        CELTER VARCHAR(20),
        EMAIL VARCHAR(100),
        ciudad VARCHAR(100),
        coddane VARCHAR(10),
        codven VARCHAR(20),
        cupo_credito DECIMAL(18,2) DEFAULT 0,
        plazo INT DEFAULT 0,
        tasa_descuento DECIMAL(5,2) DEFAULT 0,
        Forma_pago VARCHAR(50),
        regimen_tributario VARCHAR(100),
        contacto VARCHAR(100),
        activo BIT DEFAULT 1,
        fecing DATETIME DEFAULT GETDATE(),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        FOREIGN KEY (codven) REFERENCES ven_vendedor(codi_emple)
    );
  `,
    'inv_insumos': `
    CREATE TABLE inv_insumos (
        id INT PRIMARY KEY IDENTITY(1,1),
        codins VARCHAR(50) UNIQUE NOT NULL,
        nomins VARCHAR(200) NOT NULL,
        referencia VARCHAR(100),
        codigo_linea VARCHAR(20),
        codigo_sublinea VARCHAR(20),
        Codigo_Medida VARCHAR(10),
        undins VARCHAR(20),
        ultimo_costo DECIMAL(18,2) DEFAULT 0,
        costo_promedio DECIMAL(18,2) DEFAULT 0,
        precio_publico DECIMAL(18,2) DEFAULT 0,
        precio_mayorista DECIMAL(18,2) DEFAULT 0,
        precio_minorista DECIMAL(18,2) DEFAULT 0,
        MARGEN_VENTA DECIMAL(5,2) DEFAULT 0,
        tasa_iva DECIMAL(5,2) DEFAULT 0,
        karins BIT DEFAULT 0,
        activo BIT DEFAULT 1,
        fecsys DATETIME DEFAULT GETDATE(),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME
    );
  `,
    'inv_invent': `
    CREATE TABLE inv_invent (
        id INT PRIMARY KEY IDENTITY(1,1),
        codins VARCHAR(50) NOT NULL,
        codalm VARCHAR(3) NOT NULL,
        ucoins DECIMAL(18,2) DEFAULT 0,
        valinv DECIMAL(18,2) DEFAULT 0,
        ultima_actualizacion DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (codins) REFERENCES inv_insumos(codins),
        FOREIGN KEY (codalm) REFERENCES inv_almacen(codalm),
        UNIQUE (codins, codalm)
    );
  `,
    'ven_cotizacion': `
    CREATE TABLE ven_cotizacion (
        id INT PRIMARY KEY IDENTITY(1,1),
        numcot VARCHAR(50) UNIQUE NOT NULL,
        fecha DATE NOT NULL,
        fecha_vence DATE NOT NULL,
        codter VARCHAR(20) NOT NULL,
        cod_vendedor VARCHAR(20),
        codalm VARCHAR(3) NOT NULL,
        subtotal DECIMAL(18,2) DEFAULT 0,
        val_descuento DECIMAL(18,2) DEFAULT 0,
        val_iva DECIMAL(18,2) DEFAULT 0,
        observa TEXT,
        estado CHAR(1) DEFAULT 'B',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (codter) REFERENCES con_terceros(codter),
        FOREIGN KEY (cod_vendedor) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (codalm) REFERENCES inv_almacen(codalm)
    );
  `,
    'ven_detacotizacion': `
    CREATE TABLE ven_detacotizacion (
        id INT PRIMARY KEY IDENTITY(1,1),
        id_cotizacion INT NOT NULL,
        cod_producto INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        preciound DECIMAL(18,2) NOT NULL,
        tasa_descuento DECIMAL(5,2) DEFAULT 0,
        tasa_iva DECIMAL(5,2) DEFAULT 0,
        valor DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (id_cotizacion) REFERENCES ven_cotizacion(id) ON DELETE CASCADE,
        FOREIGN KEY (cod_producto) REFERENCES inv_insumos(id)
    );
  `,
    'ven_pedidos': `
    CREATE TABLE ven_pedidos (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero_pedido VARCHAR(50) UNIQUE NOT NULL,
        fecha_pedido DATE NOT NULL,
        fecha_entrega_estimada DATE,
        cliente_id VARCHAR(20) NOT NULL,
        vendedor_id VARCHAR(20),
        cotizacion_id INT,
        empresa_id INT,
        subtotal DECIMAL(18,2) DEFAULT 0,
        descuento_valor DECIMAL(18,2) DEFAULT 0,
        iva_valor DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        impoconsumo_valor DECIMAL(18,2) DEFAULT 0,
        observaciones TEXT,
        instrucciones_entrega TEXT,
        estado VARCHAR(20) DEFAULT 'BORRADOR',
        lista_precio_id VARCHAR(50),
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter),
        FOREIGN KEY (vendedor_id) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (cotizacion_id) REFERENCES ven_cotizacion(id)
    );
  `,
    'ven_detapedidos': `
    CREATE TABLE ven_detapedidos (
        id INT PRIMARY KEY IDENTITY(1,1),
        pedido_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        descripcion VARCHAR(255),
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (pedido_id) REFERENCES ven_pedidos(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES inv_insumos(id)
    );
  `,
    'ven_remiciones_enc': `
    CREATE TABLE ven_remiciones_enc (
        id INT PRIMARY KEY IDENTITY(1,1),
        codalm VARCHAR(10),
        numero_remision VARCHAR(50),
        fecha_remision DATE,
        pedido_id INT,
        codter VARCHAR(20),
        codven VARCHAR(20),
        estado VARCHAR(20),
        observaciones VARCHAR(500),
        codusu VARCHAR(20),
        fec_creacion DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (pedido_id) REFERENCES ven_pedidos(id)
    );
  `,
    'ven_remiciones_det': `
    CREATE TABLE ven_remiciones_det (
        id INT PRIMARY KEY IDENTITY(1,1),
        remision_id INT NOT NULL,
        deta_pedido_id INT NULL,
        codins VARCHAR(50),
        cantidad_enviada DECIMAL(18,2) DEFAULT 0,
        cantidad_facturada DECIMAL(18,2) DEFAULT 0,
        cantidad_devuelta DECIMAL(18,2) DEFAULT 0,
        FOREIGN KEY (remision_id) REFERENCES ven_remiciones_enc(id) ON DELETE CASCADE
    );
  `,
    'ven_facturas': `
    CREATE TABLE ven_facturas (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero_factura VARCHAR(50) UNIQUE NOT NULL,
        fecha_factura DATE NOT NULL,
        fecha_vencimiento DATE,
        cliente_id VARCHAR(20) NOT NULL,
        vendedor_id VARCHAR(20),
        remision_id INT,
        pedido_id INT,
        empresa_id INT,
        subtotal DECIMAL(18,2) DEFAULT 0,
        descuento_valor DECIMAL(18,2) DEFAULT 0,
        iva_valor DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        observaciones TEXT,
        estado VARCHAR(20) DEFAULT 'BORRADOR',
        estado_devolucion VARCHAR(20),
        cufe VARCHAR(100),
        fecha_timbrado DATETIME,
        estado_dian VARCHAR(20),
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter),
        FOREIGN KEY (vendedor_id) REFERENCES ven_vendedor(codi_emple),
        FOREIGN KEY (remision_id) REFERENCES ven_remiciones_enc(id),
        FOREIGN KEY (pedido_id) REFERENCES ven_pedidos(id)
    );
  `,
    'ven_detafact': `
    CREATE TABLE ven_detafact (
        id INT PRIMARY KEY IDENTITY(1,1),
        factura_id INT NOT NULL,
        producto_id INT NOT NULL,
        cantidad DECIMAL(18,2) NOT NULL,
        precio_unitario DECIMAL(18,2) NOT NULL,
        descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
        iva_porcentaje DECIMAL(5,2) DEFAULT 0,
        descripcion VARCHAR(255),
        subtotal DECIMAL(18,2) DEFAULT 0,
        valor_iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (factura_id) REFERENCES ven_facturas(id) ON DELETE CASCADE,
        FOREIGN KEY (producto_id) REFERENCES inv_insumos(id)
    );
  `,
    'ven_notas': `
    CREATE TABLE ven_notas (
        id INT PRIMARY KEY IDENTITY(1,1),
        numero VARCHAR(50) UNIQUE NOT NULL,
        factura_id INT NOT NULL,
        cliente_id VARCHAR(20) NOT NULL,
        fecha_emision DATE NOT NULL,
        motivo TEXT NOT NULL,
        subtotal DECIMAL(18,2) DEFAULT 0,
        iva DECIMAL(18,2) DEFAULT 0,
        total DECIMAL(18,2) DEFAULT 0,
        estado_dian VARCHAR(20),
        tipo_nota VARCHAR(20) DEFAULT 'DEVOLUCION',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME,
        created_by INT,
        FOREIGN KEY (factura_id) REFERENCES ven_facturas(id),
        FOREIGN KEY (cliente_id) REFERENCES con_terceros(codter)
    );
  `,
    'archivos_adjuntos': `
    CREATE TABLE archivos_adjuntos (
        id VARCHAR(36) PRIMARY KEY,
        entidad_id VARCHAR(50) NOT NULL,
        entidad_tipo VARCHAR(20) NOT NULL,
        nombre_archivo VARCHAR(255) NOT NULL,
        ruta_storage VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        empresa_id INT,
        created_at DATETIME DEFAULT GETDATE(),
        created_by INT
    );
  `
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log('=====================================================');
    console.log('   MIGRACIÓN MODULAR DE TABLAS ERP360');
    console.log('=====================================================');

    const tables = Object.keys(TABLE_SCHEMAS);
    const status = {};

    // Verificar estado de tablas
    console.log('Verificando estado actual de la base de datos...');
    for (const table of tables) {
        try {
            const exists = await checkTableExists(table);
            status[table] = exists ? 'EXISTE' : 'FALTA';
        } catch (error) {
            status[table] = 'ERROR';
        }
    }

    // Mostrar menú
    while (true) {
        console.log('\nEstado de Tablas:');
        tables.forEach((table, index) => {
            const color = status[table] === 'EXISTE' ? '\x1b[32m' : '\x1b[31m'; // Verde o Rojo
            console.log(`${index + 1}. ${table.padEnd(25)} [${color}${status[table]}\x1b[0m]`);
        });
        console.log('0. Salir');

        const answer = await new Promise(resolve => {
            rl.question('\nSeleccione el número de la tabla a crear (0 para salir): ', resolve);
        });

        const option = parseInt(answer);

        if (option === 0) {
            break;
        }

        if (option > 0 && option <= tables.length) {
            const selectedTable = tables[option - 1];

            if (status[selectedTable] === 'EXISTE') {
                console.log(`\n⚠️  La tabla ${selectedTable} ya existe.`);
                const confirm = await new Promise(resolve => {
                    rl.question('¿Desea recrearla? (Esto borrará los datos) [s/N]: ', resolve);
                });

                if (confirm.toLowerCase() !== 's') {
                    continue;
                }

                // Drop table logic could be added here, but for safety we might skip it or warn heavily
                console.log('Funcionalidad de DROP no implementada por seguridad en este script.');
                continue;
            }

            console.log(`\nCreando tabla ${selectedTable}...`);
            try {
                await executeQuery(TABLE_SCHEMAS[selectedTable]);
                console.log(`✅ Tabla ${selectedTable} creada exitosamente.`);
                status[selectedTable] = 'EXISTE';
            } catch (error) {
                console.error(`❌ Error creando tabla ${selectedTable}:`, error.message);
            }
        } else {
            console.log('Opción inválida.');
        }
    }

    rl.close();
    process.exit(0);
}

main().catch(error => {
    console.error('Error fatal:', error);
    process.exit(1);
});
