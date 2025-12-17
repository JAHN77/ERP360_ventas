# 📊 COMPARATIVA: DATOS DE ENTRADA vs FORMATO API DIAN

## 🔄 FLUJO DE TRANSFORMACIÓN DE DATOS

```
BASE DE DATOS (SQL Server)
    ↓
DIANService.getFacturaCompleta()
    ↓
DIANService.transformVenFacturaForDIAN()
    ↓
DIANService.sendInvoiceToDIAN()
    ↓
API DIAN (facturacionelectronica.mobilsaas.com)
```

---

## 📥 1. DATOS DE ENTRADA (BASE DE DATOS)

### 1.1 Tabla: `ven_facturas` (Encabezado de Factura)

| Campo BD | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `ID` | INT | `406679` | ID único de la factura |
| `numfact` | VARCHAR | `FC-0024` | Número de factura interno |
| `codter` | VARCHAR | `72229294` | Código del cliente |
| `fecha` | DATE | `2025-11-22` | Fecha de emisión |
| `fecha_vencimiento` | DATE | `2025-11-22` | Fecha de vencimiento |
| `valvta` | DECIMAL(18,2) | `3210.08` | Subtotal (sin IVA) |
| `valiva` | DECIMAL(18,2) | `0` | Valor del IVA |
| `valdcto` | DECIMAL(18,2) | `0` | Valor del descuento |
| `netfac` | DECIMAL(18,2) | `3210` | Total de la factura |
| `estfac` | CHAR(1) | `B` | Estado (B=Borrador, E=Enviada, R=Rechazada) |
| `tipfac` | CHAR(2) | `01` | Tipo de factura |
| `codalm` | CHAR(3) | `001` | Código del almacén |
| `cod_vendedor` | VARCHAR | `V001` | Código del vendedor |
| `efectivo` | DECIMAL(18,2) | `3210` | Valor en efectivo |
| `credito` | DECIMAL(18,2) | `0` | Valor a crédito |
| `tarjetacr` | DECIMAL(18,2) | `0` | Valor con tarjeta |
| `Transferencia` | DECIMAL(18,2) | `0` | Valor por transferencia |

**Ejemplo de registro:**
```sql
SELECT * FROM ven_facturas WHERE ID = 406679
```
```json
{
  "ID": 406679,
  "numfact": "FC-0024",
  "codter": "72229294",
  "fecha": "2025-11-22",
  "fecha_vencimiento": "2025-11-22",
  "valvta": 3210.08,
  "valiva": 0,
  "valdcto": 0,
  "netfac": 3210,
  "estfac": "B",
  "tipfac": "01",
  "codalm": "001"
}
```

---

### 1.2 Tabla: `ven_detafact` (Detalles de Factura)

| Campo BD | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `ID` | INT | `1` | ID único del detalle |
| `id_factura` | INT | `406679` | ID de la factura (FK) |
| `codins` | VARCHAR | `02590001` | Código del producto |
| `qtyins` | DECIMAL(18,2) | `1` | Cantidad |
| `valins` | DECIMAL(18,2) | `3210.08` | Precio unitario |
| `ivains` | DECIMAL(18,2) | `0` | Valor del IVA del item |
| `valdescuento` | DECIMAL(18,2) | `0` | Valor del descuento del item |
| `observa` | VARCHAR | `VENTA DE PRODUCTOS Y SERVICIOS` | Descripción |

**Ejemplo de registro:**
```sql
SELECT * FROM ven_detafact WHERE id_factura = 406679
```
```json
{
  "ID": 1,
  "id_factura": 406679,
  "codins": "02590001",
  "qtyins": 1,
  "valins": 3210.08,
  "ivains": 0,
  "valdescuento": 0,
  "observa": "VENTA DE PRODUCTOS Y SERVICIOS"
}
```

---

### 1.3 Tabla: `con_terceros` (Datos del Cliente)

| Campo BD | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `codter` | VARCHAR | `72229294` | Código del tercero/cliente |
| `nomter` | VARCHAR | `.CAMARGO PINO MARCO ANTONIO` | Nombre completo |
| `TELTER` | VARCHAR | `302` | Teléfono |
| `CELTER` | VARCHAR | `NULL` | Celular |
| `EMAIL` | VARCHAR | `NULL` | Email |
| `dirter` | VARCHAR | `CRA17 23-71` | Dirección |
| `coddane` | VARCHAR | `08001` | Código DANE (ubicación) |

