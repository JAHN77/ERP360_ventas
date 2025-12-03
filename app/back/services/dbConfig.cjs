// Cargar variables de entorno
require('dotenv').config();

// Configuración de la base de datos SQL Server desde variables de entorno
const DB_CONFIG = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.NODE_ENV !== 'production',
    enableArithAbort: true,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT || '30000', 10),
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '50', 10), // Aumentado de 10 a 50 para mayor concurrencia
    min: parseInt(process.env.DB_POOL_MIN || '5', 10), // Mantener al menos 5 conexiones activas
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '300000', 10), // 5 minutos
    acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '60000', 10), // 1 minuto
  },
};

// Configuración de tablas (mapeo de nombres)
const TABLE_NAMES = {
  clientes: 'con_terceros',
  productos: 'inv_insumos',
  facturas: 'ven_facturas',
  facturas_detalle: 'ven_detafact',
  cotizaciones: 'ven_cotizacion',
  cotizaciones_detalle: 'ven_detacotizacion',
  pedidos: 'ven_pedidos',
  pedidos_detalle: 'ven_detapedidos',
  remisiones: 'ven_remiciones_enc',
  remisiones_detalle: 'ven_remiciones_det',
  notas_credito: 'ven_notas',
  archivos_adjuntos: 'archivos_adjuntos',
  medidas: 'inv_medidas',
  categorias: 'inv_categorias',
  departamentos: 'gen_departamentos',
  ciudades: 'gen_municipios',
  tipos_documento: 'Dian_tipodocumento',
  tipos_persona: 'tipos_persona',
  regimenes_fiscal: 'Dian_Regimenes',
  vendedores: 'ven_vendedor',
  transportadoras: 'transportadoras'
};

