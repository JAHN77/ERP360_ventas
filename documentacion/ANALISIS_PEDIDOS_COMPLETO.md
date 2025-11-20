# Análisis Completo: Conexión Frontend-Backend-BD para Pedidos

## 📊 Estructura Real de la Base de Datos

### Tabla: `ven_pedidos` (Encabezado)
**NOTA**: La estructura real puede variar. Según `create_pedidos_table.sql` y `database_structure.json`:

#### Columnas Esperadas (Script de Creación):
- `id` UNIQUEIDENTIFIER (PK) - O puede ser INT IDENTITY
- `numped` CHAR(8) NOT NULL - Número de pedido (formato: PED0001)
- `fecped` DATE NOT NULL - Fecha del pedido
- `fec_entrega_estimada` DATE - Fecha estimada de entrega
- `codter` CHAR(10) NOT NULL - Código del cliente (FK a con_terceros.codter)
- `cod_vendedor` CHAR(10) - Código del vendedor (FK a ven_vendedor.codven)
- `id_cotizacion` INT - ID de la cotización origen
- `codalm` CHAR(3) - Código de almacén
- `subtotal` DECIMAL(18,2) DEFAULT 0
- `val_descuento` DECIMAL(18,2) DEFAULT 0
- `val_iva` DECIMAL(18,2) DEFAULT 0
- `total` DECIMAL(18,2) DEFAULT 0
- `impoconsumo` DECIMAL(18,2) DEFAULT 0
- `tasa_descuento` DECIMAL(5,2) DEFAULT 0
- `tasa_iva` DECIMAL(5,2) DEFAULT 0
- `estado` CHAR(1) DEFAULT 'B' - B=BORRADOR, C=CONFIRMADO, P=EN_PROCESO, R=REMITIDO, X=CANCELADO
- `observa` VARCHAR(500) - Observaciones
- `instrucciones_entrega` VARCHAR(500)
- `lista_precio` VARCHAR(50)
- `cod_usuario` CHAR(10)
- `id_usuario` INT
- `fecsys` DATETIME DEFAULT GETDATE()
- `fecmod` DATETIME

#### Columnas que el Código Actual Espera (pero pueden no existir):
- `numero_pedido` VARCHAR(50) - Puede ser que la BD use `numped` en su lugar
- `fecha_pedido` DATE - Puede ser `fecped`
- `cliente_id` VARCHAR(20) - Puede ser `codter`
- `vendedor_id` VARCHAR(20) - Puede ser `cod_vendedor`
- `cotizacion_id` INT - Puede ser `id_cotizacion`
- `empresa_id` INT - Puede ser `codalm`

### Tabla: `ven_detapedidos` (Detalle)
**Estructura Real Confirmada** (según `database_structure.json`):

- `numped` CHAR(8) NOT NULL - FK a ven_pedidos.numped (NO `pedido_id`)
- `codins` CHAR(8) NOT NULL - Código de producto (FK a inv_insumos.codins) (NO `producto_id`)
- `valins` NUMERIC NOT NULL - Valor unitario del insumo
- `canped` NUMERIC NOT NULL - Cantidad pedida
- `canent` NUMERIC - Cantidad entregada
- `canfac` NUMERIC - Cantidad facturada
- `ivaped` NUMERIC - IVA del pedido (valor)
- `dctped` NUMERIC - Descuento del pedido (valor)
- `estped` CHAR(1) - Estado del item: B=BORRADOR, C=CONFIRMADO, E=ENTREGADO, F=FACTURADO
- `codalm` CHAR(3) - Código de almacén
- `serial` VARCHAR(30) - Número de serie
- `reservado` BIT DEFAULT 0
- `usureserva` CHAR(10)
- `numfac` VARCHAR(12) - Número de factura relacionada
- `DiasGar` INT - Días de garantía
- `Numord` CHAR(8) - Número de orden
- `Fecsys` DATETIME
- `msisdn` VARCHAR(20)
- `imei` VARCHAR(20)
- `iccid` VARCHAR(20)
- `codplan` CHAR(2)
- `feccargo` DATETIME NOT NULL
- `codtec` VARCHAR(4) NOT NULL

**Columnas que el Código Actual Espera (pero NO existen)**:
- `id` INT IDENTITY - Puede no existir
- `pedido_id` INT - NO existe, usar `numped`
- `producto_id` INT - NO existe, usar `codins`
- `cantidad` NUMERIC - Usar `canped`
- `precio_unitario` NUMERIC - Usar `valins`
- `descuento_porcentaje` NUMERIC - Calcular desde `dctped`
- `iva_porcentaje` NUMERIC - Calcular desde `ivaped`
- `descripcion` VARCHAR - Obtener desde inv_insumos
- `subtotal` NUMERIC - Calcular
- `valor_iva` NUMERIC - Usar `ivaped`
- `total` NUMERIC - Calcular