**Ejemplo de registro:**
```sql
SELECT * FROM con_terceros WHERE codter = '72229294'
```
```json
{
  "codter": "72229294",
  "nomter": ".CAMARGO PINO MARCO ANTONIO",
  "TELTER": "302",
  "CELTER": null,
  "EMAIL": null,
  "dirter": "CRA17  23-71",
  "coddane": "08001"
}
```

---

### 1.4 Tabla: `Dian_Resoluciones_electronica` (Resolución DIAN)

| Campo BD | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `id` | INT | `4` | ID de la resolución |
| `consecutivo` | INT | `243` | Último consecutivo usado |
| `rango_inicial` | INT | `101` | Rango inicial autorizado |
| `rango_final` | INT | `1000` | Rango final autorizado |
| `id_api` | INT | `61` | ID de resolución en la API |
| `activa` | BIT | `1` | Si está activa |

**Ejemplo de registro:**
```sql
SELECT * FROM Dian_Resoluciones_electronica WHERE activa = 1
```
```json
{
  "id": 4,
  "consecutivo": 243,
  "rango_inicial": 101,
  "rango_final": 1000,
  "id_api": 61,
  "activa": true
}
```

---

### 1.5 Tabla: `dian_parametros_fe` (Parámetros DIAN)

| Campo BD | Tipo | Ejemplo | Descripción |
|----------|------|---------|-------------|
| `url_base` | VARCHAR | `https://facturacionelectronica.mobilsaas.com` | URL base de la API |
| `testSetID` | VARCHAR | `1` | ID del testSet |
| `isPrueba` | BIT | `0` | Si es ambiente de prueba |
| `sync` | BIT | `0` | Si es sincrónico |
| `activo` | BIT | `1` | Si está activo |

**Ejemplo de registro:**
```sql
SELECT * FROM dian_parametros_fe WHERE activo = 1
```
```json
{
  "url_base": "https://facturacionelectronica.mobilsaas.com",
  "testSetID": "1",
  "isPrueba": false,
  "sync": false,
  "activo": true
}
```

---

## 🔄 2. TRANSFORMACIÓN (DIANService)

### 2.1 Paso 1: Obtener Datos Completos

**Método:** `DIANService.getFacturaCompleta(facturaId)`

**Entrada:**
- `facturaId`: `406679` (INT)

**Salida:**
```javascript
{
  factura: {
    id: 406679,
    numfact: "FC-0024",
    codter: "72229294",
    fecha: "2025-11-22",
    fecha_vencimiento: "2025-11-22",
    valvta: 3210.08,
    valiva: 0,
    valdcto: 0,
    netfac: 3210,
    estfac: "B"
  },
  detalles: [
    {
      id: 1,
      id_factura: 406679,
      codins: "02590001",
      qtyins: 1,
      valins: 3210.08,
      ivains: 0,
      valdescuento: 0,
      observa: "VENTA DE PRODUCTOS Y SERVICIOS"
    }
  ],
  cliente: {
    codter: "72229294",
    nomter: ".CAMARGO PINO MARCO ANTONIO",
    TELTER: "302",
    dirter: "CRA17  23-71",
    coddane: "08001"
  }
}
```

---

### 2.2 Paso 2: Transformar a Formato DIAN

**Método:** `DIANService.transformVenFacturaForDIAN(facturaData, resolution, config, invoiceData)`

**Transformaciones principales:**

#### 2.2.1 Número de Factura
```javascript
// BD: resolution.consecutivo = 243
// Transformación: invoiceNumber = consecutivo + 1
invoiceNumber = 243 + 1 = 244
```

#### 2.2.2 Totales
```javascript
// BD: netfac = 3210, valiva = 0, valvta = 3210.08
totalAmount = 3210          // netfac
taxAmount = 0               // valiva
lineExtensionAmount = 3210  // totalAmount - taxAmount
```

