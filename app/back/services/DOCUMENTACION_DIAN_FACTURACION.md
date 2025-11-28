# Documentación: API de Facturación Electrónica DIAN

## 📋 Flujo Completo de Facturación DIAN

### Endpoint Principal: `PUT /api/facturas/:id/timbrar`

**Ubicación:** `app/back/server.cjs` (líneas ~7963-8620)

---

## 🔄 PASOS DEL PROCESO DE FACTURACIÓN

### **PASO 1: Obtener Factura Completa desde Base de Datos**
**Método:** `DIANService.getFacturaCompleta(facturaId)`

**Ubicación:** `app/back/services/dian-service.cjs` (líneas 222-332)

**Qué hace:**
1. Consulta `ven_facturas` para obtener el encabezado de la factura
2. Consulta `ven_detafact` para obtener los detalles/items de la factura
3. Consulta `con_terceros` para obtener datos del cliente

**Tablas consultadas:**
- `ven_facturas` → Encabezado de factura
- `ven_detafact` → Items/detalles de la factura
- `con_terceros` → Datos del cliente

---

### **PASO 2: Obtener Resolución DIAN Activa**
**Método:** `DIANService.getDIANResolution()`

**Ubicación:** `app/back/services/dian-service.cjs` (líneas 40-99)

**Qué hace:**
- Consulta `Dian_Resoluciones_electronica` (prioridad) o `Dian_Resoluciones` (fallback)
- Obtiene la resolución activa (`activa = 1`)
- Campos obtenidos: `id`, `consecutivo`, `rango_inicial`, `rango_final`, `id_api`

**Tablas consultadas:**
- `Dian_Resoluciones_electronica` (primera opción)
- `Dian_Resoluciones` (fallback si no hay en la primera)

---

### **PASO 3: Obtener Datos de la Empresa**
**Método:** `DIANService.getCompanyData()`

**Ubicación:** `app/back/services/dian-service.cjs` (líneas 105-159)

**Qué hace:**
- Consulta `gen_empresa` para obtener datos de la empresa emisora
- Campos obtenidos: `nitemp`, `razemp`, `diremp`, `teleep`, `emailemp`, `codmunicipio`

**Tablas consultadas:**
- `gen_empresa` → Datos de la empresa

---

### **PASO 4: Obtener Parámetros DIAN**
**Método:** `DIANService.getDIANParameters()`

**Ubicación:** `app/back/services/dian-service.cjs` (líneas 165-215)

**Qué hace:**
- Consulta `dian_parametros_fe` para obtener configuración de DIAN
- Campos obtenidos: `url_base`, `testSetID`, `isPrueba`, `sync`

**Tablas consultadas:**
- `dian_parametros_fe` → Parámetros de configuración DIAN

---

### **PASO 5: Transformar Factura al Formato JSON DIAN**
**Método:** `DIANService.transformVenFacturaForDIAN(facturaData, resolution, config, invoiceData)`

**Ubicación:** `app/back/services/dian-service.cjs` (líneas 435-886)

**Este es el método PRINCIPAL que construye el JSON DIAN. Aquí se llena cada sección:**

---

## 📦 ESTRUCTURA DEL JSON DIAN Y ORIGEN DE CADA CAMPO

### **1. DATOS BÁSICOS DE LA FACTURA**

#### `number` (Número de Factura)
- **Línea:** 750
- **Origen:** Se calcula desde `ven_facturas` (líneas 478-527)
- **Query SQL:** 
  ```sql
  SELECT TOP 1 numfact, ... 
  FROM ven_facturas 
  WHERE ISNUMERIC(numfact) = 1 
  ORDER BY CAST(numfact AS INT) DESC
  ```
- **Lógica:** Busca el número más alto en `ven_facturas.numfact` y le suma 1
- **Valor por defecto:** 80605

#### `type_document_id` (Tipo de Documento: Producción/Prueba)
- **Línea:** 751
- **Origen:** `dian_parametros_fe.isPrueba` (líneas 745-746)
- **Valores:**
  - `1` = Producción
  - `2` = Prueba
- **Lógica:** Si `isPrueba = true` → `2`, sino → `1`

#### `identification_number` (NIT de la Empresa)
- **Línea:** 752
- **Origen:** `gen_empresa.nitemp` (línea 467 - método `getCompanyData()`)
- **Valor por defecto:** 802024306

#### `resolution_id` (ID de Resolución DIAN)
- **Línea:** 753
- **Origen:** `Dian_Resoluciones_electronica.id_api` o `Dian_Resoluciones.id_api` (línea 40-99)
- **Fallback:** `resolution.id` o `4`

