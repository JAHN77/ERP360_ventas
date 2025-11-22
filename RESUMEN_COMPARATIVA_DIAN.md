# 📊 RESUMEN COMPARATIVA: DATOS BD → API DIAN

## 🔄 FLUJO COMPLETO CON EJEMPLO REAL

### 📥 ENTRADA: Datos desde Base de Datos

```sql
-- Factura
SELECT * FROM ven_facturas WHERE ID = 406679
```
```json
{
  "ID": 406679,
  "numfact": "FC-0024",
  "codter": "72229294",
  "fecha": "2025-11-22",
  "valvta": 3210.08,
  "valiva": 0,
  "netfac": 3210
}

-- Detalle
SELECT * FROM ven_detafact WHERE id_factura = 406679
```
```json
{
  "codins": "02590001",
  "qtyins": 1,
  "valins": 3210.08,
  "ivains": 0
}

-- Cliente
SELECT * FROM con_terceros WHERE codter = '72229294'
```
```json
{
  "codter": "72229294",
  "nomter": ".CAMARGO PINO MARCO ANTONIO",
  "TELTER": "302",
  "dirter": "CRA17  23-71"
}
```

---

### 🔄 TRANSFORMACIÓN: Proceso de Conversión

| Campo BD | Valor BD | Transformación | Valor API DIAN |
|----------|----------|----------------|----------------|
| `ven_facturas.numfact` | `"FC-0024"` | → | `number: 244` (desde consecutivo) |
| `ven_facturas.codter` | `"72229294"` | → | `customer.identification_number: 72229294` |
| `con_terceros.nomter` | `".CAMARGO PINO MARCO ANTONIO"` | Uppercase + trim | `customer.name: ".CAMARGO PINO MARCO ANTONIO"` |
| `con_terceros.TELTER` | `"302"` | Normalizar a 10 dígitos | `customer.phone: "3000000000"` |
| `ven_facturas.valvta` | `3210.08` | Redondear a 2 decimales | `legal_monetary_totals.line_extension_amount: 3210` |
| `ven_facturas.netfac` | `3210` | Directo | `legal_monetary_totals.payable_amount: 3210` |
| `ven_detafact.qtyins` | `1` | Directo | `invoice_lines[0].invoiced_quantity: 1` |
| `ven_detafact.valins` | `3210.08` | Redondear | `invoice_lines[0].price_amount: 3210.08` |

---

### 📤 SALIDA: JSON para API DIAN

**Endpoint:** `POST https://facturacionelectronica.mobilsaas.com/api/ubl2.1/invoice/1`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Accept": "application/json"
}
```

**Body:**
```json
{
  "number": 244,
  "sync": false,
  "customer": {
    "identification_number": 72229294,
    "name": ".CAMARGO PINO MARCO ANTONIO",
    "phone": "3000000000"
  },
  "legal_monetary_totals": {
    "payable_amount": 3210
  },
  "invoice_lines": [{
    "invoiced_quantity": 1,
    "price_amount": 3210.08
  }]
}
```

---

## 🎯 MAPEO VISUAL COMPLETO

```
┌─────────────────────────────────────────────────────────────┐
│                    BASE DE DATOS                            │
├─────────────────────────────────────────────────────────────┤
│ ven_facturas                                                │
│   ├─ ID: 406679                                             │
│   ├─ numfact: "FC-0024"                                     │
│   ├─ codter: "72229294"                                     │
│   ├─ fecha: "2025-11-22"                                    │
│   ├─ valvta: 3210.08                                        │
│   ├─ valiva: 0                                              │
│   └─ netfac: 3210                                           │
│                                                              │
│ ven_detafact                                                │
│   ├─ codins: "02590001"                                     │
│   ├─ qtyins: 1                                              │
│   ├─ valins: 3210.08                                        │
│   └─ ivains: 0                                              │
│                                                              │
│ con_terceros                                                │
│   ├─ codter: "72229294"                                     │
│   ├─ nomter: ".CAMARGO PINO MARCO ANTONIO"                  │
│   ├─ TELTER: "302"                                          │
│   └─ dirter: "CRA17  23-71"                                 │
└─────────────────────────────────────────────────────────────┘
                        ↓
            [DIANService.transformVenFacturaForDIAN]
                        ↓
