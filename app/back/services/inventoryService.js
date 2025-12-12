const sql = require('mssql');
const { TABLE_NAMES } = require('./dbConfig.cjs');

/**
 * Servicio para manejar operaciones de inventario y Kardex
 */
const InventoryService = {
  
  /**
   * Registra una salida de inventario
   * @param {object} params
   * @param {sql.Transaction} params.transaction - Transacción SQL activa
   * @param {number} params.productoId - ID del producto
   * @param {number} params.cantidad - Cantidad a descontar
   * @param {string|number} params.bodega - Código de bodega (default '001')
   * @param {number} params.numeroDocumentoInt - Número de documento (INT) para dockar
   * @param {string} params.tipoMovimiento - 'SA' (Salida)
   * @param {number} params.precioVenta - Precio de venta unitario (Transacción)
   * @param {number} params.precioBase - Precio base calculado (Lista 07 / (1+IVA)) para venkar
   * @param {number} params.costo - Costo unitario (Promedio) para coskar y valinv
   * @param {string} params.observaciones - Observaciones
   * @param {string} params.codUsuario - Código de usuario
   * @param {string|number} params.clienteId - Código del cliente
   * @param {number} params.numRemision - Número numérico de remisión (opcional)
   * @param {number} params.numComprobante - Número numérico de comprobante (opcional)
   */
  registrarSalida: async ({
    transaction,
    productoId,
    cantidad,
    bodega = '001',
    numeroDocumentoInt,
    tipoMovimiento = 'SA',
    precioVenta = 0,
    precioBase = 0, // Nuevo parámetro para venkar
    costo = null,
    observaciones = '',
    codUsuario = 'SISTEMA',
    clienteId = '',
    numRemision = 0,
    numComprobante = 0
  }) => {
    try {
      if (!transaction) throw new Error('Se requiere una transacción activa para movimientos de inventario');

      const codalmStr = String(bodega).padStart(3, '0').substring(0, 3);
      const cantidadNum = parseFloat(cantidad);
      const precioVentaNum = parseFloat(precioVenta);
      const precioBaseNum = parseFloat(precioBase);
      
      // 1. Obtener informaciÃ³n del producto si es necesaria (codins, costo actual)
      const reqProd = new sql.Request(transaction);
      reqProd.input('pid', sql.Int, productoId);
      const prodResult = await reqProd.query(`
        SELECT codins, ultimo_costo, costo_promedio FROM ${TABLE_NAMES.productos} WHERE id = @pid
      `);

      if (prodResult.recordset.length === 0) throw new Error(`Producto ${productoId} no encontrado`);
      
      const { codins, ultimo_costo, costo_promedio } = prodResult.recordset[0];
      
      // Prioridad costo: 1. Parametro (costo promedio pasado), 2. costo_promedio BD, 3. ultimo_costo BD
      let costoFinal = 0;
      if (costo !== null) {
          costoFinal = parseFloat(costo);
      } else {
          costoFinal = parseFloat(costo_promedio) || parseFloat(ultimo_costo) || 0;
      }

      // 2. Actualizar Stock (Restar)
      const reqStock = new sql.Request(transaction);
      reqStock.input('codins', sql.Char(8), codins);
      reqStock.input('codalm', sql.Char(3), codalmStr);
      reqStock.input('cantidad', sql.Decimal(18, 2), cantidadNum);
      reqStock.input('costo', sql.Decimal(18, 2), costoFinal);

      const stockCheck = await reqStock.query(`SELECT caninv FROM inv_invent WHERE codins = @codins AND codalm = @codalm`);

      if (stockCheck.recordset.length > 0) {
        // Actualizar existente
        // Nota: valinv se reduce por (cantidad * costo_promedio o ultimo_costo). 
        // Usaremos costoFinal para mantener consistencia, aunque idealmente deberÃ­a ser promedio ponderado.
        await reqStock.query(`
          UPDATE inv_invent 
          SET caninv = caninv - @cantidad, 
              valinv = valinv - (@cantidad * @costo)
          WHERE codins = @codins AND codalm = @codalm
        `);
      } else {
        // No deberÃ­a ocurrir una salida sin stock previo normalmente, pero manejamos el caso creando negativo
        await reqStock.query(`
          INSERT INTO inv_invent (codins, codalm, caninv, valinv, ucoins, pvdins)
          VALUES (@codins, @codalm, -@cantidad, -(@cantidad * @costo), 0, 0)
        `);
      }

      // 3. Insertar Kardex
      const reqKardex = new sql.Request(transaction);
      reqKardex.input('codalm', sql.Char(3), codalmStr);
      reqKardex.input('codins', sql.Char(8), codins);
      reqKardex.input('tipkar', sql.Char(2), tipoMovimiento); // 'SA'
      reqKardex.input('dockar', sql.Int, Math.abs(parseInt(numeroDocumentoInt) || 0));
      reqKardex.input('cankar', sql.Decimal(18, 6), cantidadNum); // SegÃºn schema usuario tiene precisiÃ³n 6 decimales visualmente (aunque numeric(9, ?) puede variar)
      reqKardex.input('coskar', sql.Decimal(18, 2), costoFinal); // Coskar = Costo Promedio
      
      // CAMBIO SOLICITADO: venkar debe usar el precio base (formula lista 07)
      // Si no se pasa precioBase, usaremos costoFinal como fallback conservador
      const venkarFinal = precioBaseNum > 0 ? precioBaseNum : costoFinal;
      reqKardex.input('venkar', sql.Decimal(18, 2), venkarFinal);
      
      reqKardex.input('codter', sql.VarChar(15), String(clienteId || '').substring(0, 15));
      reqKardex.input('codusu', sql.VarChar(12), String(codUsuario || '').substring(0, 12));
      reqKardex.input('numrem', sql.Int, numRemision || 0);
      reqKardex.input('numcom', sql.Int, numComprobante || 0);
      reqKardex.input('observa', sql.VarChar(100), String(observaciones || '').substring(0, 100));

      await reqKardex.query(`
        INSERT INTO inv_kardex (
          codalm, codins, feckar, tipkar, dockar, cankar, coskar, venkar, 
          codter, codusu, numrem, numcom, observa, fecsys, FECREM
        )
        VALUES (
          @codalm, @codins, GETDATE(), @tipkar, @dockar, @cankar, @coskar, @venkar,
          @codter, @codusu, @numrem, @numcom, @observa, GETDATE(), GETDATE()
        )
      `);

      return true;

    } catch (error) {
      console.error('Error en InventoryService.registrarSalida:', error);
      throw error;
    }
  },

  /**
   * Registra una entrada de inventario
   * @param {object} params
   * ... similar a salida
   */
  registrarEntrada: async ({
    transaction,
    productoId,
    cantidad,
    bodega = '001',
    numeroDocumentoInt,
    tipoMovimiento = 'EN', // 'EN' para Entrada o DevoluciÃ³n
    precioVenta = 0,
    costo = null,
    observaciones = '',
    codUsuario = 'SISTEMA',
    clienteId = '',
    numRemision = 0,
    numComprobante = 0
  }) => {
    try {
      if (!transaction) throw new Error('Se requiere una transacciÃ³n activa');

      const codalmStr = String(bodega).padStart(3, '0').substring(0, 3);
      const cantidadNum = parseFloat(cantidad);
      const precioVentaNum = parseFloat(precioVenta);

      // 1. Obtener informaciÃ³n
      const reqProd = new sql.Request(transaction);
      reqProd.input('pid', sql.Int, productoId);
      const prodResult = await reqProd.query(`
        SELECT codins, ultimo_costo FROM ${TABLE_NAMES.productos} WHERE id = @pid
      `);

      if (prodResult.recordset.length === 0) throw new Error(`Producto ${productoId} no encontrado`);
      
      const { codins, ultimo_costo } = prodResult.recordset[0];
      const costoFinal = costo !== null ? parseFloat(costo) : parseFloat(ultimo_costo || 0);

      // 2. Actualizar Stock (Sumar)
      const reqStock = new sql.Request(transaction);
      reqStock.input('codins', sql.Char(8), codins);
      reqStock.input('codalm', sql.Char(3), codalmStr);
      reqStock.input('cantidad', sql.Decimal(18, 2), cantidadNum);
      reqStock.input('costo', sql.Decimal(18, 2), costoFinal);

      const stockCheck = await reqStock.query(`SELECT caninv FROM inv_invent WHERE codins = @codins AND codalm = @codalm`);

      if (stockCheck.recordset.length > 0) {
        await reqStock.query(`
          UPDATE inv_invent 
          SET caninv = caninv + @cantidad, 
              valinv = valinv + (@cantidad * @costo)
          WHERE codins = @codins AND codalm = @codalm
        `);
      } else {
        await reqStock.query(`
          INSERT INTO inv_invent (codins, codalm, caninv, valinv, ucoins, pvdins)
          VALUES (@codins, @codalm, @cantidad, @cantidad * @costo, 0, 0)
        `);
      }

      // Si es una compra o entrada con nuevo costo, podrÃ­amos actualizar ultimo_costo en producto
      if (costoFinal > 0) {
         const reqUpdProd = new sql.Request(transaction);
         reqUpdProd.input('uc', sql.Decimal(18, 2), costoFinal);
         reqUpdProd.input('ci', sql.Char(8), codins);
         await reqUpdProd.query(`UPDATE ${TABLE_NAMES.productos} SET ultimo_costo = @uc WHERE codins = @ci`);
      }

      // 3. Insertar Kardex
      const reqKardex = new sql.Request(transaction);
      reqKardex.input('codalm', sql.Char(3), codalmStr);
      reqKardex.input('codins', sql.Char(8), codins);
      reqKardex.input('tipkar', sql.Char(2), tipoMovimiento); 
      reqKardex.input('dockar', sql.Int, Math.abs(parseInt(numeroDocumentoInt) || 0));
      reqKardex.input('cankar', sql.Decimal(18, 6), cantidadNum);
      reqKardex.input('coskar', sql.Decimal(18, 2), costoFinal);
      // CAMBIO SOLICITADO: venkar debe ser 0 en entradas (es valor de venta)
      reqKardex.input('venkar', sql.Decimal(18, 2), 0);
      reqKardex.input('codter', sql.VarChar(15), String(clienteId || '').substring(0, 15));
      reqKardex.input('codusu', sql.VarChar(12), String(codUsuario || '').substring(0, 12));
      reqKardex.input('numrem', sql.Int, numRemision || 0);
      reqKardex.input('numcom', sql.Int, numComprobante || 0);
      reqKardex.input('observa', sql.VarChar(100), String(observaciones || '').substring(0, 100));

      await reqKardex.query(`
        INSERT INTO inv_kardex (
          codalm, codins, feckar, tipkar, dockar, cankar, coskar, venkar, 
          codter, codusu, numrem, numcom, observa, fecsys, FECREM
        )
        VALUES (
          @codalm, @codins, GETDATE(), @tipkar, @dockar, @cankar, @coskar, @venkar,
          @codter, @codusu, @numrem, @numcom, @observa, GETDATE(), GETDATE()
        )
      `);

      return true;

    } catch (error) {
      console.error('Error en InventoryService.registrarEntrada:', error);
      throw error;
    }
  }
};

module.exports = InventoryService;