#### `sync` (Sincronización)
- **Línea:** 754
- **Origen:** `dian_parametros_fe.sync` (línea 202)
- **Tipo:** Boolean (true/false)

---

### **2. SECCIÓN `company` (Datos de la Empresa)**

**Ubicación:** Líneas 755-764

| Campo JSON | Origen (Tabla.Columna) | Línea | Descripción |
|-----------|------------------------|-------|-------------|
| `identification_number` | `gen_empresa.nitemp` | 756 | NIT de la empresa |
| `name` | `gen_empresa.razemp` | 757 | Razón social |
| `type_organization_id` | Hardcodeado `1` | 758 | 1 = Persona Jurídica |
| `type_document_id` | Hardcodeado `"31"` | 759 | 31 = NIT |
| `id_location` | `gen_empresa.codmunicipio` | 760 | Código DANE del municipio |
| `address` | `gen_empresa.diremp` | 761 | Dirección |
| `phone` | `gen_empresa.teleep` | 762 | Teléfono (limpio, solo números) |
| `email` | `gen_empresa.emailemp` | 763 | Email |

**Consulta SQL:** Ver método `getCompanyData()` líneas 111-121

---

### **3. SECCIÓN `customer` (Datos del Cliente)**

**Ubicación:** Líneas 765-774

| Campo JSON | Origen (Tabla.Columna) | Línea | Prioridad | Descripción |
|-----------|------------------------|-------|-----------|-------------|
| `identification_number` | `con_terceros.codter` | 700-705 | 1. invoiceData.customer_document<br>2. cliente.codter<br>3. ven_facturas.codter<br>4. '222222222222' | NIT/Documento del cliente |
| `name` | `con_terceros.nomter` | 707-712 | 1. invoiceData.customer_name<br>2. cliente.nomter<br>3. cliente.nombreCompleto<br>4. 'CONSUMIDOR FINAL' | Nombre del cliente (en mayúsculas) |
| `type_organization_id` | `con_terceros.tipter` | 716 | `cliente.tipter` o `2` | 1 = Jurídica, 2 = Natural |
| `type_document_id` | `con_terceros.Tipo_documento` | 715 | `cliente.Tipo_documento` o `"13"` | Tipo de documento |
| `id_location` | `con_terceros.coddane` | 770 | `cliente.coddane` o `"11001"` | Código DANE del municipio |
| `address` | `con_terceros.dirter` | 771 | `cliente.dirter` o `"BOGOTA D.C."` | Dirección |
| `phone` | `con_terceros.TELTER` o `CELTER` | 772 | 1. invoiceData.customer_phone<br>2. cliente.TELTER<br>3. cliente.CELTER<br>4. Normalizado | Teléfono (normalizado a 10-15 dígitos) |
| `email` | `con_terceros.EMAIL` | 773 | 1. invoiceData.customer_email<br>2. cliente.EMAIL<br>3. cliente.email<br>4. 'cliente@ejemplo.com' | Email |

**Consulta SQL:** Ver método `getFacturaCompleta()` líneas 299-303

**Normalización de teléfono:** Ver líneas 729-736

---

### **4. SECCIÓN `tax_totals` (Totales de Impuestos)**

**Ubicación:** Líneas 775-780

| Campo JSON | Origen (Tabla.Columna) | Línea | Cálculo |
|-----------|------------------------|-------|---------|
| `tax_id` | Calculado | 776 | "01" para IVA, "04" para INC, "ZA" para ambos, "ZZ" para no aplica (líneas 569-578) |
| `tax_amount` | `ven_facturas.valiva` | 777 | Valor total del IVA |
| `taxable_amount` | `ven_facturas.valvta` | 778 | Base imponible (total sin impuestos) |
| `percent` | Calculado | 779 | Porcentaje calculado desde `valiva/valvta * 100` y redondeado (líneas 542-567) |

**Cálculo del porcentaje IVA:** Líneas 542-567
- Se calcula: `(valiva / valvta) * 100`
- Se redondea a tarifas estándar: 19%, 8%, 5%, 0%

**Código de impuesto (`tax_id`):** Líneas 569-578
- Si `ivaPercent === 0` → `"ZZ"` (no aplica)
- Si `ivaPercent > 0` → `"01"` (IVA)
- Nota: También puede ser `"04"` (INC) o `"ZA"` (IVA e INC) según corresponda

---

### **5. SECCIÓN `legal_monetary_totals` (Totales Monetarios Legales)**

**Ubicación:** Líneas 781-788

