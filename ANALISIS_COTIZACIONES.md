# 📊 Análisis: Cotizaciones - Base de Datos vs Frontend

## ✅ Conexión Realizada

Las tablas **`ven_cotizacion`** y **`ven_detacotizacion`** han sido conectadas correctamente en el backend.

---

## 📋 Estructura de Tablas en Base de Datos

### Tabla: `ven_cotizacion` (Cabecera)

| Campo BD | Tipo | Descripción | Usado en Frontend |
|----------|------|-------------|-------------------|
| `id` | bigint | ID único (identity) | ✅ Sí (como `id`) |
| `codalm` | char(3) | Código de almacén/bodega | ✅ Sí (como `empresaId`) |
| `numcot` | char(8) | Número de cotización | ✅ Sí (como `numeroCotizacion`) |
| `codter` | varchar(15) | Código de tercero/cliente | ✅ Sí (como `clienteId`) |
| `fecha` | date | Fecha de cotización | ✅ Sí (como `fechaCotizacion`) |
| `fecha_vence` | date | Fecha de vencimiento | ✅ Sí (como `fechaVencimiento`) |
| `cod_vendedor` | char(10) | Código de vendedor | ✅ Sí (como `vendedorId`) |
| `formapago` | nchar(2) | Forma de pago | ❌ **NO** - Disponible en BD |
| `valor_anticipo` | numeric | Valor de anticipo | ❌ **NO** - Disponible en BD |
| `subtotal` | numeric | Subtotal | ✅ Sí |
| `val_iva` | numeric | Valor de IVA | ✅ Sí (como `ivaValor`) |
| `val_descuento` | numeric | Valor de descuento | ✅ Sí (como `descuentoValor`) |
| `observa` | varchar(200) | Observaciones | ✅ Sí (como `observaciones`) |
| `cod_usuario` | varchar(10) | Código de usuario | ❌ **NO** - Disponible en BD |
| `num_orden_compra` | int | Número de orden de compra | ❌ **NO** - Disponible en BD |
| `fecha_aprobacion` | date | Fecha de aprobación | ❌ **NO** - Disponible en BD |
| `fecsys` | datetime | Fecha del sistema | ❌ **NO** - Disponible en BD |
| `estado` | char(1) | Estado (B/E/A/R/V) | ✅ Sí (mapeado) |
| `id_usuario` | int | ID de usuario | ❌ **NO** - Disponible en BD |
| `COD_TARIFA` | char(2) | Código de tarifa | ❌ **NO** - Disponible en BD |

### Tabla: `ven_detacotizacion` (Detalle)

| Campo BD | Tipo | Descripción | Usado en Frontend |
|----------|------|-------------|-------------------|
| `id` | bigint | ID único (identity) | ✅ Sí |
| `id_cotizacion` | bigint | ID de cotización (FK) | ✅ Sí (como `cotizacionId`) |
| `num_factura` | char(8) | Número de factura relacionada | ❌ **NO** - Disponible en BD |
| `cod_producto` | char(8) | Código de producto | ✅ Sí (como `codProducto`) |
| `cantidad` | numeric | Cantidad | ✅ Sí |
| `cant_facturada` | numeric | Cantidad facturada | ❌ **NO** - Disponible en BD |
| `valor` | numeric | Valor total del item | ✅ Sí (como `total`) |
| `codigo_medida` | char(3) | Código de medida | ❌ **NO** - Disponible en BD |
| `tasa_descuento` | numeric | Tasa de descuento (%) | ✅ Sí (como `descuentoPorcentaje`) |
| `tasa_iva` | numeric | Tasa de IVA (%) | ✅ Sí (como `ivaPorcentaje`) |
| `estado` | char(1) | Estado del item | ❌ **NO** - Disponible en BD |
| `qtycot` | numeric | Cantidad cotizada | ❌ **NO** - Disponible en BD |
| `preciound` | numeric | Precio unitario | ✅ Sí (como `precioUnitario`) |

---

## 🔍 Comparación: Frontend vs Base de Datos

### ✅ Campos que SÍ están en BD y se usan en Frontend

**Cabecera:**
- `id`, `numeroCotizacion`, `fechaCotizacion`, `fechaVencimiento`
- `clienteId` (mapeado desde `codter`)
- `vendedorId` (mapeado desde `cod_vendedor`)
- `subtotal`, `descuentoValor`, `ivaValor`, `total`
- `observaciones` (mapeado desde `observa`)
- `estado` (mapeado)
- `empresaId` (mapeado desde `codalm`)

**Detalle:**
- `id`, `cotizacionId`, `productoId`, `codProducto`
- `cantidad`, `precioUnitario`, `descuentoPorcentaje`, `ivaPorcentaje`
- `subtotal`, `valorIva`, `total`

### ❌ Campos que están en BD pero NO se usan en Frontend

**Cabecera (`ven_cotizacion`):**
1. **`formapago`** (nchar(2)) - Forma de pago
   - **Recomendación**: Agregar selector de forma de pago en el formulario

2. **`valor_anticipo`** (numeric) - Valor de anticipo
   - **Recomendación**: Agregar campo opcional para anticipos

3. **`cod_usuario`** (varchar(10)) - Código de usuario que creó
   - **Recomendación**: Mostrar en vista de detalle (solo lectura)

4. **`num_orden_compra`** (int) - Número de orden de compra del cliente
   - **Recomendación**: Agregar campo opcional para referencia externa

5. **`fecha_aprobacion`** (date) - Fecha de aprobación
   - **Recomendación**: Mostrar cuando estado es "APROBADA"

6. **`fecsys`** (datetime) - Fecha de creación del sistema
   - **Recomendación**: Mostrar en vista de detalle (solo lectura)