#### 2.2.3 Porcentaje de IVA
```javascript
// BD: valiva = 0, valvta = 3210.08
// Cálculo: (taxAmount / lineExtensionAmount) * 100
// Si no se puede calcular, usar 19% por defecto
ivaPercent = 19  // Por defecto (no se pudo calcular)
```

#### 2.2.4 Teléfono del Cliente
```javascript
// BD: TELTER = "302" (solo 3 dígitos)
// Transformación: Normalizar a mínimo 10 dígitos
phoneOriginal = "302"
phoneCleaned = "302"  // Solo dígitos
phoneFinal = "3000000000"  // Rellenado a 10 dígitos (valor por defecto)
```

#### 2.2.5 Líneas de Factura
```javascript
// BD: detalles[0] = { qtyins: 1, valins: 3210.08, ivains: 0, codins: "02590001" }
// Transformación:
invoiceLines = [{
  unit_measure_id: 70,
  invoiced_quantity: 1,              // qtyins
  line_extension_amount: 3210.08,    // valins - valdescuento
  description: "VENTA DE PRODUCTOS Y SERVICIOS",  // observa
  price_amount: 3210.08,             // valins
  code: "02590001",                  // codins
  type_item_identification_id: 4,
  base_quantity: 1,
  free_of_charge_indicator: false,
  tax_totals: [{
    tax_id: 1,
    tax_amount: 0,                   // ivains
    taxable_amount: 3210.08,
    percent: 19                      // ivaPercent
  }]
}]
```

---

## 📤 3. FORMATO API DIAN (JSON Final)

### 3.1 Estructura Completa del JSON

**Endpoint:** `POST https://facturacionelectronica.mobilsaas.com/api/ubl2.1/invoice/{testSetID}`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Body (JSON):**
```json
{
  "number": 244,
  "type_document_id": 1,
  "identification_number": 901994818,
  "resolution_id": 61,
  "sync": false,
  "issue_date": "2025-11-22",
  "due_date": "2025-11-22",
  "profile_id": "1",
  "profile_execution_id": "1",
  "scheme_id": "1",
  "document_currency_code": "COP",
  "invoice_type_code": "1",
  "company": {
    "identification_number": 901994818,
    "name": "ORQUIDEA IA SOLUTIONS S.A.S",
    "type_organization_id": 1,
    "type_document_id": "31",
    "id_location": "11001",
    "address": "CR 53 100 50",
    "phone": "3044261630",
    "email": "orquideaiasolutionssas@gmail.com"
  },
  "customer": {
    "identification_number": 72229294,
    "name": ".CAMARGO PINO MARCO ANTONIO",
    "type_organization_id": 2,
    "type_document_id": "13",
    "id_location": "08001",
    "address": "CRA17  23-71",
    "phone": "3000000000",
    "email": "consumidor@final.com"
  },
  "tax_totals": [
    {
      "tax_id": 1,
      "tax_amount": 0,
      "taxable_amount": 3210,
      "percent": 19
    }
  ],
  "legal_monetary_totals": {
    "line_extension_amount": 3210,
    "tax_exclusive_amount": 3210,
    "tax_inclusive_amount": 3210,
    "payable_amount": 3210,
    "allowance_total_amount": 0,
    "charge_total_amount": 0
  },
  "invoice_lines": [
    {
      "unit_measure_id": 70,
      "invoiced_quantity": 1,
      "line_extension_amount": 3210.08,
      "description": "VENTA DE PRODUCTOS Y SERVICIOS",
      "price_amount": 3210.08,
      "code": "02590001",
      "type_item_identification_id": 4,
      "base_quantity": 1,
      "free_of_charge_indicator": false,
      "tax_totals": [
        {
          "tax_id": 1,
          "tax_amount": 0,
          "taxable_amount": 3210.08,
          "percent": 19
        }
      ]
    }
  ],
  "payment_forms": [
    {
      "payment_form_id": 1,
      "payment_method_id": 10,
      "payment_due_date": "2025-11-22",
      "duration_measure": 0
    }
  ]
}
```

---

## 📊 4. MAPEO DETALLADO: BD → API DIAN

### 4.1 Encabezado de Factura