| Campo JSON | Origen (Tabla.Columna) | Línea | Cálculo |
|-----------|------------------------|-------|---------|
| `line_extension_amount` | `ven_facturas.valvta` | 782 | Total sin impuestos |
| `tax_exclusive_amount` | `ven_facturas.valvta` | 783 | Subtotal antes de IVA (igual a line_extension_amount) |
| `tax_inclusive_amount` | Calculado | 784 | `valvta + valiva` (total con IVA) |
| `payable_amount` | Calculado | 785 | `valvta + valiva` (valor final a pagar) |
| `allowance_total_amount` | `ven_facturas.valdcto` | 786 | Descuentos globales |
| `charge_total_amount` | Hardcodeado `0` | 787 | Cargos globales (siempre 0) |

**Cálculo de totales:** Líneas 529-539
```javascript
lineExtensionAmount = venFactura.valvta  // Total sin IVA
taxAmount = venFactura.valiva           // IVA
totalAmount = lineExtensionAmount + taxAmount  // Total con IVA
descuento = venFactura.valdcto         // Descuento
```

---

### **6. SECCIÓN `invoice_lines` (Líneas de la Factura / Items)**

**Ubicación:** Líneas 607-696

**Origen:** `ven_detafact` → Se crea una línea por cada detalle

**Query SQL:** Ver método `getFacturaCompleta()` líneas 261-284

#### **Estructura de cada línea:**

| Campo JSON | Origen (Tabla.Columna) | Línea | Descripción |
|-----------|------------------------|-------|-------------|
| `unit_measure_id` | Hardcodeado `70` | 656 | ⚠️ TEMPORAL - Se obtendrá desde MySQL electronica |
| `invoiced_quantity` | `ven_detafact.qtyins` | 657 | Cantidad del producto |
| `line_extension_amount` | Calculado | 658 | `(precio * cantidad) - descuento` (sin IVA) |
| `description` | `ven_detafact.observa` | 659 | Descripción del producto |
| `price_amount` | `ven_detafact.valins` | 660 | Precio unitario |
| `code` | `ven_detafact.codins` | 661 | Código del producto |
| `type_item_identification_id` | Hardcodeado `4` | 662 | ⚠️ TEMPORAL - 4 = Código estándar interno |
| `base_quantity` | `ven_detafact.qtyins` | 663 | Cantidad base (igual a invoiced_quantity) |
| `free_of_charge_indicator` | Hardcodeado `false` | 664 | Si es una línea gratuita |
| `tax_totals[]` | Ver abajo | 665-670 | Array con impuestos de la línea |

#### **Sub-sección `tax_totals` dentro de cada línea:**

| Campo JSON | Origen (Tabla.Columna) | Línea | Cálculo |
|-----------|------------------------|-------|---------|
| `tax_id` | Calculado por línea | 666 | "01" para IVA, "ZZ" para no aplica (líneas 647-653) |
| `tax_amount` | `ven_detafact.ivains` | 667 | IVA del item |
| `taxable_amount` | Calculado | 668 | `line_extension_amount` (base imponible) |
| `percent` | Calculado por línea | 669 | Porcentaje calculado desde `ivains/line_extension_amount * 100` (líneas 630-645) |

**Cálculo de valores por línea:** Líneas 625-628
```javascript
detalleQuantity = ven_detafact.qtyins
detallePrice = ven_detafact.valins
detalleTaxAmount = ven_detafact.ivains
detalleLineExtension = (detallePrice * detalleQuantity) - descuento
```

**Fallback si no hay detalles:** Líneas 677-695
- Si `ven_detafact` está vacío, se crea una línea consolidada con los totales de la factura

---

### **7. SECCIÓN `payment_forms` (Formas de Pago)**

**Ubicación:** Líneas 790-795

**Origen:** `ven_facturas` → Campos: `efectivo`, `credito`, `tarjetacr`, `Transferencia`, `plazo`

**Lógica de determinación:** Líneas 580-605

| Condición | `payment_form_id` | `payment_method_id` | Descripción |
|-----------|-------------------|---------------------|-------------|
| `tarjetacr > 0` | `2` | `48` | Tarjeta débito/crédito |
| `Transferencia > 0` | `3` | `42` | Transferencia bancaria |
| `credito > 0` | `4` | `1` | Crédito (con plazo en días) |
| `efectivo > 0` (por defecto) | `1` | `10` | Efectivo |

**Campos en JSON:**
- `payment_form_id` (línea 791): ID de forma de pago (1, 2, 3, 4)
- `payment_method_id` (línea 792): ID de método de pago (10, 48, 42, 1)
- `payment_due_date` (línea 793): Fecha de vencimiento (desde `ven_facturas.fecha_vencimiento`)
- `duration_measure` (línea 794): Días de crédito (solo si es crédito, desde `ven_facturas.plazo`)