## 🔍 Análisis del Código Actual

### Backend (`app/back/server.cjs`)

#### GET /api/pedidos
- ✅ Usa `QUERIES.GET_PEDIDOS` que espera columnas como `numero_pedido`, `fecha_pedido`, `cliente_id`
- ❌ **PROBLEMA**: La BD real puede usar `numped`, `fecped`, `codter`
- ✅ Sincroniza estados con remisiones (buena práctica)

#### GET /api/pedidos-detalle
- ✅ Usa `QUERIES.GET_PEDIDOS_DETALLE` que espera `pedido_id`, `producto_id`
- ❌ **PROBLEMA**: La BD real usa `numped`, `codins`

#### POST /api/pedidos
- ✅ Valida cliente, vendedor, cotización
- ❌ **PROBLEMA**: Inserta usando columnas como `numero_pedido`, `cliente_id`, `pedido_id`, `producto_id`
- ❌ **PROBLEMA**: La BD real puede requerir `numped`, `codter`, `codins`

#### PUT /api/pedidos/:id
- ✅ Actualiza estado y otros campos
- ❌ **PROBLEMA**: Usa columnas que pueden no existir

### Backend (`app/back/services/dbConfig.cjs`)

#### GET_PEDIDOS
- ❌ **PROBLEMA**: Espera columnas que pueden no coincidir con la BD real
- Necesita mapeo de `numped` → `numeroPedido`, `fecped` → `fechaPedido`, etc.

#### GET_PEDIDOS_DETALLE
- ❌ **PROBLEMA**: Espera `pedido_id`, `producto_id` que no existen
- Necesita usar `numped`, `codins` y hacer JOIN con `inv_insumos` para obtener `id` del producto

### Frontend (`app/front/types.ts`)

#### Interface Pedido
- ✅ Estructura correcta para el frontend
- ✅ Campos opcionales bien definidos
- ⚠️ Puede necesitar campos adicionales de la BD real

### Frontend (`app/front/contexts/DataContext.tsx`)

#### fetchMainTransactionalData
- ✅ Carga pedidos y detalles
- ⚠️ Depende de que el backend devuelva datos correctamente mapeados

### Frontend (`app/front/pages/PedidosPage.tsx`)

- ✅ Usa `useData()` para obtener pedidos
- ✅ Filtrado y búsqueda funcionan
- ⚠️ Depende de que los datos estén correctamente estructurados

## 🎯 Plan de Acción

### 1. Verificar Estructura Real de `ven_pedidos`
- Ejecutar query para obtener estructura real
- Comparar con script de creación

### 2. Actualizar Queries en `dbConfig.cjs`
- Mapear columnas reales a nombres del frontend
- Usar JOINs necesarios para obtener datos relacionados

### 3. Actualizar Endpoints en `server.cjs`
- GET /api/pedidos: Mapear columnas reales
- GET /api/pedidos-detalle: Usar `numped` y `codins`, hacer JOIN con productos
- POST /api/pedidos: Insertar usando columnas reales
- PUT /api/pedidos: Actualizar usando columnas reales

### 4. Implementar Paginación
- Agregar paginación a GET /api/pedidos (similar a remisiones)

### 5. Actualizar Frontend si es Necesario
- Verificar que los tipos coincidan
- Asegurar que el mapeo de datos funcione correctamente

## 📝 Notas Importantes

1. **Relación entre tablas**:
   - `ven_pedidos.numped` → `ven_detapedidos.numped` (NO `pedido_id`)
   - `ven_detapedidos.codins` → `inv_insumos.codins` (NO `producto_id`)
   - Para obtener el `id` del producto, hacer JOIN con `inv_insumos`

2. **Estados**:
   - BD usa CHAR(1): 'B', 'C', 'P', 'R', 'X'
   - Frontend espera: 'BORRADOR', 'CONFIRMADO', 'EN_PROCESO', 'REMITIDO', 'CANCELADO'
   - Necesario mapeo bidireccional

3. **Números de Pedido**:
   - BD puede usar `numped CHAR(8)` (formato: PED0001)
   - Frontend espera `numeroPedido` (formato: PED-001)
   - Necesario formateo

4. **IDs vs Códigos**:
   - BD usa códigos (`codter`, `codins`, `cod_vendedor`)
   - Frontend puede esperar IDs numéricos
   - Necesario mapeo y JOINs