| Campo API DIAN | Origen BD | Transformación | Ejemplo |
|----------------|-----------|----------------|---------|
| `number` | `resolution.consecutivo` | `consecutivo + 1` | `244` |
| `type_document_id` | Constante | `1` (Factura de Venta) | `1` |
| `identification_number` | Constante | `COMPANY_NIT` | `901994818` |
| `resolution_id` | `resolution.id_api` | Directo | `61` |
| `sync` | `config.sync` | Boolean | `false` |
| `issue_date` | `factura.fecha` | Formato ISO (YYYY-MM-DD) | `"2025-11-22"` |
| `due_date` | `factura.fecha_vencimiento` | Formato ISO (YYYY-MM-DD) | `"2025-11-22"` |
| `profile_id` | `config.isPrueba` | `"1"` (Producción) o `"2"` (Prueba) | `"1"` |
| `document_currency_code` | Constante | `"COP"` | `"COP"` |
| `invoice_type_code` | Constante | `"1"` | `"1"` |

---

### 4.2 Datos de la Empresa

| Campo API DIAN | Origen | Transformación | Ejemplo |
|----------------|--------|----------------|---------|
| `company.identification_number` | Constante | `COMPANY_DATA.identification_number` | `901994818` |
| `company.name` | Constante | `COMPANY_DATA.name` | `"ORQUIDEA IA SOLUTIONS S.A.S"` |
| `company.type_organization_id` | Constante | `1` (Persona Jurídica) | `1` |
| `company.type_document_id` | Constante | `"31"` (NIT) | `"31"` |
| `company.id_location` | Constante | `"11001"` (Bogotá D.C.) | `"11001"` |
| `company.address` | Constante | `COMPANY_DATA.address` | `"CR 53 100 50"` |
| `company.phone` | Constante | `COMPANY_DATA.phone` | `"3044261630"` |
| `company.email` | Constante | `COMPANY_DATA.email` | `"orquideaiasolutionssas@gmail.com"` |

---

### 4.3 Datos del Cliente

| Campo API DIAN | Origen BD | Transformación | Ejemplo |
|----------------|-----------|----------------|---------|
| `customer.identification_number` | `cliente.codter` | Convertir a número | `72229294` |
| `customer.name` | `cliente.nomter` | Uppercase + trim | `".CAMARGO PINO MARCO ANTONIO"` |
| `customer.type_organization_id` | Constante | `2` (Persona Natural) | `2` |
| `customer.type_document_id` | Constante | `"13"` (Cédula) | `"13"` |
| `customer.id_location` | `cliente.coddane` | Directo o `"11001"` por defecto | `"08001"` |
| `customer.address` | `cliente.dirter` | Directo o `"BOGOTA D.C."` por defecto | `"CRA17  23-71"` |
| `customer.phone` | `cliente.TELTER` | Normalizar a 10+ dígitos | `"3000000000"` |
| `customer.email` | `cliente.EMAIL` | Directo o `"consumidor@final.com"` por defecto | `"consumidor@final.com"` |

**Transformación del Teléfono:**
```javascript
// Entrada BD: "302" (3 dígitos)
// 1. Limpiar: remover caracteres no numéricos → "302"
// 2. Validar: si < 10 dígitos → usar "3000000000"
// 3. Resultado: "3000000000" (10 dígitos)
```

---

### 4.4 Totales de Impuestos

| Campo API DIAN | Origen BD | Transformación | Ejemplo |
|----------------|-----------|----------------|---------|
| `tax_totals[0].tax_id` | Constante | `1` (IVA) | `1` |
| `tax_totals[0].tax_amount` | `factura.valiva` | `roundCOP(valiva)` | `0` |
| `tax_totals[0].taxable_amount` | `factura.valvta` | `roundCOP(valvta)` | `3210` |
| `tax_totals[0].percent` | Calculado | `(taxAmount / taxableAmount) * 100` o `19%` por defecto | `19` |

---

### 4.5 Totales Monetarios

| Campo API DIAN | Origen BD | Transformación | Ejemplo |
|----------------|-----------|----------------|---------|
| `legal_monetary_totals.line_extension_amount` | `factura.valvta` | `roundCOP(valvta)` | `3210` |
| `legal_monetary_totals.tax_exclusive_amount` | `factura.valvta` | `roundCOP(valvta)` | `3210` |
| `legal_monetary_totals.tax_inclusive_amount` | `factura.netfac` | `roundCOP(netfac)` | `3210` |
| `legal_monetary_totals.payable_amount` | `factura.netfac` | `roundCOP(netfac)` | `3210` |
| `legal_monetary_totals.allowance_total_amount` | `factura.valdcto` | `roundCOP(valdcto)` | `0` |
| `legal_monetary_totals.charge_total_amount` | Constante | `0` | `0` |