---

### **8. CAMPO `trackId` (Condicional)**

**Ubicación:** Líneas 798-834

**Condición:** Solo se agrega si `sync === true`

**Lógica:**
- Si `sync === true`:
  - Usa `invoiceData.trackId` si existe y es válido
  - Si no, genera: `track-{invoiceNumber}-{timestamp}`
- Si `sync === false`:
  - **NO se agrega al JSON** (el campo no debe existir)

---

## 📊 RESUMEN DE TABLAS CONSULTADAS

| Tabla | Uso | Campos Principales |
|-------|-----|-------------------|
| `ven_facturas` | Encabezado de factura | `id`, `numfact`, `codter`, `valvta`, `valiva`, `valdcto`, `netfac`, `efectivo`, `credito`, `tarjetacr`, `Transferencia`, `plazo`, `fecha_vencimiento` |
| `ven_detafact` | Items/detalles de factura | `id_factura`, `codins`, `qtyins`, `valins`, `ivains`, `valdescuento`, `observa` |
| `con_terceros` | Datos del cliente | `codter`, `nomter`, `tipter`, `Tipo_documento`, `coddane`, `dirter`, `TELTER`, `CELTER`, `EMAIL` |
| `gen_empresa` | Datos de la empresa | `nitemp`, `razemp`, `diremp`, `teleep`, `emailemp`, `codmunicipio` |
| `Dian_Resoluciones_electronica` | Resolución DIAN activa | `id`, `consecutivo`, `rango_inicial`, `rango_final`, `id_api`, `activa` |
| `Dian_Resoluciones` | Resolución DIAN (fallback) | `id`, `consecutivo`, `rango_inicial`, `rango_final`, `id_api`, `activa` |
| `dian_parametros_fe` | Parámetros DIAN | `url_base`, `testSetID`, `isPrueba`, `sync`, `activo` |

---

## 🔧 VALORES HARDCODEADOS (Temporales)

Estos valores están hardcodeados temporalmente hasta que se conecte la base de datos MySQL "electronica":

| Campo | Valor | Ubicación | Nota |
|-------|-------|-----------|------|
| `unit_measure_id` | `70` | Línea 656 | Se obtendrá desde MySQL electronica |
| `type_item_identification_id` | `4` | Línea 662 | Se obtendrá desde MySQL electronica |
| `payment_form_id` | `1-4` | Líneas 588-604 | Se obtendrá desde MySQL electronica |
| `payment_method_id` | `10/48/42/1` | Líneas 589-604 | Se obtendrá desde MySQL electronica |

---

## 📤 ENVÍO A DIAN

**Método:** `DIANService.sendInvoiceToDIAN(invoiceJson, testSetID, baseUrl)`

**Ubicación:** `app/back/services/dian-service.cjs` (líneas 895-1047)

**Endpoint DIAN:** 
```
POST {baseUrl}/api/ubl2.1/invoice/{testSetID}
```

**Ejemplo:**
```
POST https://facturacionelectronica.mobilsaas.com/api/ubl2.1/invoice/1
```

**Headers:**
- `Content-Type: application/json`
- `Accept: application/json`

**Body:** El JSON construido en `transformVenFacturaForDIAN`

---

## 🔍 DÓNDE SE LLAMA EN EL SERVIDOR

### Endpoint: `PUT /api/facturas/:id/timbrar`

**Ubicación:** `app/back/server.cjs` (líneas ~7963-8620)

**Flujo:**
1. Línea 8202: `DIANService.getFacturaCompleta(idNum)`
2. Línea 8250: `DIANService.getDIANResolution()`
3. Línea 8255: `DIANService.getCompanyData()`
4. Línea 8260: `DIANService.getDIANParameters()`
5. Línea 8287: `DIANService.transformVenFacturaForDIAN(...)`
6. Línea 8315: `DIANService.sendInvoiceToDIAN(...)`

---

## 📝 LOGS Y DEBUGGING

El servicio incluye logs detallados en cada paso:

- `🔍` = Consulta a base de datos
- `✅` = Operación exitosa
- `⚠️` = Advertencia
- `❌` = Error
- `📊` = Resumen de datos
- `📤` = Envío a DIAN

Todos los logs muestran:
- Qué tabla se está consultando
- Qué campos se están usando
- Qué valores se están calculando
- El JSON final que se enviará

---

## 🔗 REFERENCIAS A CÓDIGO

- **Servicio DIAN:** `app/back/services/dian-service.cjs`
- **Endpoint API:** `app/back/server.cjs` (líneas ~7963-8620)
- **Base de datos:** `Prueba_ERP360` (SQL Server)