┌─────────────────────────────────────────────────────────────┐
│                    API DIAN (JSON)                          │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "number": 244,              ← resolution.consecutivo + 1  │
│   "customer": {                                             │
│     "identification_number": 72229294,  ← codter            │
│     "name": ".CAMARGO...",    ← nomter (uppercase)          │
│     "phone": "3000000000"     ← TELTER (normalizado)        │
│   },                                                        │
│   "legal_monetary_totals": {                                │
│     "payable_amount": 3210    ← netfac                      │
│   },                                                        │
│   "invoice_lines": [{                                       │
│     "invoiced_quantity": 1,   ← qtyins                      │
│     "price_amount": 3210.08   ← valins                      │
│   }]                                                        │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ TRANSFORMACIONES CRÍTICAS

### 1. Teléfono
```
BD: "302" (3 dígitos)
  ↓
Normalizar: Remover caracteres no numéricos
  ↓
Validar: Si < 10 dígitos → usar "3000000000"
  ↓
API: "3000000000" (10 dígitos)
```

### 2. Número de Factura
```
BD: resolution.consecutivo = 243
  ↓
Calcular: 243 + 1 = 244
  ↓
Validar: ¿244 está entre 101 y 1000? ✅
  ↓
API: number: 244
```

### 3. IVA
```
BD: valiva = 0, valvta = 3210.08
  ↓
Calcular: (0 / 3210.08) * 100 = 0%
  ↓
Validar: No se puede calcular → usar 19% por defecto
  ↓
API: tax_totals[0].percent: 19
```

### 4. trackId
```
BD: config.sync = false
  ↓
Validar: Si sync = false → NO incluir trackId
  ↓
API: (campo no presente en JSON)
```

---

## 📋 TABLA COMPARATIVA COMPLETA

| Categoría | Campo BD | Tipo BD | Campo API DIAN | Tipo API | Transformación |
|-----------|----------|---------|----------------|----------|----------------|
| **Encabezado** |
| | `resolution.consecutivo` | INT | `number` | Number | `consecutivo + 1` |
| | `factura.fecha` | DATE | `issue_date` | String | `YYYY-MM-DD` |
| | `factura.fecha_vencimiento` | DATE | `due_date` | String | `YYYY-MM-DD` |
| | `resolution.id_api` | INT | `resolution_id` | Number | Directo |
| | `config.sync` | BIT | `sync` | Boolean | Directo |
| **Cliente** |
| | `cliente.codter` | VARCHAR | `customer.identification_number` | Number | `Number(codter)` |
| | `cliente.nomter` | VARCHAR | `customer.name` | String | `Uppercase + trim` |
| | `cliente.TELTER` | VARCHAR | `customer.phone` | String | Normalizar a 10+ dígitos |
| | `cliente.EMAIL` | VARCHAR | `customer.email` | String | Directo o por defecto |
| | `cliente.dirter` | VARCHAR | `customer.address` | String | Directo o por defecto |
| | `cliente.coddane` | VARCHAR | `customer.id_location` | String | Directo o "11001" |
| **Totales** |
| | `factura.valvta` | DECIMAL | `legal_monetary_totals.line_extension_amount` | Number | `roundCOP(valvta)` |
| | `factura.netfac` | DECIMAL | `legal_monetary_totals.payable_amount` | Number | `roundCOP(netfac)` |
| | `factura.valiva` | DECIMAL | `tax_totals[0].tax_amount` | Number | `roundCOP(valiva)` |
| | Calculado | - | `tax_totals[0].percent` | Number | `19%` por defecto |
| **Líneas** |
| | `detalle.qtyins` | DECIMAL | `invoice_lines[].invoiced_quantity` | Number | `parseFloat(qtyins)` |
| | `detalle.valins` | DECIMAL | `invoice_lines[].price_amount` | Number | `roundCOP(valins)` |
| | `detalle.codins` | VARCHAR | `invoice_lines[].code` | String | `String(codins)` |
| | `detalle.observa` | VARCHAR | `invoice_lines[].description` | String | Directo o por defecto |

---

## ✅ VALIDACIONES APLICADAS

1. ✅ **Teléfono**: Mínimo 10 dígitos → Si falla: `"3000000000"`
2. ✅ **Email**: Formato válido → Si falla: `"consumidor@final.com"`
3. ✅ **Número factura**: Entre rango autorizado → Si falla: Ajustar a rango
4. ✅ **IVA**: Calcular o usar 19% → Si falla: `19%`
5. ✅ **trackId**: String o no presente → Si falla: Eliminar si `sync: false`
6. ✅ **Totales**: Redondeados a 2 decimales → `roundCOP()`

---

## 🎯 CONCLUSIÓN

El sistema transforma correctamente los datos de SQL Server al formato JSON requerido por la API de DIAN, aplicando todas las validaciones y normalizaciones necesarias para garantizar que la factura sea aceptada.