---

### 4.6 Líneas de Factura

| Campo API DIAN | Origen BD | Transformación | Ejemplo |
|----------------|-----------|----------------|---------|
| `invoice_lines[].unit_measure_id` | Constante | `70` (Unidad estándar) | `70` |
| `invoice_lines[].invoiced_quantity` | `detalle.qtyins` | `parseFloat(qtyins)` | `1` |
| `invoice_lines[].line_extension_amount` | `detalle.valins` | `roundCOP(valins - valdescuento)` | `3210.08` |
| `invoice_lines[].description` | `detalle.observa` | Directo o `"VENTA DE PRODUCTOS Y SERVICIOS"` | `"VENTA DE PRODUCTOS Y SERVICIOS"` |
| `invoice_lines[].price_amount` | `detalle.valins` | `roundCOP(valins)` | `3210.08` |
| `invoice_lines[].code` | `detalle.codins` | `String(codins)` | `"02590001"` |
| `invoice_lines[].type_item_identification_id` | Constante | `4` (Código interno) | `4` |
| `invoice_lines[].base_quantity` | `detalle.qtyins` | `parseFloat(qtyins)` | `1` |
| `invoice_lines[].free_of_charge_indicator` | Constante | `false` | `false` |
| `invoice_lines[].tax_totals[0].tax_id` | Constante | `1` (IVA) | `1` |
| `invoice_lines[].tax_totals[0].tax_amount` | `detalle.ivains` | `roundCOP(ivains)` | `0` |
| `invoice_lines[].tax_totals[0].taxable_amount` | `detalle.valins` | `roundCOP(valins - valdescuento)` | `3210.08` |
| `invoice_lines[].tax_totals[0].percent` | Calculado | `ivaPercent` (19% por defecto) | `19` |

---

### 4.7 Formas de Pago

| Campo API DIAN | Origen BD | Transformación | Ejemplo |
|----------------|-----------|----------------|---------|
| `payment_forms[0].payment_form_id` | `factura.efectivo/credito/tarjetacr` | `1` (Efectivo), `2` (Tarjeta), `3` (Transferencia), `4` (Crédito) | `1` |
| `payment_forms[0].payment_method_id` | `factura.efectivo/credito/tarjetacr` | `10` (Efectivo), `48` (Tarjeta), `42` (Transferencia), `1` (Crédito) | `10` |
| `payment_forms[0].payment_due_date` | `factura.fecha_vencimiento` | Formato ISO (YYYY-MM-DD) | `"2025-11-22"` |
| `payment_forms[0].duration_measure` | `factura.plazo` | Solo si es crédito, sino `0` | `0` |

**Lógica de Forma de Pago:**
```javascript
if (factura.tarjetacr > 0) {
  paymentFormId = 2;      // Tarjeta
  paymentMethodId = 48;   // Tarjeta débito/crédito
} else if (factura.Transferencia > 0) {
  paymentFormId = 3;      // Transferencia
  paymentMethodId = 42;   // Transferencia bancaria
} else if (factura.credito > 0) {
  paymentFormId = 4;      // Crédito
  paymentMethodId = 1;    // Crédito
  duration_measure = factura.plazo || 0;  // Días de crédito
} else {
  paymentFormId = 1;      // Efectivo (por defecto)
  paymentMethodId = 10;   // Efectivo
}
```

---

## 🔍 5. VALIDACIONES Y NORMALIZACIONES

### 5.1 Validaciones Aplicadas

| Validación | Campo | Regla | Acción si Falla |
|------------|-------|-------|-----------------|
| Teléfono mínimo | `customer.phone` | Mínimo 10 dígitos | Usar `"3000000000"` |
| Email válido | `customer.email` | Formato email | Usar `"consumidor@final.com"` |
| Número factura | `number` | Entre rango autorizado | Ajustar a `rango_inicial` o `rango_final` |
| IVA calculado | `tax_totals[].percent` | Entre 0-100 | Usar `19%` por defecto |
| Totales redondeados | Todos los montos | 2 decimales | `roundCOP()` |
| trackId | `trackId` | String o no presente | Eliminar si `sync: false` |