7. **`id_usuario`** (int) - ID de usuario
   - **Recomendación**: Usar para auditoría (solo lectura)

8. **`COD_TARIFA`** (char(2)) - Código de tarifa
   - **Recomendación**: Agregar selector si hay múltiples tarifas

**Detalle (`ven_detacotizacion`):**
1. **`num_factura`** (char(8)) - Número de factura relacionada
   - **Recomendación**: Mostrar cuando el item ya fue facturado

2. **`cant_facturada`** (numeric) - Cantidad facturada
   - **Recomendación**: Mostrar progreso de facturación (cantidad vs cant_facturada)

3. **`codigo_medida`** (char(3)) - Código de medida
   - **Recomendación**: Ya se obtiene del producto, pero se puede validar

4. **`estado`** (char(1)) - Estado del item
   - **Recomendación**: Usar para items aprobados/rechazados individualmente

5. **`qtycot`** (numeric) - Cantidad cotizada
   - **Recomendación**: Verificar si es diferente de `cantidad` o es redundante

### ⚠️ Campos que están en Frontend pero NO están en BD

**Cabecera:**
1. **`observacionesInternas`** - No existe en BD
   - **Recomendación**: Usar campo `observa` existente o agregar campo nuevo en BD

2. **`listaPrecioId`** - No existe en BD
   - **Recomendación**: Agregar campo en BD si se necesita lista de precios específica

3. **`descuentoPorcentaje`** - No existe en BD (solo `val_descuento`)
   - **Recomendación**: Calcular desde `val_descuento` y `subtotal` o agregar campo

4. **`ivaPorcentaje`** - No existe en BD (solo `val_iva`)
   - **Recomendación**: Calcular desde `val_iva` y `subtotal` o agregar campo

5. **`domicilios`** - No existe en BD
   - **Recomendación**: Eliminar del frontend o agregar campo en BD

6. **`approvedItems`** - No existe en BD
   - **Recomendación**: Usar campo `estado` en `ven_detacotizacion` para items aprobados

**Detalle:**
1. **`descripcion`** - No existe en BD
   - **Recomendación**: Obtener desde `inv_insumos.nomins` (ya implementado)

---

## 📝 Recomendaciones para el Frontend

### 🔵 Campos a AGREGAR en el Frontend

1. **Forma de Pago** (`formapago`)
   - Agregar selector en el formulario de cotización
   - Valores comunes: "01" (Contado), "02" (Crédito), etc.

2. **Valor de Anticipo** (`valor_anticipo`)
   - Agregar campo numérico opcional
   - Mostrar en resumen de totales

3. **Número de Orden de Compra** (`num_orden_compra`)
   - Agregar campo de texto opcional
   - Útil para referencia del cliente

4. **Fecha de Aprobación** (`fecha_aprobacion`)
   - Mostrar en vista de detalle cuando estado es "APROBADA"
   - Solo lectura

5. **Cantidad Facturada** (`cant_facturada` en detalle)
   - Mostrar progreso: "X de Y facturados"
   - Útil para ver qué items ya fueron facturados

6. **Número de Factura** (`num_factura` en detalle)
   - Mostrar cuando un item ya tiene factura asociada
   - Enlace a la factura si es posible

### 🔴 Campos a ELIMINAR o AJUSTAR en el Frontend

1. **`observacionesInternas`**
   - **Opción A**: Eliminar y usar solo `observaciones`
   - **Opción B**: Agregar campo en BD para observaciones internas

2. **`domicilios`**
   - **Recomendación**: Eliminar si no se usa o agregar campo en BD

3. **`listaPrecioId`**
   - **Recomendación**: Eliminar si no se implementa o agregar campo en BD

4. **`descuentoPorcentaje` y `ivaPorcentaje`** (en cabecera)
   - **Recomendación**: Calcular desde valores existentes o eliminar
   - Los porcentajes ya están en el detalle (`tasa_descuento`, `tasa_iva`)

5. **`approvedItems`**
   - **Recomendación**: Usar campo `estado` en `ven_detacotizacion` para tracking

### 🟡 Campos a MOSTRAR (solo lectura)

1. **`cod_usuario`** - Usuario que creó la cotización
2. **`fecsys`** - Fecha de creación del sistema
3. **`id_usuario`** - ID de usuario (para auditoría)
4. **`COD_TARIFA`** - Código de tarifa aplicada

---

## 🔧 Cambios Realizados en el Backend

1. ✅ Actualizado `TABLE_NAMES` para usar `ven_cotizacion` y `ven_detacotizacion`
2. ✅ Corregidas todas las referencias en queries SQL
3. ✅ Mejorada query `GET_COTIZACIONES` para incluir más campos de BD
4. ✅ Mejorada query `GET_COTIZACIONES_DETALLE` para incluir todos los campos

---

## 📊 Resumen de Campos

| Categoría | Cantidad |
|-----------|----------|
| Campos en BD (cabecera) | 20 |
| Campos en BD (detalle) | 13 |
| Campos usados en Frontend (cabecera) | 12 |
| Campos usados en Frontend (detalle) | 9 |
| **Campos disponibles pero no usados** | **8 (cabecera) + 5 (detalle)** |
| **Campos en Frontend sin BD** | **6 (cabecera) + 1 (detalle)** |

---

## ✅ Estado Actual

- ✅ Backend conectado correctamente con `ven_cotizacion` y `ven_detacotizacion`
- ✅ Queries actualizadas para incluir todos los campos disponibles
- ✅ Mapeo de estados funcionando correctamente
- ⚠️ Frontend puede aprovechar más campos de la BD
- ⚠️ Algunos campos del frontend no tienen correspondencia en BD

