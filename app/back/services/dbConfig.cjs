// Configuración de la base de datos SQL Server
const DB_CONFIG = {
  server: '179.33.214.87',
  port: 1434,
  database: 'Prueba_ERP360',
  user: 'sa',
  password: 'Axul3j0',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
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
  remisiones: 'ven_recibos',
  remisiones_detalle: 'ven_detarecibo',
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
      ins.ultimo_costo           AS ultimoCosto,
      ins.costo_promedio         AS costoPromedio,
      ins.referencia,
      ins.karins                 AS controlaExistencia,
      COALESCE(SUM(inv.caninv), 0) AS stock,
      ins.activo,
      ins.MARGEN_VENTA           AS margenVenta,
      ins.precio_publico         AS precioPublico,
      ins.precio_mayorista       AS precioMayorista,
      ins.precio_minorista       AS precioMinorista,
      ins.fecsys                 AS fechaCreacion
    FROM ${TABLE_NAMES.productos} ins
    LEFT JOIN inv_invent inv ON inv.codins = ins.codins
      AND (@codalm IS NULL OR inv.codalm = @codalm)
    WHERE ins.activo = 1
    GROUP BY ins.id, ins.codins, ins.nomins, ins.codigo_linea, ins.codigo_sublinea, 
             ins.Codigo_Medida, ins.undins, ins.tasa_iva, ins.ultimo_costo, 
             ins.costo_promedio, ins.referencia, ins.karins, ins.activo, 
             ins.MARGEN_VENTA, ins.precio_publico, ins.precio_mayorista, 
             ins.precio_minorista, ins.fecsys
    ORDER BY ins.nomins
  `,

  // Productos mínimos para UI: nombre, referencia, ultimoCosto, stock, precioInventario (filtrado por bodega si se proporciona)
  // Usando caninv (cantidad de inventario) en lugar de ucoins
  GET_PRODUCTOS_MIN: `
    SELECT 
      ins.id,
      ins.nomins                                   AS nombre,
      LTRIM(RTRIM(COALESCE(ins.referencia, '')))   AS referencia,
      ins.ultimo_costo                             AS ultimoCosto,
      COALESCE(SUM(inv.caninv), 0)                 AS stock,
      COALESCE(SUM(inv.valinv), 0)                 AS precioInventario,
      ins.undins                                   AS unidadMedidaCodigo,
      m.nommed                                     AS unidadMedidaNombre,
      ins.tasa_iva                                 AS tasaIva
    FROM ${TABLE_NAMES.productos} ins
    LEFT JOIN inv_invent inv ON inv.codins = ins.codins
      AND (@codalm IS NULL OR inv.codalm = @codalm)
    LEFT JOIN inv_medidas m ON m.codmed = ins.Codigo_Medida
    WHERE ins.activo = 1
    GROUP BY ins.id, ins.nomins, ins.referencia, ins.ultimo_costo, ins.undins, m.nommed, ins.tasa_iva
    ORDER BY ins.nomins
  `,

  // Obtener facturas con detalles
  GET_FACTURAS: `
    SELECT 
      f.id,
      f.numero_factura as numeroFactura,
      f.fecha_factura as fechaFactura,
      f.fecha_vencimiento as fechaVencimiento,
      f.cliente_id as clienteId,
      f.vendedor_id as vendedorId,
      f.remision_id as remisionId,
      f.pedido_id as pedidoId,
      f.subtotal,
      f.descuento_valor as descuentoValor,
      f.iva_valor as ivaValor,
      f.total,
      f.observaciones,
      f.estado,
      f.cufe,
      f.empresa_id as empresaId,
      f.fecha_timbrado as fechaTimbrado,
      -- Obtener todas las remisiones relacionadas con esta factura
      -- Buscar tanto por factura_id en remisiones como por remision_id en factura
      STUFF((
        SELECT ',' + CAST(r.id AS VARCHAR)
        FROM ${TABLE_NAMES.remisiones} r
        WHERE r.factura_id = f.id OR r.id = f.remision_id
        FOR XML PATH('')
      ), 1, 1, '') as remisionesIds
    FROM ${TABLE_NAMES.facturas} f
    ORDER BY f.fecha_factura DESC
  `,

  // Obtener detalles de facturas
  GET_FACTURAS_DETALLE: `
    SELECT 
      fd.id,
      fd.factura_id as facturaId,
      fd.producto_id as productoId,
      fd.cantidad,
      fd.precio_unitario as precioUnitario,
      fd.descuento_porcentaje as descuentoPorcentaje,
      fd.iva_porcentaje as ivaPorcentaje,
      fd.descripcion,
      fd.subtotal,
      fd.valor_iva as valorIva,
      fd.total
    FROM ${TABLE_NAMES.facturas_detalle} fd
  `,

  // Obtener cotizaciones - Conectado con ven_cotizacion y ven_detacotizacion
  GET_COTIZACIONES: `
    SELECT 
      c.id,
      c.numcot               AS numeroCotizacion,
      c.fecha                AS fechaCotizacion,
      c.fecha_vence          AS fechaVencimiento,
      c.codter               AS codter,
      COALESCE(cli.id, NULL) AS clienteId,
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
    LEFT JOIN ${TABLE_NAMES.clientes} cli ON LTRIM(RTRIM(cli.codter)) = LTRIM(RTRIM(c.codter)) AND cli.activo = 1
    LEFT JOIN ${TABLE_NAMES.vendedores} v ON LTRIM(RTRIM(ISNULL(v.codven, ''))) = LTRIM(RTRIM(ISNULL(c.cod_vendedor, ''))) AND v.Activo = 1
    ORDER BY c.fecha DESC
  `,

  // Obtener detalles de cotizaciones - Conectado con ven_detacotizacion
  // cod_producto es CHAR(8) en ven_detacotizacion, necesitamos obtener el id del producto
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

  // Obtener pedidos
  GET_PEDIDOS: `
    SELECT 
      p.id,
      p.numero_pedido as numeroPedido,
      p.fecha_pedido as fechaPedido,
      p.cliente_id as clienteId,
      p.vendedor_id as vendedorId,
      p.cotizacion_id as cotizacionId,
      p.subtotal,
      p.descuento_valor as descuentoValor,
      p.iva_valor as ivaValor,
      p.total,
      p.observaciones,
      p.estado,
      p.empresa_id as empresaId,
      p.fecha_entrega_estimada as fechaEntregaEstimada,
      p.lista_precio_id as listaPrecioId,
      p.descuento_porcentaje as descuentoPorcentaje,
      p.iva_porcentaje as ivaPorcentaje,
      p.impoconsumo_valor as impoconsumoValor,
      p.instrucciones_entrega as instruccionesEntrega
    FROM ${TABLE_NAMES.pedidos} p
    ORDER BY p.fecha_pedido DESC
  `,

  // Obtener detalles de pedidos
  GET_PEDIDOS_DETALLE: `
    SELECT 
      pd.id,
      pd.pedido_id as pedidoId,
      pd.producto_id as productoId,
      pd.cantidad,
      pd.precio_unitario as precioUnitario,
      pd.descuento_porcentaje as descuentoPorcentaje,
      pd.iva_porcentaje as ivaPorcentaje,
      pd.descripcion,
      pd.subtotal,
      pd.valor_iva as valorIva,
      pd.total
    FROM ${TABLE_NAMES.pedidos_detalle} pd
  `,

  // Obtener remisiones
  GET_REMISIONES: `
    SELECT 
      r.id,
      r.numero_remision as numeroRemision,
      r.fecha_remision as fechaRemision,
      r.pedido_id as pedidoId,
      r.factura_id as facturaId,
      r.cliente_id as clienteId,
      r.vendedor_id as vendedorId,
      r.subtotal,
      r.descuento_valor as descuentoValor,
      r.iva_valor as ivaValor,
      r.total,
      r.observaciones,
      r.estado,
      r.empresa_id as empresaId,
      r.estado_envio as estadoEnvio,
      r.metodo_envio as metodoEnvio,
      r.transportadora_id as transportadoraId,
      r.transportadora,
      r.numero_guia as numeroGuia,
      r.fecha_despacho as fechaDespacho
    FROM ${TABLE_NAMES.remisiones} r
    ORDER BY r.fecha_remision DESC
  `,

  // Obtener detalles de remisiones
  GET_REMISIONES_DETALLE: `
    SELECT 
      rd.id,
      rd.remision_id as remisionId,
      rd.producto_id as productoId,
      rd.cantidad,
      rd.precio_unitario as precioUnitario,
      rd.descuento_porcentaje as descuentoPorcentaje,
      rd.iva_porcentaje as ivaPorcentaje,
      rd.descripcion,
      rd.subtotal,
      rd.valor_iva as valorIva,
      rd.total
    FROM ${TABLE_NAMES.remisiones_detalle} rd
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
      nombre,
      isreceta,
      requiere_empaques,
      estado,
      imgruta
    FROM ${TABLE_NAMES.categorias}
    WHERE estado = 1
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