---

### 5.2 Normalizaciones Especiales

#### 5.2.1 Teléfono
```javascript
// Entrada: "302" o "300-123-4567" o "(57) 300 123 4567"
// 1. Remover caracteres no numéricos: "302" o "3001234567" o "573001234567"
// 2. Si < 10 dígitos: usar "3000000000"
// 3. Si >= 10 dígitos: usar tal cual (máximo 15)
// Salida: "3000000000" o "3001234567" o "573001234567"
```

#### 5.2.2 Nombre del Cliente
```javascript
// Entrada: "  Juan Pérez  " o "juan perez"
// 1. Trim: "Juan Pérez" o "juan perez"
// 2. Uppercase: "JUAN PÉREZ" o "JUAN PEREZ"
// Salida: "JUAN PÉREZ"
```

#### 5.2.3 Número de Factura
```javascript
// Entrada: resolution.consecutivo = 243, rango_inicial = 101, rango_final = 1000
// 1. Calcular: invoiceNumber = consecutivo + 1 = 244
// 2. Validar rango: 101 <= 244 <= 1000 ✅
// 3. Si fuera < 101: usar 101
// 4. Si fuera > 1000: usar 101 (reiniciar)
// Salida: 244
```

---

## 📋 6. COMPARATIVA LADO A LADO

### 6.1 Ejemplo Completo

#### DATOS DE ENTRADA (BD):
```json
{
  "factura": {
    "ID": 406679,
    "numfact": "FC-0024",
    "codter": "72229294",
    "fecha": "2025-11-22",
    "fecha_vencimiento": "2025-11-22",
    "valvta": 3210.08,
    "valiva": 0,
    "valdcto": 0,
    "netfac": 3210,
    "estfac": "B"
  },
  "detalles": [{
    "codins": "02590001",
    "qtyins": 1,
    "valins": 3210.08,
    "ivains": 0,
    "observa": "VENTA DE PRODUCTOS Y SERVICIOS"
  }],
  "cliente": {
    "codter": "72229294",
    "nomter": ".CAMARGO PINO MARCO ANTONIO",
    "TELTER": "302",
    "dirter": "CRA17  23-71",
    "coddane": "08001"
  },
  "resolution": {
    "consecutivo": 243,
    "id_api": 61,
    "rango_inicial": 101,
    "rango_final": 1000
  }
}
```

#### DATOS DE SALIDA (API DIAN):
```json
{
  "number": 244,                    // ← resolution.consecutivo + 1
  "type_document_id": 1,            // ← Constante
  "identification_number": 901994818, // ← Constante COMPANY_NIT
  "resolution_id": 61,              // ← resolution.id_api
  "sync": false,                    // ← config.sync
  "issue_date": "2025-11-22",       // ← factura.fecha
  "due_date": "2025-11-22",         // ← factura.fecha_vencimiento
  "profile_id": "1",                // ← config.isPrueba ? "2" : "1"
  "company": {
    "identification_number": 901994818, // ← Constante
    "name": "ORQUIDEA IA SOLUTIONS S.A.S", // ← Constante
    "phone": "3044261630"            // ← Constante
  },
  "customer": {
    "identification_number": 72229294,   // ← cliente.codter (convertido a número)
    "name": ".CAMARGO PINO MARCO ANTONIO", // ← cliente.nomter (uppercase)
    "phone": "3000000000",            // ← cliente.TELTER (normalizado a 10 dígitos)
    "id_location": "08001"            // ← cliente.coddane
  },
  "tax_totals": [{
    "tax_amount": 0,                 // ← factura.valiva
    "taxable_amount": 3210,          // ← factura.valvta
    "percent": 19                    // ← Calculado o 19% por defecto
  }],
  "legal_monetary_totals": {
    "line_extension_amount": 3210,   // ← factura.valvta
    "payable_amount": 3210           // ← factura.netfac
  },
  "invoice_lines": [{
    "invoiced_quantity": 1,          // ← detalle.qtyins
    "line_extension_amount": 3210.08, // ← detalle.valins
    "description": "VENTA DE PRODUCTOS Y SERVICIOS", // ← detalle.observa
    "price_amount": 3210.08,         // ← detalle.valins
    "code": "02590001"               // ← detalle.codins
  }]
}
```

