const mapEstadoToDb = (estado) => {
  if (!estado) return 'B'; // Por defecto BORRADOR
  const estadoStr = String(estado).trim().toUpperCase();
  const estadoMap = {
    'BORRADOR': 'B',
    'ENVIADA': 'E',
    'APROBADA': 'A',
    'RECHAZADA': 'R',
    'VENCIDA': 'V',
    'CONFIRMADO': 'C',
    'EN_PROCESO': 'P',
    'TIMBRANDO': 'P', // Usar 'P' para estado de timbrado en proceso
    'PARCIALMENTE_REMITIDO': 'L', // FIXED: Cambiado de 'P' a 'L' para evitar colisión con TIMBRANDO
    'REMITIDO': 'M', // Cambiar de 'M' a 'R' para REMITIDO -> FIXED: Usar 'M' para evitar colisión con RECHAZADA ('R')
    'CANCELADO': 'X',
    'EN_TRANSITO': 'T',
    'ENTREGADO': 'D',
    'ACEPTADA': 'A',
    'ANULADA': 'X'
  };
  const estadoMapeado = estadoMap[estadoStr] || estadoStr.substring(0, 1).toUpperCase();
  // Asegurar que nunca exceda 1 carácter si la columna es CHAR(1)
  return estadoMapeado.substring(0, 1);
};

const mapEstadoFromDb = (estado) => {
  if (!estado) return estado;
  const estadoStr = String(estado).trim().toUpperCase();
  const estadoMap = {
    'B': 'BORRADOR',
    'E': 'ENVIADA',
    'A': 'APROBADA',
    'R': 'RECHAZADA',
    'V': 'VENCIDA',
    'C': 'CONFIRMADO',
    'P': 'TIMBRANDO', // 'P' = TIMBRANDO (estado temporal mientras DIAN procesa)
    'L': 'PARCIALMENTE_REMITIDO', // FIXED: 'L' = PARCIALMENTE_REMITIDO
    'PR': 'PARCIALMENTE_REMITIDO', // Mantener compatibilidad legacy
    'M': 'REMITIDO',
    'X': 'CANCELADO',
    'T': 'EN_TRANSITO',
    'D': 'ENTREGADO',
    'AC': 'ACEPTADA',
    'AN': 'ANULADA'
  };
  return estadoMap[estadoStr] || estado;
};

/**
 * Valida y sanitiza un valor para DECIMAL(18,2)
 * Límite: -9999999999999999.99 a 9999999999999999.99
 * @param {any} value - Valor a validar (puede ser string, number, etc.)
 * @param {string} fieldName - Nombre del campo para mensajes de error
 * @returns {number} - Valor validado y redondeado a 2 decimales
 * @throws {Error} - Si el valor excede los límites o es inválido
 */
