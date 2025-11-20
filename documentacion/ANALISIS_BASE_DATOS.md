# Análisis Profundo de Base de Datos ERP360

**Fecha de Análisis:** 2024-11-10  
**Base de Datos:** Prueba_ERP360  
**Servidor:** 179.33.214.87:1434

---

## 📊 Resumen Ejecutivo

Este documento presenta un análisis exhaustivo de la base de datos `Prueba_ERP360` y su comparación con las estructuras esperadas por el código del backend y frontend de la aplicación ERP360 Comercial.

### Hallazgos Principales

1. **232 tablas** encontradas en la base de datos
2. **Discrepancias críticas** entre la estructura real y la esperada por el código
3. **Tablas faltantes** que el código intenta usar
4. **Estructuras de columnas diferentes** en tablas existentes
5. **Falta de relaciones (Foreign Keys)** definidas en la mayoría de las tablas

---

## 🔍 1. Análisis de Tablas Relevantes

### 1.1 Tablas que EXISTEN y están siendo usadas correctamente

#### ✅ `con_terceros` (Clientes)
- **Estado:** ✅ Existe y tiene datos (22,134 registros)
- **Estructura:** Compatible con el código
- **Columnas clave:**
  - `id` (INT IDENTITY) ✅
  - `codter` (VARCHAR(15)) ✅ - Número de documento
  - `nomter` (VARCHAR(150)) ✅ - Razón social
  - `nom1`, `nom2`, `apl1`, `apl2` ✅ - Nombres y apellidos
  - `TELTER`, `CELTER`, `EMAIL` ✅
  - `ciudad`, `codven` ✅
  - `cupo_credito`, `plazo`, `tasa_descuento` ✅
  - `activo` (INT) ✅
- **Observaciones:**
  - El código espera `activo` como BIT, pero la BD tiene INT (funciona con CAST)
  - Existe columna `Tipo_documento` (CHAR(2)) que el código no usa actualmente
  - Falta columna `tipos_persona` relacionada

#### ✅ `inv_insumos` (Productos)
- **Estado:** ✅ Existe y tiene datos (6,062 registros)
- **Estructura:** Mayormente compatible
- **Columnas clave:**
  - `id` (INT IDENTITY) ✅
  - `codins` (CHAR(8)) ✅
  - `nomins` (VARCHAR(150)) ✅
  - `referencia` (VARCHAR(15)) ✅
  - `codigo_linea`, `codigo_sublinea` ✅
  - `Codigo_Medida` (NCHAR(3)) ✅
  - `ultimo_costo`, `costo_promedio` ✅
  - `precio_publico`, `precio_mayorista`, `precio_minorista` ✅
  - `tasa_iva` ✅
  - `karins` (BIT) ✅ - Controla existencia
  - `activo` (BIT) ✅
- **Observaciones:**
  - La columna `codins` es CHAR(8) en BD, pero el código espera VARCHAR(50)
  - El código espera `id` para productos, pero también usa `codins` como referencia

#### ✅ `inv_invent` (Inventario)
- **Estado:** ✅ Existe y tiene datos (7,557 registros)
- **Estructura:** Compatible
- **Columnas clave:**
  - `codalm` (CHAR(3)) ✅ - Bodega/Almacén
  - `codins` (CHAR(8)) ✅ - Producto
  - `ucoins` (NUMERIC) ✅ - Unidades en existencia
  - `valinv` (NUMERIC) ✅ - Valor de inventario
- **Observaciones:**
  - No tiene columna `id` (IDENTITY) como espera el código en algunos INSERT
  - La estructura es correcta para LEFT JOINs