---

## ⚠️ 7. CAMPOS CRÍTICOS Y VALIDACIONES

### 7.1 Campos Requeridos por DIAN

| Campo | Requerido | Validación | Si Falla |
|-------|-----------|------------|----------|
| `number` | ✅ Sí | Entre rango autorizado | Ajustar a rango |
| `identification_number` | ✅ Sí | NIT válido | Error |
| `resolution_id` | ✅ Sí | ID válido en API | Error |
| `issue_date` | ✅ Sí | Formato YYYY-MM-DD | Error |
| `customer.identification_number` | ✅ Sí | Número válido | Error |
| `customer.name` | ✅ Sí | String no vacío | Error |
| `customer.phone` | ✅ Sí | Mínimo 10 dígitos | Usar por defecto |
| `customer.email` | ✅ Sí | Formato email | Usar por defecto |
| `legal_monetary_totals.payable_amount` | ✅ Sí | > 0 | Error |
| `invoice_lines[]` | ✅ Sí | Array no vacío | Error |

### 7.2 Campos Opcionales

| Campo | Opcional | Valor por Defecto |
|-------|----------|-------------------|
| `trackId` | ✅ Sí (si `sync: false`) | No incluir |
| `customer.address` | ✅ Sí | `"BOGOTA D.C."` |
| `customer.id_location` | ✅ Sí | `"11001"` |
| `tax_totals[].percent` | ✅ Sí | `19` |

---

## 🔧 8. FUNCIONES DE TRANSFORMACIÓN

### 8.1 `roundCOP(amount)`
```javascript
// Redondea a 2 decimales para evitar errores de punto flotante
roundCOP(3210.085) → 3210.09
roundCOP(3210.084) → 3210.08
roundCOP(null) → 0
```

### 8.2 Normalización de Teléfono
```javascript
// Normaliza teléfono a formato válido para DIAN
normalizePhone("302") → "3000000000"
normalizePhone("300-123-4567") → "3001234567"
normalizePhone("(57) 300 123 4567") → "573001234567"
```

### 8.3 Cálculo de IVA
```javascript
// Calcula porcentaje de IVA o usa por defecto
calculateIVAPercent(0, 3210) → 19  // Por defecto
calculateIVAPercent(609.9, 3210) → 19  // Redondeado a estándar
calculateIVAPercent(160.5, 3210) → 5  // Redondeado a 5%
```

---

## 📝 9. RESUMEN DE TRANSFORMACIONES

### ✅ Transformaciones Automáticas:
1. **Número de factura**: `consecutivo + 1`
2. **Fechas**: Formato ISO (YYYY-MM-DD)
3. **Teléfono**: Normalizado a mínimo 10 dígitos
4. **Totales**: Redondeados a 2 decimales
5. **IVA**: Calculado o 19% por defecto
6. **trackId**: Eliminado si `sync: false`
7. **Nombres**: Uppercase y trim
8. **Códigos**: Convertidos a string

### ⚠️ Valores por Defecto:
- **Teléfono**: `"3000000000"` (si < 10 dígitos)
- **Email**: `"consumidor@final.com"` (si no existe)
- **IVA**: `19%` (si no se puede calcular)
- **Dirección**: `"BOGOTA D.C."` (si no existe)
- **Ubicación**: `"11001"` (Bogotá D.C. si no existe)

---

## 🎯 CONCLUSIÓN

El proceso de transformación convierte los datos de la base de datos SQL Server al formato JSON requerido por la API de DIAN, aplicando validaciones, normalizaciones y valores por defecto para asegurar que todos los campos cumplan con los requisitos de la API.

**Puntos clave:**
- ✅ Todos los campos requeridos se mapean correctamente
- ✅ Validaciones previenen errores en la API
- ✅ Valores por defecto aseguran que siempre haya datos válidos
- ✅ Normalizaciones garantizan formato correcto (teléfono, fechas, etc.)