const validateDecimal18_2 = (value, fieldName = 'campo') => {
  // Normalizar valor
  let num = 0;

  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    // Limpiar formato de moneda y espacios
    let cleaned = String(value).trim().replace(/[$\s]/g, '');

    // Manejar formato europeo (1.234,56) o americano (1,234.56)
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Si tiene ambos, el último es el decimal
      const lastComma = cleaned.lastIndexOf(',');
      const lastDot = cleaned.lastIndexOf('.');
      if (lastComma > lastDot) {
        // Formato europeo: 1.234,56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato americano: 1,234.56
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      // Solo coma: determinar si es decimal o separador de miles
      const parts = cleaned.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.'); // Es decimal
      } else {
        cleaned = cleaned.replace(/,/g, ''); // Es separador de miles
      }
    }

    num = parseFloat(cleaned);
  } else {
    throw new Error(`${fieldName}: Tipo de dato inválido. Se esperaba número o string, se recibió: ${typeof value}`);
  }

  // Validar que sea un número válido
  if (!isFinite(num) || isNaN(num)) {
    throw new Error(`${fieldName}: Valor no es un número válido. Valor recibido: ${value}`);
  }

  // Límites para DECIMAL(18,2)
  const MAX_DECIMAL18_2 = 9999999999999999.99;
  const MIN_DECIMAL18_2 = -9999999999999999.99;

  // Verificar overflow ANTES de redondear
  if (num > MAX_DECIMAL18_2) {
    throw new Error(`${fieldName}: Valor ${num} excede el máximo permitido para DECIMAL(18,2): ${MAX_DECIMAL18_2}`);
  }
  if (num < MIN_DECIMAL18_2) {
    throw new Error(`${fieldName}: Valor ${num} excede el mínimo permitido para DECIMAL(18,2): ${MIN_DECIMAL18_2}`);
  }

  // Redondear estrictamente a 2 decimales usando Math.round para evitar precisión flotante
  // CRÍTICO: Usar Math.round(val * 100) / 100 para garantizar exactamente 2 decimales
  // Esto elimina cualquier error de precisión de punto flotante de JavaScript
  const rounded = Math.round(num * 100) / 100;

  // Validación final después del redondeo
  if (!isFinite(rounded) || isNaN(rounded)) {
    throw new Error(`${fieldName}: Error al redondear valor. Valor original: ${value}, Valor procesado: ${num}`);
  }

  if (Math.abs(rounded) > MAX_DECIMAL18_2) {
    throw new Error(`${fieldName}: Valor redondeado ${rounded} excede el máximo permitido: ${MAX_DECIMAL18_2}`);
  }

  // CRÍTICO: Retornar el valor redondeado directamente
  // Math.round(val * 100) / 100 garantiza exactamente 2 decimales
  // No usar parseFloat(toFixed(2)) porque puede introducir errores de precisión
  return rounded;
};

/**
 * Valida y sanitiza un valor para DECIMAL(5,2) (porcentajes)
 * Límite técnico: -999.99 a 999.99
 * Límite lógico recomendado: 0 a 100 (pero permite hasta 999.99)
 * @param {any} value - Valor a validar
 * @param {string} fieldName - Nombre del campo para mensajes de error
 * @param {boolean} enforceLogicalLimit - Si es true, limita a 0-100 (por defecto: false, permite hasta 999.99)
 * @returns {number} - Valor validado y redondeado a 2 decimales
 * @throws {Error} - Si el valor excede los límites o es inválido
 */
const validateDecimal5_2 = (value, fieldName = 'campo', enforceLogicalLimit = false) => {
  // Normalizar valor
  let num = 0;

  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    num = value;
  } else if (typeof value === 'string') {
    // Limpiar formato
    let cleaned = String(value).trim().replace(/[%\s]/g, '');

    // Manejar formato con coma decimal
    if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }

    num = parseFloat(cleaned);
  } else {
    throw new Error(`${fieldName}: Tipo de dato inválido. Se esperaba número o string, se recibió: ${typeof value}`);
  }

  // Validar que sea un número válido
  if (!isFinite(num) || isNaN(num)) {
    throw new Error(`${fieldName}: Valor no es un número válido. Valor recibido: ${value}`);
  }

  // Límites para DECIMAL(5,2)
  const MAX_DECIMAL5_2 = 999.99;
  const MIN_DECIMAL5_2 = -999.99;

  // Límite lógico para porcentajes (0-100)
  const MAX_LOGICAL = 100;
  const MIN_LOGICAL = 0;

  // Verificar overflow ANTES de redondear
  if (num > MAX_DECIMAL5_2) {
    throw new Error(`${fieldName}: Valor ${num} excede el máximo técnico permitido para DECIMAL(5,2): ${MAX_DECIMAL5_2}`);
  }
  if (num < MIN_DECIMAL5_2) {
    throw new Error(`${fieldName}: Valor ${num} excede el mínimo técnico permitido para DECIMAL(5,2): ${MIN_DECIMAL5_2}`);
  }

  // Si se requiere límite lógico, validar también
  if (enforceLogicalLimit) {
    if (num > MAX_LOGICAL) {
      throw new Error(`${fieldName}: Valor ${num} excede el límite lógico permitido (100%). Valor recibido: ${value}`);
    }
    if (num < MIN_LOGICAL) {
      throw new Error(`${fieldName}: Valor ${num} es menor que el mínimo lógico permitido (0%). Valor recibido: ${value}`);
    }
  }

  // Redondear estrictamente a 2 decimales usando Math.round
  // CRÍTICO: Usar Math.round(val * 100) / 100 para garantizar exactamente 2 decimales
  // Esto elimina cualquier error de precisión de punto flotante de JavaScript
  const rounded = Math.round(num * 100) / 100;

  // Validación final después del redondeo
  if (!isFinite(rounded) || isNaN(rounded)) {
    throw new Error(`${fieldName}: Error al redondear valor. Valor original: ${value}, Valor procesado: ${num}`);
  }

  if (Math.abs(rounded) > MAX_DECIMAL5_2) {
    throw new Error(`${fieldName}: Valor redondeado ${rounded} excede el máximo permitido: ${MAX_DECIMAL5_2}`);
  }

  // CRÍTICO: Retornar el valor redondeado directamente
  // Math.round(val * 100) / 100 garantiza exactamente 2 decimales
  return rounded;
};