// Configuración de consultas comunes
const QUERIES = {
  // Obtener todos los clientes
  GET_CLIENTES: `
    SELECT 
      id,
      codter as numeroDocumento,
      nomter as razonSocial,
      apl1 as primerApellido,
      apl2 as segundoApellido,
      nom1 as primerNombre,
      nom2 as segundoNombre,
      dirter as direccion,
      TELTER as telefono,
      CELTER as celular,
      EMAIL as email,
      ciudad,
      ciudad as ciudadId,
      codven as vendedorId,
      COALESCE(cupo_credito, 0) as limiteCredito,
      COALESCE(plazo, 0) as diasCredito,
      COALESCE(tasa_descuento, 0) as tasaDescuento,
      Forma_pago as formaPago,
      regimen_tributario as regimenTributario,
      CAST(activo AS INT) as activo,
      contacto,
      FECING as fechaIngreso
    FROM ${TABLE_NAMES.clientes}
    WHERE activo = 1
    ORDER BY nomter
  `,

  // Obtener todos los productos con stock desde inv_invent (filtrado por bodega si se proporciona)
  // Usando caninv (cantidad de inventario) en lugar de ucoins
  // Precio obtenido desde inv_detaprecios con tarifa '07': precio SIN IVA como base, precio CON IVA para referencia
  GET_PRODUCTOS: `
    SELECT 
      ins.id,
      ins.codins                 AS codigo,
      ins.nomins                 AS nombre,
      ins.codigo_linea           AS codigoLinea,
      ins.codigo_sublinea        AS codigoSublinea,
      ins.Codigo_Medida          AS idMedida,
      ins.undins                 AS unidadMedida,
      ins.tasa_iva               AS tasaIva,
      -- Precio SIN IVA desde inv_detaprecios (tarifa '07'), fallback a ultimo_costo si no existe
      -- Este es el precio base que se usará para calcular IVA
      COALESCE(
        CAST(dp.valins / (1 + (ins.tasa_iva * 0.01)) AS DECIMAL(10,2)),
        ins.ultimo_costo
      ) AS ultimoCosto,
      ins.costo_promedio         AS costoPromedio,
      ins.referencia,
      ins.karins                 AS controlaExistencia,
      COALESCE(SUM(inv.caninv), 0) AS stock,
      ins.activo,
      ins.MARGEN_VENTA           AS margenVenta,
      ins.precio_publico         AS precioPublico,
      ins.precio_mayorista       AS precioMayorista,
      ins.precio_minorista       AS precioMinorista,
      ins.fecsys                 AS fechaCreacion,
      -- Campos adicionales de la tarifa de precios
      dp.margen_tarifa           AS margenTarifa,
      -- Precio CON IVA (para referencia/visualización)
      dp.valins                  AS precioConIva
    FROM ${TABLE_NAMES.productos} ins
    LEFT JOIN inv_invent inv ON inv.codins = ins.codins
      AND (@codalm IS NULL OR inv.codalm = @codalm)
    LEFT JOIN inv_detaprecios dp ON dp.codins = ins.codins AND dp.Codtar = '07'
    WHERE ins.activo = 1
    GROUP BY ins.id, ins.codins, ins.nomins, ins.codigo_linea, ins.codigo_sublinea, 
             ins.Codigo_Medida, ins.undins, ins.tasa_iva, ins.ultimo_costo, 
             ins.costo_promedio, ins.referencia, ins.karins, ins.activo, 
             ins.MARGEN_VENTA, ins.precio_publico, ins.precio_mayorista, 
             ins.precio_minorista, ins.fecsys, dp.valins, dp.margen_tarifa
    ORDER BY ins.nomins
  `,

  // Productos mínimos para UI: nombre, referencia, ultimoCosto, stock, precioInventario (filtrado por bodega si se proporciona)
  // Usando caninv (cantidad de inventario) en lugar de ucoins
  // Precio obtenido desde inv_detaprecios con tarifa '07': precio SIN IVA como base
  GET_PRODUCTOS_MIN: `
    SELECT 
      ins.id,
      ins.nomins                                   AS nombre,
      LTRIM(RTRIM(COALESCE(ins.referencia, '')))   AS referencia,
      -- Precio SIN IVA desde inv_detaprecios (tarifa '07'), fallback a ultimo_costo si no existe
      -- Este es el precio base que se usará para calcular IVA
      COALESCE(
        CAST(dp.valins / (1 + (ins.tasa_iva * 0.01)) AS DECIMAL(10,2)),
        ins.ultimo_costo
      ) AS ultimoCosto,
      COALESCE(SUM(inv.caninv), 0)                 AS stock,
      COALESCE(SUM(inv.valinv), 0)                 AS precioInventario,
      ins.undins                                   AS unidadMedidaCodigo,
      m.nommed                                     AS unidadMedidaNombre,
      ins.tasa_iva                                 AS tasaIva,
      -- Precio CON IVA (para referencia/visualización)
      dp.valins                                    AS precioConIva
    FROM ${TABLE_NAMES.productos} ins
    LEFT JOIN inv_invent inv ON inv.codins = ins.codins
      AND (@codalm IS NULL OR inv.codalm = @codalm)
    LEFT JOIN inv_medidas m ON m.codmed = ins.Codigo_Medida
    LEFT JOIN inv_detaprecios dp ON dp.codins = ins.codins AND dp.Codtar = '07'
    WHERE ins.activo = 1
    GROUP BY ins.id, ins.nomins, ins.referencia, ins.ultimo_costo, ins.undins, m.nommed, ins.tasa_iva, dp.valins
    ORDER BY ins.nomins
  `,

  // Obtener facturas con detalles - Usando columnas reales de ven_facturas
  GET_FACTURAS: `
    SELECT 
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
      -- Si la factura está rechazada, usar Observa como motivoRechazo
      CASE WHEN f.estfac = 'R' THEN f.Observa ELSE NULL END as motivoRechazo,
      -- Calcular formaPago: '01' (Contado) si efectivo > 0, '02' (Crédito) si credito > 0
      CASE 
        WHEN COALESCE(f.efectivo, 0) > 0 AND COALESCE(f.credito, 0) = 0 THEN '01'
        WHEN COALESCE(f.credito, 0) > 0 THEN '02'
        WHEN COALESCE(f.tarjetacr, 0) > 0 OR COALESCE(f.Transferencia, 0) > 0 THEN '01'
        ELSE '01'
      END as formaPago
    FROM ${TABLE_NAMES.facturas} f
    ORDER BY f.fecfac DESC
  `,

  // Obtener detalles de facturas - Usando columnas reales de ven_detafact
  GET_FACTURAS_DETALLE: `
    SELECT 
      fd.ID as id,
      fd.id_factura as facturaId,
      -- Obtener producto_id y tasa_iva desde inv_insumos usando codins
      COALESCE(
        (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(fd.codins))),
        NULL
      ) as productoId,
      COALESCE(
        (SELECT TOP 1 tasa_iva FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(fd.codins))),
        0
      ) as tasaIvaProducto,
      fd.qtyins as cantidad,
      fd.valins as precioUnitario,
      fd.desins as descuentoPorcentaje,
      -- Usar tasa_iva del producto, o calcular desde ivains si no está disponible
      COALESCE(
        (SELECT TOP 1 tasa_iva FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(fd.codins))),
        CASE 
          WHEN fd.valins > 0 AND fd.qtyins > 0 THEN 
            (fd.ivains / ((fd.valins * fd.qtyins) - COALESCE(fd.valdescuento, 0))) * 100
          ELSE 0
        END
      ) as ivaPorcentaje,
      fd.observa as descripcion,
      -- Calcular subtotal: (valins * qtyins) - valdescuento
      (fd.valins * fd.qtyins) - COALESCE(fd.valdescuento, 0) as subtotal,
      fd.ivains as valorIva,
      -- Calcular total: subtotal + ivains
      (fd.valins * fd.qtyins) - COALESCE(fd.valdescuento, 0) + COALESCE(fd.ivains, 0) as total,
      fd.codins as codProducto
    FROM ${TABLE_NAMES.facturas_detalle} fd
  `,

  // Obtener cotizaciones - Conectado con venv_cotizacion y venv_detacotizacion
  GET_COTIZACIONES: `
    SELECT 
      c.id,
      c.numcot               AS numeroCotizacion,
      c.fecha                AS fechaCotizacion,
      c.fecha_vence          AS fechaVencimiento,
      c.codter               AS codter,
      COALESCE(cli.id, NULL) AS clienteId,
      CASE 
        WHEN cli.nomter IS NOT NULL AND LTRIM(RTRIM(cli.nomter)) != '' 
        THEN LTRIM(RTRIM(cli.nomter))
        ELSE NULL
      END AS clienteNombre,
      -- Obtener el ID numérico del vendedor (ideven) si existe, sino usar el código como fallback
      CAST(COALESCE(v.ideven, NULL) AS VARCHAR(20)) AS vendedorId,
      LTRIM(RTRIM(c.cod_vendedor)) AS codVendedor,
      c.codalm               AS codalm,
      c.codalm               AS empresaId,
      COALESCE(c.subtotal, 0) AS subtotal,
      COALESCE(c.val_descuento, 0) AS descuentoValor,
      COALESCE(c.val_iva, 0) AS ivaValor,
      COALESCE(c.subtotal,0) - COALESCE(c.val_descuento,0) + COALESCE(c.val_iva,0) AS total,
      c.observa              AS observaciones,
      c.estado,
      c.formapago            AS formaPago,
      COALESCE(c.valor_anticipo, 0) AS valorAnticipo,
      c.num_orden_compra     AS numOrdenCompra,
      c.fecha_aprobacion     AS fechaAprobacion,
      c.cod_usuario          AS codUsuario,
      c.id_usuario           AS idUsuario,
      c.COD_TARIFA           AS codTarifa,
      c.fecsys               AS fechaCreacion,
      -- Campos calculados o no disponibles en BD
      NULL                   AS observacionesInternas,
      NULL                   AS listaPrecioId,
      NULL                   AS descuentoPorcentaje,
      NULL                   AS ivaPorcentaje,
      NULL                   AS domicilios,
      NULL                   AS approvedItems
    FROM ${TABLE_NAMES.cotizaciones} c
    LEFT JOIN ${TABLE_NAMES.clientes} cli ON RTRIM(LTRIM(cli.codter)) = RTRIM(LTRIM(c.codter)) AND cli.activo = 1
    LEFT JOIN ${TABLE_NAMES.vendedores} v ON LTRIM(RTRIM(ISNULL(v.codven, ''))) = LTRIM(RTRIM(ISNULL(c.cod_vendedor, ''))) AND v.Activo = 1
    ORDER BY c.fecha DESC
  `,

  // Obtener detalles de cotizaciones - Conectado con venv_detacotizacion
  // cod_producto es CHAR(8) en venv_detacotizacion, necesitamos obtener el id del producto
  GET_COTIZACIONES_DETALLE: `
    SELECT 
      d.id,
      d.id_cotizacion           AS cotizacionId,
      COALESCE(p.id, NULL)      AS productoId,
      LTRIM(RTRIM(d.cod_producto)) AS codProducto,
      d.cantidad,
      COALESCE(d.cant_facturada, 0) AS cantFacturada,
      COALESCE(d.qtycot, 0)     AS qtycot,
      COALESCE(d.preciound, 0)  AS precioUnitario,
      COALESCE(d.tasa_descuento, 0) AS descuentoPorcentaje,
      COALESCE(d.tasa_iva, 0)   AS ivaPorcentaje,
      d.codigo_medida           AS codigoMedida,
      d.estado                  AS estado,
      d.num_factura             AS numFactura,
      -- Cálculo de subtotal, IVA y total
      CASE WHEN d.valor IS NOT NULL AND d.tasa_iva IS NOT NULL THEN d.valor - (d.valor * (d.tasa_iva/100.0)) ELSE COALESCE(d.valor,0) END AS subtotal,
      CASE WHEN d.valor IS NOT NULL AND d.tasa_iva IS NOT NULL THEN (d.valor * (d.tasa_iva/100.0)) ELSE 0 END AS valorIva,
      COALESCE(d.valor, 0)      AS total,
      -- Campo no disponible en BD, usar descripción del producto si existe
      COALESCE(p.nomins, '')    AS descripcion
    FROM ${TABLE_NAMES.cotizaciones_detalle} d
    LEFT JOIN ${TABLE_NAMES.productos} p ON LTRIM(RTRIM(p.codins)) = LTRIM(RTRIM(d.cod_producto))
  `,

  // Obtener pedidos - Usando estructura REAL de ven_pedidos
  // Columnas: id, numero_pedido, fecha_pedido, fecha_entrega_estimada, codter, codven, empresa_id, codtar, codusu, cotizacion_id, subtotal, descuento_valor, descuento_porcentaje, iva_valor, iva_porcentaje, impoconsumo_valor, total, observaciones, instrucciones_entrega, estado, fec_creacion, fec_modificacion
  GET_PEDIDOS: `
    SELECT 
      p.id,
      p.numero_pedido as numeroPedido,
      p.fecha_pedido as fechaPedido,
      LTRIM(RTRIM(COALESCE(p.codter, ''))) as clienteId,
      CASE 
        WHEN cli.nomter IS NOT NULL AND LTRIM(RTRIM(cli.nomter)) != '' 
        THEN LTRIM(RTRIM(cli.nomter))
        ELSE NULL
      END as clienteNombre,
      LTRIM(RTRIM(COALESCE(p.codven, ''))) as vendedorId,
      p.cotizacion_id as cotizacionId,
      COALESCE(p.subtotal, 0) as subtotal,
      COALESCE(p.descuento_valor, 0) as descuentoValor,
      COALESCE(p.iva_valor, 0) as ivaValor,
      COALESCE(p.total, 0) as total,
      LTRIM(RTRIM(COALESCE(p.observaciones, ''))) as observaciones,
      p.estado,
      COALESCE(p.empresa_id, 1) as empresaId,
      p.fecha_entrega_estimada as fechaEntregaEstimada,
      NULL as listaPrecioId,
      COALESCE(p.descuento_porcentaje, 0) as descuentoPorcentaje,
      COALESCE(p.iva_porcentaje, 0) as ivaPorcentaje,
      COALESCE(p.impoconsumo_valor, 0) as impoconsumoValor,
      LTRIM(RTRIM(COALESCE(p.instrucciones_entrega, ''))) as instruccionesEntrega
    FROM ${TABLE_NAMES.pedidos} p
    LEFT JOIN ${TABLE_NAMES.clientes} cli ON RTRIM(LTRIM(cli.codter)) = RTRIM(LTRIM(p.codter)) AND cli.activo = 1
    ORDER BY p.fecha_pedido DESC
  `,

  // Obtener detalles de pedidos - Usando estructura REAL de ven_detapedidos
  // ven_detapedidos tiene pedido_id (FK a ven_pedidos.id) como relación principal
  // También tiene numped (CHAR(8)) para compatibilidad con sistema antiguo
  GET_PEDIDOS_DETALLE: `
    SELECT 
      -- NOTA: ven_detapedidos NO tiene columna 'id', se usa pedido_id + codins como identificador
      -- Para detaPedidoId, usaremos NULL o podríamos usar ROW_NUMBER() si es necesario
      NULL as detaPedidoId, -- ven_detapedidos no tiene ID único, se buscará por pedido_id + codins
      -- Usar pedido_id directamente si existe, sino usar el id del JOIN
      CAST(COALESCE(pd.pedido_id, p.id) AS INT) as pedidoId,
      pd.numped,
      -- Obtener el ID del producto desde inv_insumos usando codins
      COALESCE(
        (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(pd.codins))),
        NULL
      ) as productoId,
      LTRIM(RTRIM(COALESCE(pd.codins, ''))) as codProducto,
      -- Usar canped (cantidad pedida)
      COALESCE(pd.canped, 0) as cantidad,
      -- Usar valins (valor unitario)
      COALESCE(pd.valins, 0) as precioUnitario,
      -- Calcular descuentoPorcentaje desde dctped
      CASE 
        WHEN COALESCE(pd.canped, 0) > 0 AND COALESCE(pd.valins, 0) > 0 
        THEN (COALESCE(pd.dctped, 0) / (pd.canped * pd.valins)) * 100
        ELSE 0
      END as descuentoPorcentaje,
      -- Obtener porcentaje de IVA desde el producto, si no existe calcular desde ivaped/subtotal
      COALESCE(
        (SELECT TOP 1 tasa_iva FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(pd.codins))),
        CASE 
          WHEN COALESCE(pd.canped, 0) > 0 AND COALESCE(pd.valins, 0) > 0 
            AND (pd.canped * pd.valins - COALESCE(pd.dctped, 0)) > 0
          THEN (COALESCE(pd.ivaped, 0) / (pd.canped * pd.valins - COALESCE(pd.dctped, 0))) * 100
          ELSE 0
        END,
        0
      ) as ivaPorcentaje,
      -- Obtener descripción del producto
      COALESCE(
        (SELECT TOP 1 LTRIM(RTRIM(COALESCE(nomins, ''))) FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(pd.codins))),
        LTRIM(RTRIM(COALESCE(pd.codins, '')))
      ) as descripcion,
      -- Obtener unidad de medida (similar a cotizaciones)
      COALESCE(
        (SELECT TOP 1 LTRIM(RTRIM(COALESCE(m.nommed, ins.undins, 'Unidad'))) 
         FROM inv_insumos ins
         LEFT JOIN inv_medidas m ON m.codmed = ins.Codigo_Medida
         WHERE LTRIM(RTRIM(ins.codins)) = LTRIM(RTRIM(pd.codins))),
        'Unidad'
      ) as unidadMedida,
      -- Calcular subtotal
      ((COALESCE(pd.canped, 0) * COALESCE(pd.valins, 0)) - COALESCE(pd.dctped, 0)) as subtotal,
      -- Usar ivaped como valorIva directamente (ya está almacenado)
      COALESCE(pd.ivaped, 0) as valorIva,
      -- Calcular total
      ((COALESCE(pd.canped, 0) * COALESCE(pd.valins, 0)) - COALESCE(pd.dctped, 0) + COALESCE(pd.ivaped, 0)) as total,
      -- Obtener stock actual
      COALESCE(
        (SELECT SUM(caninv) FROM inv_invent WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(pd.codins)) AND LTRIM(RTRIM(codalm)) = LTRIM(RTRIM(pd.codalm))),
        0
      ) as stock,
      -- Campos adicionales de la BD real
      pd.estped as estadoItem,
      pd.codalm,
      pd.serial,
      pd.numfac as numFactura,
      pd.DiasGar as diasGarantia,
      pd.Numord as numOrden,
      COALESCE(pd.Fecsys, GETDATE()) as fechaCreacion
    FROM ${TABLE_NAMES.pedidos_detalle} pd
    LEFT JOIN ${TABLE_NAMES.pedidos} p ON p.id = pd.pedido_id
    WHERE pd.pedido_id IS NOT NULL OR (pd.numped IS NOT NULL AND LTRIM(RTRIM(pd.numped)) <> '')
  `,

  // Obtener remisiones - Usando estructura de ven_remiciones_enc
  GET_REMISIONES: `
    SELECT 
      r.id,
      LTRIM(RTRIM(COALESCE(r.numero_remision, ''))) as numeroRemision,
      LTRIM(RTRIM(COALESCE(r.codalm, ''))) as codalm,
      CAST(r.fecha_remision AS DATE) as fechaRemision,
      CAST(COALESCE(r.pedido_id, NULL) AS INT) as pedidoId,
      LTRIM(RTRIM(COALESCE(r.codter, ''))) as clienteId,
      LTRIM(RTRIM(COALESCE(r.codven, ''))) as vendedorId,
      LTRIM(RTRIM(COALESCE(r.estado, 'BORRADOR'))) as estado,
      LTRIM(RTRIM(COALESCE(r.observaciones, ''))) as observaciones,
      LTRIM(RTRIM(COALESCE(r.codusu, ''))) as codUsuario,
      COALESCE(r.fec_creacion, GETDATE()) as fechaCreacion,
      -- Campos calculados/compatibilidad (no existen en la tabla pero se dejan como NULL)
      NULL as subtotal,
      NULL as descuentoValor,
      NULL as ivaValor,
      NULL as total,
      NULL as empresaId,
      r.factura_id as facturaId,
      NULL as estadoEnvio,
      NULL as metodoEnvio,
      NULL as transportadoraId,
      NULL as transportadora,
      NULL as numeroGuia,
      NULL as fechaDespacho
    FROM ${TABLE_NAMES.remisiones} r
    ORDER BY r.fecha_remision DESC, r.id DESC
  `,

  // Obtener detalles de remisiones - Usando estructura de ven_remiciones_det
  // Obtener precios desde el pedido relacionado (ven_detapedidos) usando subconsultas para mayor confiabilidad
  GET_REMISIONES_DETALLE: `
    SELECT 
      rd.id,
      CAST(COALESCE(rd.remision_id, 0) AS INT) as remisionId,
      CAST(COALESCE(rd.deta_pedido_id, NULL) AS INT) as detaPedidoId,
      LTRIM(RTRIM(COALESCE(rd.codins, ''))) as codProducto,
      -- Obtener el ID del producto desde inv_insumos usando codins
      COALESCE(
        (SELECT TOP 1 id FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))),
        NULL
      ) as productoId,
      -- Obtener descripción del producto
      COALESCE(
        (SELECT TOP 1 LTRIM(RTRIM(COALESCE(nomins, ''))) FROM inv_insumos WHERE LTRIM(RTRIM(codins)) = LTRIM(RTRIM(rd.codins))),
        LTRIM(RTRIM(COALESCE(rd.codins, '')))
      ) as descripcion,
      COALESCE(rd.cantidad_enviada, 0) as cantidadEnviada,
      COALESCE(rd.cantidad_facturada, 0) as cantidadFacturada,
      COALESCE(rd.cantidad_devuelta, 0) as cantidadDevuelta,
      -- Campos calculados/compatibilidad
      COALESCE(rd.cantidad_enviada, 0) as cantidad,
      -- Obtener precios desde el pedido relacionado usando subconsulta
      -- La relación es: ven_remiciones_enc.pedido_id -> ven_pedidos.id -> ven_detapedidos.pedido_id
      -- IMPORTANTE: ven_detapedidos tiene pedido_id (INT) que se relaciona con ven_pedidos.id
      COALESCE(
        (SELECT TOP 1 pd.valins 
         FROM ven_remiciones_enc re
         INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
         WHERE re.id = rd.remision_id 
           AND re.pedido_id IS NOT NULL
           AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
         ORDER BY pd.pedido_id DESC),
        0
      ) as precioUnitario,
      -- Calcular descuentoPorcentaje desde dctped del pedido
      CASE 
        WHEN COALESCE(rd.cantidad_enviada, 0) > 0 
          AND (
            SELECT TOP 1 pd.valins 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
          ) > 0
          AND (
            SELECT TOP 1 pd.canped 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
          ) > 0
        THEN (
          (SELECT TOP 1 COALESCE(pd.dctped, 0) 
           FROM ven_remiciones_enc re
           INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
           WHERE re.id = rd.remision_id 
             AND re.pedido_id IS NOT NULL
             AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))) 
          / 
          (rd.cantidad_enviada * 
           (SELECT TOP 1 pd.valins 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))))
        ) * 100
        ELSE 0
      END as descuentoPorcentaje,
      -- Calcular ivaPorcentaje desde ivaped del pedido
      CASE 
        WHEN COALESCE(rd.cantidad_enviada, 0) > 0 
          AND (
            SELECT TOP 1 pd.valins 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
          ) > 0
          AND (
            SELECT TOP 1 pd.canped 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
          ) > 0
          AND (
            (rd.cantidad_enviada * 
             (SELECT TOP 1 pd.valins 
              FROM ven_remiciones_enc re
              INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
              WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))) 
             - 
             (SELECT TOP 1 COALESCE(pd.dctped, 0) 
              FROM ven_remiciones_enc re
              INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
              WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins)))) > 0
          )
        THEN (
          (SELECT TOP 1 COALESCE(pd.ivaped, 0) 
           FROM ven_remiciones_enc re
           INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
           WHERE re.id = rd.remision_id 
             AND re.pedido_id IS NOT NULL
             AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))) 
          / 
          (rd.cantidad_enviada * 
           (SELECT TOP 1 pd.valins 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))) 
           - 
           (SELECT TOP 1 COALESCE(pd.dctped, 0) 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))))
        ) * 100
        ELSE 0
      END as ivaPorcentaje,
      -- Calcular subtotal (cantidad enviada * precio unitario - descuento proporcional)
      CASE 
        WHEN (
          SELECT TOP 1 pd.canped 
          FROM ven_remiciones_enc re
          INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
          WHERE re.id = rd.remision_id 
            AND re.pedido_id IS NOT NULL
            AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
        ) > 0
        THEN (
          (rd.cantidad_enviada * 
           COALESCE(
             (SELECT TOP 1 pd.valins 
              FROM ven_remiciones_enc re
              INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
              WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
             0
           )) 
          - 
          (COALESCE(
             (SELECT TOP 1 COALESCE(pd.dctped, 0) 
              FROM ven_remiciones_enc re
              INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
              WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
             0
           ) * 
           (rd.cantidad_enviada / 
            (SELECT TOP 1 pd.canped 
             FROM ven_remiciones_enc re
             INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
             WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
               AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))))
          )
        )
        ELSE (
          rd.cantidad_enviada * 
          COALESCE(
            (SELECT TOP 1 pd.valins 
             FROM ven_remiciones_enc re
             INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
             WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
               AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
            0
          )
        )
      END as subtotal,
      -- Obtener valorIva desde ivaped del pedido (proporcional a cantidad enviada)
      CASE 
        WHEN (
          SELECT TOP 1 pd.canped 
          FROM ven_remiciones_enc re
          INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
          WHERE re.id = rd.remision_id 
            AND re.pedido_id IS NOT NULL
            AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
        ) > 0 
        THEN (
          COALESCE(
            (SELECT TOP 1 COALESCE(pd.ivaped, 0) 
             FROM ven_remiciones_enc re
             INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
             WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
               AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
            0
          ) * 
          (rd.cantidad_enviada / 
           (SELECT TOP 1 pd.canped 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))))
        )
        ELSE 0
      END as valorIva,
      -- Calcular total (subtotal + iva)
      (
        CASE 
          WHEN (
            SELECT TOP 1 pd.canped 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
          ) > 0
          THEN (
            (rd.cantidad_enviada * 
             COALESCE(
               (SELECT TOP 1 pd.valins 
                FROM ven_remiciones_enc re
                INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
                WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                  AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
               0
             )) 
            - 
            (COALESCE(
               (SELECT TOP 1 COALESCE(pd.dctped, 0) 
                FROM ven_remiciones_enc re
                INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
                WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                  AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
               0
             ) * 
             (rd.cantidad_enviada / 
              (SELECT TOP 1 pd.canped 
               FROM ven_remiciones_enc re
               INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
               WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                 AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))))
            )
          )
          ELSE (
            rd.cantidad_enviada * 
            COALESCE(
              (SELECT TOP 1 pd.valins 
               FROM ven_remiciones_enc re
               INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
               WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                 AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
              0
            )
          )
        END
        +
        CASE 
          WHEN (
            SELECT TOP 1 pd.canped 
            FROM ven_remiciones_enc re
            INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
            WHERE re.id = rd.remision_id 
              AND re.pedido_id IS NOT NULL
              AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))
          ) > 0 
          THEN (
            COALESCE(
              (SELECT TOP 1 COALESCE(pd.ivaped, 0) 
               FROM ven_remiciones_enc re
               INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
               WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                 AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))),
              0
            ) * 
            (rd.cantidad_enviada / 
             (SELECT TOP 1 pd.canped 
              FROM ven_remiciones_enc re
              INNER JOIN ven_detapedidos pd ON pd.pedido_id = re.pedido_id
              WHERE re.id = rd.remision_id 
                AND re.pedido_id IS NOT NULL
                AND LTRIM(RTRIM(pd.codins)) = LTRIM(RTRIM(rd.codins))))
          )
          ELSE 0
        END
      ) as total
    FROM ${TABLE_NAMES.remisiones_detalle} rd
    WHERE rd.remision_id IS NOT NULL
  `,

  // Obtener notas de crédito
  GET_NOTAS_CREDITO: `
    SELECT 
      nc.id,
      nc.numero,
      nc.factura_id as facturaId,
      nc.cliente_id as clienteId,
      nc.fecha_emision as fechaEmision,
      nc.subtotal,
      nc.iva,
      nc.total,
      nc.motivo,
      nc.estado_dian as estadoDian
    FROM ${TABLE_NAMES.notas_credito} nc
    ORDER BY nc.fecha_emision DESC
  `,

  // Obtener medidas
  GET_MEDIDAS: `
    SELECT 
      id,
      codigo,
      nombre,
      abreviatura
    FROM ${TABLE_NAMES.medidas}
    ORDER BY nombre
  `,

  // Obtener categorías
  GET_CATEGORIAS: `
    SELECT 
      id,
      nombre
    FROM ${TABLE_NAMES.categorias}
    ORDER BY nombre
  `
  ,

  // Adjuntos por entidad
  GET_ADJUNTOS_BY_ENTIDAD: `
    SELECT 
      id,
      entidad_id as entidadId,
      entidad_tipo as entidadTipo,
      nombre_archivo as nombreArchivo,
      ruta_storage as rutaStorage,
      mime_type as mimeType,
      size_bytes as sizeBytes,
      created_at as createdAt
    FROM ${TABLE_NAMES.archivos_adjuntos}
    WHERE entidad_id = @entidadId AND entidad_tipo = @entidadTipo
    ORDER BY created_at DESC
  `,

  // Un adjunto por id
  GET_ADJUNTO_BY_ID: `
    SELECT 
      id,
      entidad_id as entidadId,
      entidad_tipo as entidadTipo,
      nombre_archivo as nombreArchivo,
      ruta_storage as rutaStorage,
      mime_type as mimeType,
      size_bytes as sizeBytes,
      created_at as createdAt
    FROM ${TABLE_NAMES.archivos_adjuntos}
    WHERE id = @id
  `
};

module.exports = {
  DB_CONFIG,
  TABLE_NAMES,
  QUERIES
};
