# 📊 Análisis Completo de la Sección de Pedidos

## 🔍 Endpoints de Pedidos

### POST /api/pedidos - Crear Pedido

**Propósito:** Crear un nuevo pedido en el sistema.

**Validaciones:**
1. ✅ Cliente debe existir y estar activo
2. ✅ Vendedor debe existir si se proporciona
3. ✅ Cotización debe existir si se proporciona `cotizacionId`
4. ✅ Items deben tener productos válidos
5. ✅ Valores numéricos validados (subtotal, IVA, total, etc.)
6. ✅ Número de pedido único o generado automáticamente
7. ✅ Almacén/Bodega debe existir (validado a través de `empresaId`)

**Problemas Identificados:**

#### ❌ Problema 1: Validación de Almacén/Bodega
- El código valida `empresaId` pero no verifica que el almacén exista en `inv_almacen`
- Si `empresaId` no corresponde a un almacén válido, puede causar errores en items

#### ❌ Problema 2: Formato de Items desde Cotización
- Cuando se crea pedido desde cotización, los items pueden venir con estructura diferente
- El campo `codProducto` puede no estar presente en items de cotización
- Necesita mapeo correcto de `cod_producto` (CHAR(8)) a `codins`

#### ❌ Problema 3: Validación de empresaId
- `empresaId` puede venir como string pero se valida como número
- No se valida que corresponda a un almacén activo

### PUT /api/pedidos/:id - Editar Pedido

**Propósito:** Actualizar un pedido existente.

**Validaciones:**
1. ✅ El pedido debe existir
2. ✅ Solo se puede editar si está en estado `BORRADOR` o `ENVIADA`
3. ✅ No se puede editar si está en `CONFIRMADO`, `EN_PROCESO`, `PARCIALMENTE_REMITIDO`, `REMITIDO`, o `CANCELADO`
4. ✅ Si se envían items, se eliminan los antiguos y se crean nuevos
5. ✅ Valores numéricos validados

**Problemas Identificados:**

#### ⚠️ Problema 1: Actualización de Items
- Los items antiguos se eliminan completamente
- No hay validación de que los nuevos items sean válidos antes de eliminar los antiguos
- Si falla la inserción de nuevos items, se pierden los antiguos

#### ⚠️ Problema 2: Validación de empresaId en Items
- Al actualizar items, se usa `body.empresaId` que puede no estar presente
- Debería obtener `empresa_id` del pedido existente

## 🔧 Correcciones Necesarias

### Corrección 1: Validar Almacén al Crear Pedido

```javascript
// Validar que el almacén existe
const reqCheckAlmacen = new sql.Request(tx);
reqCheckAlmacen.input('codalm', sql.VarChar(10), empresaId || '001');
const almacenResult = await reqCheckAlmacen.query(`
  SELECT codalm, nomalm, activo
  FROM inv_almacen
  WHERE codalm = @codalm AND activo = 1
`);

if (almacenResult.recordset.length === 0) {
  await tx.rollback();
  return res.status(400).json({ 
    success: false, 
    message: `Almacén con código '${empresaId || '001'}' no encontrado o inactivo. Verifique que el almacén exista en la base de datos.`, 
    error: 'ALMACEN_NOT_FOUND'
  });
}
```

### Corrección 2: Mejorar Mapeo de Items desde Cotización

Cuando se crea pedido desde cotización, los items deben mapearse correctamente:
- `cod_producto` (CHAR(8)) de `ven_detacotizacion` → `codins` (CHAR(8)) para `ven_detapedidos`
- Asegurar que el `codins` existe en `inv_insumos`

### Corrección 3: Validar empresaId en Actualización de Items

Al actualizar items, obtener `empresa_id` del pedido existente:

```javascript
// Obtener empresa_id del pedido existente
const pedidoExistente = await reqCheck.query(`
  SELECT empresa_id FROM ven_pedidos WHERE id = @pedidoId
`);
const empresaIdDelPedido = pedidoExistente.recordset[0]?.empresa_id || '001';
```

### Corrección 4: Mejorar Manejo de Errores

Agregar más información de depuración cuando falla la creación de pedido:
- Log de los items que se están intentando insertar
- Log de los valores validados antes de insertar
- Log de errores SQL específicos

## 📋 Checklist de Validaciones

### Al Crear Pedido:
- [x] Cliente existe y está activo
- [x] Vendedor existe si se proporciona
- [x] Cotización existe si se proporciona
- [ ] Almacén existe y está activo (FALTA)
- [x] Items tienen productos válidos
- [x] Valores numéricos validados
- [x] Número de pedido único

### Al Editar Pedido:
- [x] Pedido existe
- [x] Estado permite edición
- [x] Items validados antes de eliminar antiguos (parcialmente)
- [ ] empresaId obtenido del pedido existente (FALTA)
- [x] Valores numéricos validados

## 🧪 Pruebas Recomendadas

1. **Crear pedido sin cotización** - Debe funcionar
2. **Crear pedido desde cotización** - Debe mapear items correctamente
3. **Crear pedido con almacén inválido** - Debe retornar error claro
4. **Editar pedido en BORRADOR** - Debe funcionar
5. **Editar pedido en CONFIRMADO** - Debe retornar error
6. **Editar pedido con items** - Debe reemplazar items correctamente
7. **Editar pedido sin items** - Debe actualizar solo encabezado