/**
 * Valida un array de items de pedido antes de insertarlos
 * @param {Array} items - Array de items a validar
 * @throws {Error} - Si algún item tiene valores inválidos
 */
const validatePedidoItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items: El array de items está vacío o no es válido');
  }

  items.forEach((item, index) => {
    const itemPrefix = `Item ${index + 1}`;

    // Validar productoId
    if (!item.productoId) {
      throw new Error(`${itemPrefix}: productoId es requerido`);
    }

    const productoIdNum = typeof item.productoId === 'number' ? item.productoId : parseInt(item.productoId, 10);
    if (isNaN(productoIdNum) || productoIdNum <= 0) {
      throw new Error(`${itemPrefix}: productoId inválido. Valor recibido: ${item.productoId}`);
    }

    // Validar cantidad (DECIMAL(18,2) pero debe ser positivo)
    try {
      const cantidad = validateDecimal18_2(item.cantidad, `${itemPrefix}.cantidad`);
      if (cantidad <= 0) {
        throw new Error(`${itemPrefix}.cantidad: La cantidad debe ser mayor que 0. Valor recibido: ${item.cantidad}`);
      }
    } catch (error) {
      throw new Error(`${itemPrefix}.cantidad: ${error.message}`);
    }

    // Validar precioUnitario (DECIMAL(18,2) pero debe ser no negativo)
    try {
      const precioUnitario = validateDecimal18_2(item.precioUnitario, `${itemPrefix}.precioUnitario`);
      if (precioUnitario < 0) {
        throw new Error(`${itemPrefix}.precioUnitario: El precio unitario no puede ser negativo. Valor recibido: ${item.precioUnitario}`);
      }
    } catch (error) {
      throw new Error(`${itemPrefix}.precioUnitario: ${error.message}`);
    }

    // Validar descuentoPorcentaje (DECIMAL(5,2), límite lógico 0-100)
    try {
      validateDecimal5_2(item.descuentoPorcentaje || 0, `${itemPrefix}.descuentoPorcentaje`, true);
    } catch (error) {
      throw new Error(`${itemPrefix}.descuentoPorcentaje: ${error.message}`);
    }

    // Validar ivaPorcentaje (DECIMAL(5,2), límite lógico 0-100)
    try {
      validateDecimal5_2(item.ivaPorcentaje || 0, `${itemPrefix}.ivaPorcentaje`, true);
    } catch (error) {
      throw new Error(`${itemPrefix}.ivaPorcentaje: ${error.message}`);
    }

    // Validar valorIva (DECIMAL(18,2))
    try {
      validateDecimal18_2(item.valorIva || 0, `${itemPrefix}.valorIva`);
    } catch (error) {
      throw new Error(`${itemPrefix}.valorIva: ${error.message}`);
    }

    // Validar total (DECIMAL(18,2))
    try {
      validateDecimal18_2(item.total || 0, `${itemPrefix}.total`);
    } catch (error) {
      throw new Error(`${itemPrefix}.total: ${error.message}`);
    }
  });

  return true;
};

module.exports = {
  mapEstadoToDb,
  mapEstadoFromDb,
  validateDecimal18_2,
  validateDecimal5_2,
  validatePedidoItems
};