#### ✅ `ven_facturas` (Facturas)
- **Estado:** ✅ Existe y tiene datos (166,832 registros)
- **Estructura:** **PARCIALMENTE INCOMPATIBLE**
- **Columnas en BD:**
  - `ID` (BIGINT IDENTITY) ✅
  - `codalm` (CHAR(3)) ✅
  - `numfact` (VARCHAR(15)) - Diferente a `numero_factura`
  - `tipfac` (CHAR(2)) ✅
  - `codter` (VARCHAR(15)) ✅ - Cliente (diferente a `cliente_id`)
  - `fecfac` (DATETIME) - Diferente a `fecha_factura`
  - `venfac` (DATETIME) - Diferente a `fecha_vencimiento`
  - `codven` (CHAR(3)) - Diferente a `vendedor_id`
  - `valvta` (NUMERIC) - Diferente a `subtotal`
  - `valiva` (NUMERIC) - Diferente a `iva_valor`
  - `valdcto` (NUMERIC) - Diferente a `descuento_valor`
  - `netfac` (NUMERIC) - Diferente a `total`
  - `CUFE` (VARCHAR(600)) ✅
  - `estfac` (VARCHAR(1)) - Diferente a `estado`
- **Problemas:**
  - El código espera columnas con nombres en `snake_case` moderno (`numero_factura`, `fecha_factura`, etc.)
  - La BD usa nombres abreviados (`numfact`, `fecfac`, etc.)
  - El código NO está insertando en esta tabla correctamente
  - Las consultas SELECT no mapean correctamente las columnas

#### ✅ `ven_detafact` (Detalle de Facturas)
- **Estado:** ✅ Existe y tiene datos (506,304 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `ID` (INT IDENTITY) ✅
  - `codalm`, `tipfact`, `numfac` (CHAR(12)) - Diferente estructura
  - `codins` (VARCHAR(8)) - Diferente a `producto_id`
  - `qtyins` (NUMERIC) - Diferente a `cantidad`
  - `valins` (NUMERIC) - Diferente a `precio_unitario`
  - `ivains` (NUMERIC) - Diferente a `valor_iva`
  - `desins` (NUMERIC) - Diferente a `descuento_porcentaje`
  - `PRECIOUND` (NUMERIC) ✅
  - `id_factura` (INT) - Podría ser la relación, pero no es FK
- **Problemas:**
  - Estructura completamente diferente a la esperada
  - El código NO puede insertar aquí sin mapeo

#### ✅ `ven_cotizacion` (Cotizaciones)
- **Estado:** ✅ Existe pero **SIN DATOS** (0 registros)
- **Estructura:** **PARCIALMENTE COMPATIBLE**
- **Columnas en BD:**
  - `id` (BIGINT IDENTITY) ✅
  - `codalm` (CHAR(3)) ✅
  - `numcot` (CHAR(8)) ✅ - Diferente a `numeroCotizacion`
  - `codter` (VARCHAR(15)) ✅ - Diferente a `clienteId`
  - `fecha` (DATE) ✅ - Diferente a `fechaCotizacion`
  - `fecha_vence` (DATE) ✅ - Diferente a `fechaVencimiento`
  - `cod_vendedor` (CHAR(10)) ✅ - Diferente a `vendedorId`
  - `subtotal` (NUMERIC) ✅
  - `val_descuento` (NUMERIC) ✅ - Diferente a `descuentoValor`
  - `val_iva` (NUMERIC) ✅ - Diferente a `ivaValor`
  - `observa` (VARCHAR(200)) ✅ - Diferente a `observaciones`
  - `estado` (CHAR(1)) ✅ - Compatible con mapeo
- **Observaciones:**
  - El código SÍ está insertando aquí correctamente
  - El mapeo de columnas funciona en las consultas SELECT
  - La tabla está vacía, lo cual es normal para una nueva instalación

#### ✅ `ven_detacotizacion` (Detalle de Cotizaciones)
- **Estado:** ✅ Existe pero **SIN DATOS** (0 registros)
- **Estructura:** **COMPATIBLE**
- **Columnas en BD:**
  - `id` (BIGINT IDENTITY) ✅
  - `id_cotizacion` (BIGINT) ✅
  - `cod_producto` (CHAR(8)) ✅ - Pero el código usa INT (id de producto)
  - `cantidad` (NUMERIC) ✅
  - `preciound` (NUMERIC) ✅
  - `tasa_descuento` (NUMERIC) ✅
  - `tasa_iva` (NUMERIC) ✅
  - `valor` (NUMERIC) ✅
- **Problemas:**
  - El código inserta `cod_producto` como INT (id de producto)
  - Pero la BD espera CHAR(8) (codins del producto)
  - **CONFLICTO CRÍTICO:** El código usa `productoId` (INT) pero la BD espera `codins` (CHAR(8))

#### ⚠️ `ven_detapedidos` (Detalle de Pedidos)
- **Estado:** ⚠️ Existe pero con **ESTRUCTURA DIFERENTE** (705 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `numped` (CHAR(8)) - Diferente a `pedido_id`
  - `codins` (CHAR(8)) - Diferente a `producto_id`
  - `valins` (NUMERIC) - Diferente a `precio_unitario`
  - `canped` (NUMERIC) - Diferente a `cantidad`
  - `canent` (NUMERIC) - Cantidad entregada
  - `canfac` (NUMERIC) - Cantidad facturada
  - `ivaped` (NUMERIC) - Diferente a `valor_iva`
  - `dctped` (NUMERIC) - Diferente a `descuento_porcentaje`
  - `estped` (CHAR(1)) - Estado del pedido
  - `codalm` (CHAR(3)) ✅
- **Problemas:**
  - Esta tabla NO tiene la estructura que el código espera
  - El código intenta INSERT con columnas que no existen
  - **NO HAY TABLA `ven_pedidos` (encabezado)** en la BD

#### ❌ `ven_pedidos` (Pedidos - Encabezado)
- **Estado:** ❌ **NO EXISTE EN LA BASE DE DATOS**
- **Problema CRÍTICO:**
  - El código intenta hacer INSERT, UPDATE, SELECT en esta tabla
  - La tabla NO existe en `Prueba_ERP360`
  - Esto causará errores en todas las operaciones de pedidos
- **Acción requerida:** CREAR LA TABLA

#### ⚠️ `ven_recibos` (Remisiones)
- **Estado:** ⚠️ Existe pero con **ESTRUCTURA DIFERENTE** (9,203 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `id` (INT IDENTITY) ✅
  - `codalm` (CHAR(3)) ✅
  - `numrec` (INT) - Diferente a `numero_remision` (VARCHAR)
  - `tipdoc` (CHAR(2)) ✅
  - `codter` (VARCHAR(15)) ✅ - Diferente a `cliente_id`
  - `fecrec` (DATETIME) - Diferente a `fecha_remision`
  - `doccoc` (VARCHAR(12)) ✅
  - `numped` (NUMERIC) - Podría ser `pedido_id`
  - `valrec` (NUMERIC) - Diferente a `total`
  - `estrec` (CHAR(1)) - Diferente a `estado`
  - `observa` (VARCHAR(100)) ✅ - Diferente a `observaciones`
- **Problemas:**
  - El código espera columnas modernas que no existen
  - `numero_remision` debería ser VARCHAR(50) pero la BD tiene INT
  - No hay columnas para `estado_envio`, `metodo_envio`, `transportadora_id`, `numero_guia`, `fecha_despacho`
  - **El código NO puede insertar remisiones correctamente**

#### ⚠️ `ven_detarecibo` (Detalle de Remisiones)
- **Estado:** ⚠️ Existe pero con **ESTRUCTURA DIFERENTE** (4,550 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `id` (INT IDENTITY) ✅
  - `codalm` (CHAR(3)) ✅
  - `tipdoc` (CHAR(2)) ✅
  - `numrec` (NUMERIC) - Diferente a `remision_id` (INT)
  - `valcuo` (NUMERIC) - Valor cuota
  - `forpag` (CHAR(2)) - Forma de pago
  - `numdoc` (CHAR(15)) - Número documento
  - `abocuo` (NUMERIC) - Abono cuota
  - `salcuo` (NUMERIC) - Saldo cuota
- **Problemas:**
  - Esta tabla parece ser para **pagos/recibos de caja**, NO para detalle de remisiones de productos
  - El código espera `producto_id`, `cantidad`, `precio_unitario`, etc.
  - **TABLA COMPLETAMENTE DIFERENTE A LO ESPERADO**

#### ✅ `ven_notas` (Notas de Crédito)
- **Estado:** ✅ Existe y tiene datos (191 registros)
- **Estructura:** **PARCIALMENTE COMPATIBLE**
- **Columnas en BD:**
  - `ID` (INT IDENTITY) ✅
  - `NUMNOTA` (INT) - Diferente a `numero` (VARCHAR)
  - `fecnot` (DATETIME) - Diferente a `fecha_emision`
  - `valnot` (NUMERIC) - Diferente a `total`
  - `tipnot` (CHAR(2)) ✅
  - `codalm` (CHAR(3)) ✅
  - `concepto` (VARCHAR(200)) - Diferente a `motivo`
  - `CODTER` (VARCHAR(15)) ✅ - Diferente a `cliente_id`
  - `TIPFAC` (CHAR(2)) ✅
  - `NUMFAC` (CHAR(8)) ✅ - Diferente a `factura_id`
  - `VALVTA`, `VALIVA` ✅
- **Observaciones:**
  - El código inserta aquí, pero con estructura diferente
  - Necesita mapeo de columnas

#### ✅ `inv_medidas` (Medidas)
- **Estado:** ✅ Existe y tiene datos (168 registros)
- **Estructura:** **COMPATIBLE**
- **Columnas en BD:**
  - `codmed` (NCHAR(3)) ✅ - Diferente a `id` (INT)
  - `nommed` (VARCHAR(30)) ✅ - Diferente a `nombre`
  - `abreviatura` (CHAR(3)) ✅
  - `cantidad`, `principal`, `PADRE`, `excedente` ✅
- **Observaciones:**
  - El código espera `id` (INT) pero la BD usa `codmed` (NCHAR(3))
  - Las consultas funcionan porque usan `codmed` directamente

#### ✅ `inv_categorias` (Categorías)
- **Estado:** ✅ Existe pero **SIN DATOS** (0 registros)
- **Estructura:** **COMPATIBLE**
- **Columnas en BD:**
  - `id` (INT) ✅
  - `nombre` (VARCHAR(50)) ✅
- **Observaciones:**
  - Tabla existe pero vacía
  - El código puede usarla correctamente

#### ✅ `gen_departamentos` (Departamentos)
- **Estado:** ✅ Existe y tiene datos (33 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `coddep` (CHAR(2)) - Diferente a `id` (INT)
  - `nomdep` (VARCHAR(250)) - Diferente a `nombre`
- **Problemas:**
  - El código espera `id` (INT IDENTITY) pero la BD usa `coddep` (CHAR(2))
  - No tiene columna `codigo` separada

#### ✅ `gen_municipios` (Ciudades)
- **Estado:** ✅ Existe y tiene datos (1,121 registros)
- **Estructura:** **PARCIALMENTE COMPATIBLE**
- **Columnas en BD:**
  - `ID` (INT IDENTITY) ✅
  - `coddane` (CHAR(8)) ✅
  - `coddep` (CHAR(2)) ✅ - Diferente a `departamento_id` (INT)
  - `codmun` (CHAR(3)) ✅
  - `nommun` (VARCHAR(100)) ✅ - Diferente a `nombre`
- **Observaciones:**
  - Tiene `ID` pero también usa `coddane` como identificador
  - La relación con departamentos es por `coddep` (CHAR) no por INT

#### ✅ `Dian_tipodocumento` (Tipos de Documento)
- **Estado:** ✅ Existe pero **SIN DATOS** (0 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `Tipdoc` (VARCHAR(2)) - Diferente a `id` (VARCHAR)
  - `Nomdoc` (VARCHAR(100)) - Diferente a `nombre`
  - `Razon` (BIT) ✅
- **Problemas:**
  - El código espera `id`, `codigo`, `nombre`
  - La BD usa `Tipdoc`, `Nomdoc`

#### ✅ `Dian_Regimenes` (Régimenes Fiscales)
- **Estado:** ✅ Existe pero **SIN DATOS** (0 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `codigo` (INT) ✅ - Diferente a `id` (VARCHAR)
  - `nombre` (VARCHAR(20)) ✅
- **Problemas:**
  - El código espera `id` (VARCHAR) pero la BD tiene `codigo` (INT)

#### ✅ `ven_vendedor` (Vendedores)
- **Estado:** ✅ Existe y tiene datos (17 registros)
- **Estructura:** **INCOMPATIBLE**
- **Columnas en BD:**
  - `id` (INT IDENTITY) ✅
  - `idUsuario` (INT) ✅
  - `ideven` (INT) ✅
  - `codven` (CHAR(3)) ✅
  - `nomven` (CHAR(50)) ✅ - Diferente a `nomb_emple`
  - `dirven`, `telven`, `celven` ✅
  - `codusu` (VARCHAR(10)) ✅
  - `Activo` (BIT) ✅
  - `codalm` (CHAR(3)) ✅
- **Problemas:**
  - El código busca `codi_emple`, `nomb_emple`, `codi_labor`, `cedula`, `email`
  - La BD tiene `codven`, `nomven`, `idUsuario`
  - **ESTRUCTURA COMPLETAMENTE DIFERENTE**

#### ❌ `transportadoras` (Transportadoras)
- **Estado:** ❌ **NO EXISTE EN LA BASE DE DATOS**
- **Problema:**
  - El código intenta usar esta tabla para remisiones
  - No existe en la BD
- **Acción requerida:** CREAR LA TABLA o usar tabla alternativa

#### ❌ `archivos_adjuntos` (Archivos Adjuntos)
- **Estado:** ❌ **NO EXISTE EN LA BASE DE DATOS**
- **Problema:**
  - El código tiene consultas para esta tabla
  - No existe en la BD
- **Acción requerida:** CREAR LA TABLA si se necesita funcionalidad de adjuntos

#### ❌ `tipos_persona` (Tipos de Persona)
- **Estado:** ❌ **NO EXISTE EN LA BASE DE DATOS**
- **Problema:**
  - El código referencia esta tabla
  - No existe en la BD
- **Acción requerida:** CREAR LA TABLA o eliminar referencias

---

## 🔴 2. Problemas Críticos Identificados

### 2.1 Tablas Faltantes (CRÍTICO)

1. **`ven_pedidos`** ❌
   - El código hace INSERT, UPDATE, SELECT
   - **Impacto:** Todas las operaciones de pedidos fallarán
   - **Solución:** Crear la tabla según el script SQL

2. **`transportadoras`** ❌
   - Usada en remisiones
   - **Impacto:** No se pueden asignar transportadoras a remisiones
   - **Solución:** Crear la tabla o hacer campo opcional

3. **`archivos_adjuntos`** ❌
   - Usada para adjuntar archivos a documentos
   - **Impacto:** Funcionalidad de adjuntos no funcionará
   - **Solución:** Crear la tabla si se necesita

4. **`tipos_persona`** ❌
   - Referenciada en el código
   - **Impacto:** Bajo (probablemente no se usa activamente)
   - **Solución:** Crear la tabla o eliminar referencias

### 2.2 Estructuras Incompatibles (CRÍTICO)

1. **`ven_facturas` y `ven_detafact`**
   - Columnas con nombres diferentes
   - El código NO puede insertar correctamente
   - **Solución:** Crear vistas o adaptar el código

2. **`ven_recibos` y `ven_detarecibo`**
   - `ven_detarecibo` es para pagos, NO para productos
   - Falta tabla de detalle de remisiones de productos
   - **Solución:** Crear `ven_detarecibo_productos` o adaptar estructura

3. **`ven_detapedidos`**
   - Estructura antigua, no compatible
   - Falta tabla `ven_pedidos` (encabezado)
   - **Solución:** Crear `ven_pedidos` y adaptar `ven_detapedidos`

4. **`ven_detacotizacion.cod_producto`**
   - El código inserta INT (id de producto)
   - La BD espera CHAR(8) (codins)
   - **Solución:** Cambiar código para usar `codins` o cambiar tipo de columna

### 2.3 Mapeo de Columnas (MEDIO)

1. **Nombres de columnas diferentes:**
   - BD usa abreviaciones (`numfact`, `fecfac`)
   - Código espera nombres completos (`numero_factura`, `fecha_factura`)
   - **Solución:** Usar alias en SELECT o crear vistas

2. **Tipos de datos diferentes:**
   - `activo`: INT en BD vs BIT esperado (funciona con CAST)
   - `codins`: CHAR(8) en BD vs VARCHAR(50) esperado
   - **Solución:** Ajustar tipos o hacer conversiones

3. **IDs diferentes:**
   - Algunas tablas usan códigos (CHAR) como PK
   - El código espera INT IDENTITY
   - **Solución:** Adaptar código o crear columnas ID

### 2.4 Relaciones Faltantes (MEDIO)

- **No hay Foreign Keys definidas** en la mayoría de las tablas
- **Impacto:** Integridad referencial no garantizada
- **Solución:** Agregar FKs o validar en el código

---

## 📋 3. Comparación: Código vs Base de Datos

### 3.1 Tablas Usadas por el Código

| Tabla en Código | Tabla en BD | Estado | Acción Requerida |
|----------------|-------------|--------|------------------|
| `con_terceros` | `con_terceros` | ✅ Existe | Ajustar mapeo de `activo` |
| `inv_insumos` | `inv_insumos` | ✅ Existe | Ajustar tipo `codins` |
| `inv_invent` | `inv_invent` | ✅ Existe | OK |
| `ven_facturas` | `ven_facturas` | ⚠️ Existe | Crear vistas o adaptar código |
| `ven_detafact` | `ven_detafact` | ⚠️ Existe | Crear vistas o adaptar código |
| `ven_cotizacion` | `ven_cotizacion` | ✅ Existe | OK (vacía) |
| `ven_detacotizacion` | `ven_detacotizacion` | ⚠️ Existe | Cambiar `cod_producto` a usar `codins` |
| `ven_pedidos` | ❌ NO EXISTE | ❌ Falta | **CREAR TABLA** |
| `ven_detapedidos` | `ven_detapedidos` | ⚠️ Existe | Adaptar estructura o crear nueva |
| `ven_recibos` | `ven_recibos` | ⚠️ Existe | Adaptar estructura |
| `ven_detarecibo` | `ven_detarecibo` | ❌ Diferente | Es para pagos, crear tabla de productos |
| `ven_notas` | `ven_notas` | ⚠️ Existe | Adaptar mapeo de columnas |
| `inv_medidas` | `inv_medidas` | ✅ Existe | OK |
| `inv_categorias` | `inv_categorias` | ✅ Existe | OK (vacía) |
| `gen_departamentos` | `gen_departamentos` | ⚠️ Existe | Adaptar mapeo |
| `gen_municipios` | `gen_municipios` | ✅ Existe | OK |
| `Dian_tipodocumento` | `Dian_tipodocumento` | ⚠️ Existe | Adaptar mapeo |
| `Dian_Regimenes` | `Dian_Regimenes` | ⚠️ Existe | Adaptar mapeo |
| `ven_vendedor` | `ven_vendedor` | ⚠️ Existe | **ADAPTAR CÓDIGO** (estructura diferente) |
| `transportadoras` | ❌ NO EXISTE | ❌ Falta | **CREAR TABLA** |
| `archivos_adjuntos` | ❌ NO EXISTE | ❌ Falta | Crear si se necesita |
| `tipos_persona` | ❌ NO EXISTE | ❌ Falta | Crear o eliminar referencias |

### 3.2 Operaciones por Tabla

#### ✅ Operaciones que FUNCIONAN:
- **SELECT** de `con_terceros` (con ajustes)
- **SELECT** de `inv_insumos` (con ajustes)
- **SELECT** de `inv_invent` (con JOINs)
- **SELECT** de `ven_cotizacion` (vacía pero funciona)
- **INSERT** en `ven_cotizacion` (funciona)
- **INSERT** en `ven_detacotizacion` (pero con conflicto de tipos)
- **SELECT** de `inv_medidas`, `inv_categorias`, `gen_municipios`

#### ⚠️ Operaciones que FUNCIONAN PARCIALMENTE:
- **SELECT** de `ven_facturas` (necesita mapeo de columnas)
- **SELECT** de `ven_notas` (necesita mapeo de columnas)
- **INSERT** en `ven_notas` (necesita mapeo de columnas)
- **SELECT** de `gen_departamentos` (necesita mapeo)

#### ❌ Operaciones que NO FUNCIONAN:
- **INSERT/UPDATE/SELECT** en `ven_pedidos` (tabla no existe)
- **INSERT/UPDATE** en `ven_recibos` (estructura incompatible)
- **INSERT** en `ven_detarecibo` (tabla es para pagos, no productos)
- **INSERT/UPDATE** en `ven_facturas` (estructura incompatible)
- **INSERT** en `ven_detafact` (estructura incompatible)
- **SELECT** de `ven_vendedor` (estructura diferente)
- **SELECT/INSERT** en `transportadoras` (tabla no existe)
- **SELECT/INSERT** en `archivos_adjuntos` (tabla no existe)

---

## 🛠️ 4. Recomendaciones y Plan de Acción

### 4.1 Acciones Críticas (URGENTE)

1. **Crear tabla `ven_pedidos`**
   ```sql
   -- Ejecutar script de create_database_ERP360.sql
   -- O crear manualmente según estructura esperada
   ```

2. **Crear tabla `transportadoras`**
   ```sql
   CREATE TABLE transportadoras (
       id VARCHAR(36) PRIMARY KEY,
       nombre VARCHAR(100) NOT NULL,
       nit_identificacion VARCHAR(20),
       activo BIT DEFAULT 1,
       empresa_id INT,
       created_at DATETIME DEFAULT GETDATE()
   );
   ```

3. **Adaptar código de `ven_vendedor`**
   - El código busca columnas que no existen
   - Opción 1: Crear vista con alias
   - Opción 2: Adaptar código para usar columnas reales

4. **Corregir `ven_detacotizacion.cod_producto`**
   - Opción 1: Cambiar código para usar `codins` (CHAR(8))
   - Opción 2: Cambiar tipo de columna a INT y agregar relación

### 4.2 Acciones Importantes (ALTA PRIORIDAD)

1. **Crear vistas para `ven_facturas` y `ven_detafact`**
   - Facilitar el mapeo de columnas
   - Mantener compatibilidad con código existente

2. **Adaptar estructura de `ven_recibos`**
   - Agregar columnas faltantes: `numero_remision`, `fecha_remision`, `estado_envio`, etc.
   - O crear tabla nueva `ven_remisiones` con estructura correcta

3. **Crear tabla `ven_detarecibo_productos`**
   - Separar detalle de productos del detalle de pagos
   - O renombrar `ven_detarecibo` actual y crear nueva

4. **Adaptar `ven_detapedidos`**
   - Agregar columnas faltantes
   - O crear tabla nueva con estructura correcta

### 4.3 Acciones de Mejora (MEDIA PRIORIDAD)

1. **Agregar Foreign Keys**
   - Mejorar integridad referencial
   - Facilitar mantenimiento

2. **Crear índices adicionales**
   - Mejorar rendimiento de consultas
   - Seguir recomendaciones del script SQL

3. **Poblar tablas de catálogos vacías**
   - `inv_categorias`
   - `Dian_tipodocumento`
   - `Dian_Regimenes`
   - `tipos_persona` (si se crea)

4. **Estandarizar nombres de columnas**
   - Usar `snake_case` consistente
   - O crear vistas con alias

### 4.4 Acciones Opcionales (BAJA PRIORIDAD)

1. **Crear tabla `archivos_adjuntos`**
   - Solo si se necesita funcionalidad de adjuntos

2. **Crear tabla `tipos_persona`**
   - Solo si se necesita en el sistema

3. **Migrar datos antiguos**
   - Si hay datos en estructuras antiguas
   - Crear scripts de migración

---

## 📊 5. Resumen de Estadísticas

### 5.1 Tablas por Estado

- ✅ **Completamente compatibles:** 6 tablas
- ⚠️ **Parcialmente compatibles:** 8 tablas
- ❌ **Incompatibles o faltantes:** 6 tablas

### 5.2 Registros por Tabla

- `con_terceros`: 22,134 registros
- `inv_insumos`: 6,062 registros
- `ven_facturas`: 166,832 registros
- `ven_detafact`: 506,304 registros
- `ven_cotizacion`: 0 registros (nueva)
- `ven_detacotizacion`: 0 registros (nueva)
- `ven_detapedidos`: 705 registros (estructura antigua)
- `ven_recibos`: 9,203 registros
- `ven_detarecibo`: 4,550 registros (pagos)
- `ven_notas`: 191 registros
- `inv_invent`: 7,557 registros
- `inv_medidas`: 168 registros
- `gen_departamentos`: 33 registros
- `gen_municipios`: 1,121 registros
- `ven_vendedor`: 17 registros

### 5.3 Impacto en Funcionalidades

| Funcionalidad | Estado | Problemas |
|--------------|--------|-----------|
| Gestión de Clientes | ✅ Funciona | Ajustes menores |
| Gestión de Productos | ✅ Funciona | Ajustes menores |
| Cotizaciones | ⚠️ Parcial | Conflicto en `cod_producto` |
| Pedidos | ❌ No funciona | Tabla `ven_pedidos` no existe |
| Remisiones | ❌ No funciona | Estructura incompatible |
| Facturas | ❌ No funciona | Estructura incompatible |
| Notas de Crédito | ⚠️ Parcial | Mapeo de columnas |
| Inventario | ✅ Funciona | OK |
| Catálogos | ⚠️ Parcial | Algunos vacíos, otros con mapeo |

---

## 🎯 6. Próximos Pasos

1. **Revisar y aprobar este análisis**
2. **Priorizar acciones críticas**
3. **Crear script SQL para tablas faltantes**
4. **Adaptar código del backend**
5. **Probar funcionalidades una por una**
6. **Documentar cambios realizados**

---

## 📝 Notas Finales

- Este análisis se basó en la exploración de la base de datos `Prueba_ERP360`
- Las recomendaciones deben ser revisadas según las necesidades del negocio
- Se recomienda hacer backup antes de aplicar cambios
- Los scripts SQL de creación están en `app/back/db/create_database_ERP360.sql`
- El código del backend está en `app/back/server.cjs`
- Las consultas están definidas en `app/back/services/dbConfig.cjs`

---

**Documento generado automáticamente el:** 2024-11-10  
**Por:** Análisis Automático de Base de Datos  
**Versión:** 1.0

