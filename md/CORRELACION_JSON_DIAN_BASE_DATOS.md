# 📊 CORRELACIÓN: JSON DIAN vs BASE DE DATOS

Este documento muestra **de dónde sacamos cada campo del JSON** que se envía a la API de DIAN y cómo lo transformamos desde la base de datos.

## 🎯 JSON DE EJEMPLO (Válido para DIAN)

```json
{
  "number": 96274,
  "type_document_id": 1,
  "identification_number": 802024306,
  "resolution_id": 4,
  "sync": true,
  "company": {
    "identification_number": 802024306,
    "name": "MULTIACABADOS S.A.S.",
    "type_organization_id": 1,
    "type_document_id": "31",
    "id_location": "08001",
    "address": "CALLE 65 N° 12 B3-16 NUEVO MILENIO",
    "phone": "3116853113-3008538958",
    "email": "multiacabados.sas.factura@gmail.com"
  },
  "customer": {
    "identification_number": 72229294,
    "name": "CAMARGO PINO MARCO ANTONIO",
    "type_organization_id": 2,
    "type_document_id": "13",
    "id_location": "08001",
    "address": "CRA17 23-71",
    "phone": "0000000302",
    "email": "cliente@ejemplo.com"
  },
  "tax_totals": [
    {
      "tax_id": 1,
      "tax_amount": 926.05,
      "taxable_amount": 4873.95,
      "percent": 19
    }
  ],
  "legal_monetary_totals": {
    "line_extension_amount": 4873.95,
    "tax_exclusive_amount": 4873.95,
    "tax_inclusive_amount": 5800,
    "payable_amount": 5800,
    "allowance_total_amount": 0,
    "charge_total_amount": 0
  },
  "invoice_lines": [
    {
      "unit_measure_id": 70,
      "invoiced_quantity": 1,
      "line_extension_amount": 4873.95,
      "description": "ACEITE 3 EN 1 GOTERO 30 ML LICAVIR",
      "price_amount": 4873.95,
      "code": "02590001",
      "type_item_identification_id": 4,
      "base_quantity": 1,
      "free_of_charge_indicator": false,
      "tax_totals": [
        {
          "tax_id": 1,
          "tax_amount": 926.05,
          "taxable_amount": 4873.95,
          "percent": 19
        }
      ]
    }
  ],
  "payment_forms": [
    {
      "payment_form_id": 1,
      "payment_method_id": 10,
      "payment_due_date": "2025-11-28",
      "duration_measure": 0
    }
  ]
}
```

---

## 📋 TABLA DE CORRELACIÓN COMPLETA

### 1. CAMPOS PRINCIPALES (Raíz del JSON)

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `number` | `96274` | Último número de factura + 1 | `ven_facturas` | `numfact` | Busca MAX(numfact) numérico, luego +1. Si no hay, usa 96275 | `dian-service.cjs:479-527` |
| `type_document_id` | `1` | Constante o configuración | - | - | `1` = Producción, `2` = Prueba (desde `config.isPrueba`) | `dian-service.cjs:839` |
| `identification_number` | `802024306` | Datos de empresa | `gen_empresa` | `nitemp` | Se obtiene desde `gen_empresa.nitemp` **tomando solo la parte antes del guión** (ej: "802024306-1" → "802024306") o constante `COMPANY_NIT` | `dian-service.cjs:138-148, 861` |
| `resolution_id` | `4` | Resolución DIAN activa | `Dian_Resolucion_electronica` | `codigo` | Se obtiene desde `Dian_Resolucion_electronica.codigo` donde `activa = 1` | `dian-service.cjs:50-96, 875` |
| `sync` | `true` | Configuración DIAN | - | - | Valor boolean desde `config.sync` (default: false) | `dian-service.cjs:835, 863` |

---

### 2. SECCIÓN `company` (Empresa)

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `company.identification_number` | `802024306` | NIT de la empresa | `gen_empresa` | `nitemp` | **Solo parte antes del guión**: Si `nitemp = "802024306-1"` → se toma `"802024306"`. `Number()` o constante | `dian-service.cjs:138-148, 865` |
| `company.name` | `"MULTIACABADOS S.A.S."` | Razón social | `gen_empresa` | `razemp` | `String(empresa.razemp).trim().toUpperCase()` | `dian-service.cjs:139, 866` |
| `company.type_organization_id` | `1` | Constante | - | - | `1` = Persona Jurídica (siempre) | `dian-service.cjs:867` |
| `company.type_document_id` | `"31"` | Constante | - | - | `"31"` = NIT (string, no número) | `dian-service.cjs:868` |
| `company.id_location` | `"08001"` | Código DANE municipio | `gen_empresa` | `Coddane` | `String(empresa.Coddane)` o `"11001"` por defecto - **Nota:** Campo `Coddane` (mayúscula, no `codmunicipio`) | `dian-service.cjs:148, 869` |
| `company.address` | `"CALLE 65..."` | Dirección empresa | `gen_empresa` | `diremp` | `String(empresa.diremp).trim()` | `dian-service.cjs:143, 870` |
| `company.phone` | `"3116853113-3008538958"` | Teléfono empresa | `gen_empresa` | `teleep` | `String(empresa.teleep).replace(/[^\d]/g, '')` | `dian-service.cjs:144, 871` |
| `company.email` | `"multiacabados.sas.factura@gmail.com"` | Email empresa | `gen_empresa` | `email` | `String(empresa.email).trim().toLowerCase()` | `dian-service.cjs:145, 872` |

**📝 Nota:** Los datos de empresa se obtienen dinámicamente desde `gen_empresa` en la función `getCompanyData()` (línea 105-158).

---

### 3. SECCIÓN `customer` (Cliente)

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `customer.identification_number` | `72229294` | Código del cliente | `con_terceros` | `codter` | `Number(cliente.codter)` - Puede venir también de `invoiceData.customer_document` | `dian-service.cjs:793-798, 875` |
| `customer.name` | `"CAMARGO PINO MARCO ANTONIO"` | Nombre del cliente | `con_terceros` | `nomter` | `String(cliente.nomter).toUpperCase().trim()` | `dian-service.cjs:800-805, 876` |
| `customer.type_organization_id` | `2` | Tipo de tercero | `con_terceros` | `tipter` | `Number(cliente.tipter)` - `1` = Jurídica, `2` = Natural | `dian-service.cjs:809, 877` |
| `customer.type_document_id` | `"13"` | Tipo de documento | `con_terceros` | `Tipo_documento` o `tipo_documento` | `String(cliente.Tipo_documento)` - `"13"` = Cédula, `"31"` = NIT | `dian-service.cjs:808, 878` |
| `customer.id_location` | `"08001"` | Código DANE | `con_terceros` | `coddane` | `String(cliente.coddane)` o `"11001"` por defecto | `dian-service.cjs:879` |
| `customer.address` | `"CRA17 23-71"` | Dirección cliente | `con_terceros` | `dirter` | `String(cliente.dirter)` o `"BOGOTA D.C."` por defecto | `dian-service.cjs:880` |
| `customer.phone` | `"0000000302"` | Teléfono cliente | `con_terceros` | `TELTER` o `CELTER` | Normalizado con `normalizePhone()`: mínimo 10 dígitos | `dian-service.cjs:822-829, 881` |
| `customer.email` | `"cliente@ejemplo.com"` | Email cliente | `con_terceros` | `EMAIL` o `email` | `String(cliente.EMAIL)` o `"cliente@ejemplo.com"` por defecto | `dian-service.cjs:882` |

**📝 Nota:** Los datos del cliente se obtienen desde `con_terceros` usando el `codter` de la factura (línea 294-319).

---

### 4. SECCIÓN `tax_totals` (Totales de Impuestos)

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `tax_totals[0].tax_id` | `1` | Constante | - | - | `1` = IVA (número, no string) | `dian-service.cjs:571-578, 885` |
| `tax_totals[0].tax_amount` | `926.05` | IVA total factura | `ven_facturas` | `valiva` | **Recalculado desde suma de líneas** para consistencia exacta | `dian-service.cjs:532, 843-845, 886` |
| `tax_totals[0].taxable_amount` | `4873.95` | Subtotal sin IVA | `ven_facturas` | `valvta` | **Recalculado desde suma de líneas** para consistencia exacta | `dian-service.cjs:531, 846-848, 887` |
| `tax_totals[0].percent` | `19` | Calculado | - | `valiva/valvta` | Calculado desde `valiva` y `valvta`, redondeado a 19%, 8%, 5% o 0% | `dian-service.cjs:542-567, 888` |

**⚠️ IMPORTANTE:** El `tax_amount` y `taxable_amount` se **recalculan desde la suma de las líneas** para garantizar que coincidan exactamente (línea 843-848).

---

### 5. SECCIÓN `legal_monetary_totals` (Totales Monetarios)

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `line_extension_amount` | `4873.95` | Subtotal sin IVA | `ven_facturas` | `valvta` | **Recalculado desde suma de líneas** | `dian-service.cjs:846-848, 891` |
| `tax_exclusive_amount` | `4873.95` | Subtotal sin IVA | `ven_facturas` | `valvta` | Igual que `line_extension_amount` | `dian-service.cjs:892` |
| `tax_inclusive_amount` | `5800` | Total con IVA | Calculado | `valvta + valiva` | `lineExtensionAmountFinal + taxAmountFinal` | `dian-service.cjs:849, 893` |
| `payable_amount` | `5800` | Total a pagar | `ven_facturas` | `netfac` | Igual que `tax_inclusive_amount` | `dian-service.cjs:894` |
| `allowance_total_amount` | `0` | Descuento total | `ven_facturas` | `valdcto` o `descuento_valor` | `Number(roundCOP(venFactura.valdcto))` | `dian-service.cjs:534, 895` |
| `charge_total_amount` | `0` | Cargos adicionales | - | - | Siempre `0` (constante) | `dian-service.cjs:896` |

**⚠️ IMPORTANTE:** Todos los totales se **recalculan desde la suma de las líneas** para garantizar consistencia exacta con la DIAN.

---

### 6. SECCIÓN `invoice_lines` (Líneas de la Factura)

Cada línea se construye desde `ven_detafact` (tabla de detalles de factura):

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `invoice_lines[].unit_measure_id` | `70` | Constante | - | - | Siempre `70` (Unidad estándar DIAN) | `dian-service.cjs:654` |
| `invoice_lines[].invoiced_quantity` | `1` | Cantidad | `ven_detafact` | `qtyins` o `cantidad` | `Number(parseFloat(detalle.qtyins))` | `dian-service.cjs:625, 655` |
| `invoice_lines[].line_extension_amount` | `4873.95` | Precio * cantidad - descuento | `ven_detafact` | `valins`, `qtyins`, `valdescuento` | `roundCOP((precio * cantidad) - descuento)` | `dian-service.cjs:628, 656` |
| `invoice_lines[].description` | `"ACEITE 3 EN 1..."` | Descripción | `ven_detafact` | `observa` o `descripcion` | `String(detalle.observa)` o por defecto | `dian-service.cjs:657` |
| `invoice_lines[].price_amount` | `4873.95` | Precio unitario | `ven_detafact` | `valins` o `precioUnitario` | `Number(roundCOP(detalle.valins))` | `dian-service.cjs:626, 658` |
| `invoice_lines[].code` | `"02590001"` | Código producto | `ven_detafact` | `codins` o `codProducto` | `String(detalle.codins)` | `dian-service.cjs:659` |
| `invoice_lines[].type_item_identification_id` | `4` | Constante | - | - | Siempre `4` (Código estándar interno DIAN) | `dian-service.cjs:660` |
| `invoice_lines[].base_quantity` | `1` | Cantidad base | `ven_detafact` | `qtyins` | Igual que `invoiced_quantity` | `dian-service.cjs:661` |
| `invoice_lines[].free_of_charge_indicator` | `false` | Constante | - | - | Siempre `false` (boolean) | `dian-service.cjs:662` |
| `invoice_lines[].tax_totals[0].tax_id` | `1` | Constante | - | - | Siempre `1` = IVA (número) | `dian-service.cjs:648-651, 664` |
| `invoice_lines[].tax_totals[0].tax_amount` | `926.05` | IVA del detalle | `ven_detafact` | `ivains` o `valorIva` | `Number(roundCOP(detalle.ivains))` | `dian-service.cjs:627, 665` |
| `invoice_lines[].tax_totals[0].taxable_amount` | `4873.95` | Base imponible | Calculado | `line_extension_amount` | Igual que `line_extension_amount` | `dian-service.cjs:666` |
| `invoice_lines[].tax_totals[0].percent` | `19` | Calculado | - | `ivains / line_extension` | Calculado y redondeado a 19%, 8%, 5% o 0% | `dian-service.cjs:631-645, 667` |

**⚠️ VALIDACIÓN CRÍTICA:** 
- La suma de `invoice_lines[].tax_totals[0].tax_amount` DEBE coincidir EXACTAMENTE con `tax_totals[0].tax_amount`
- La suma de `invoice_lines[].line_extension_amount` DEBE coincidir EXACTAMENTE con `legal_monetary_totals.line_extension_amount`
- Si hay diferencia, se ajusta automáticamente la última línea (líneas 675-765).

---

### 7. SECCIÓN `payment_forms` (Formas de Pago)

| Campo JSON | Valor Ejemplo | Origen en BD | Tabla BD | Campo BD | Transformación | Código Ubicación |
|------------|---------------|--------------|----------|----------|----------------|------------------|
| `payment_forms[0].payment_form_id` | `1` | Determina según forma de pago | `ven_facturas` | `efectivo`, `credito`, `tarjetacr`, `Transferencia` | `1`=Efectivo, `2`=Tarjeta, `3`=Transferencia, `4`=Crédito | `dian-service.cjs:588-605, 900` |
| `payment_forms[0].payment_method_id` | `10` | Determina según forma de pago | `ven_facturas` | Mismo que arriba | `10`=Efectivo, `48`=Tarjeta, `42`=Transferencia, `1`=Crédito | `dian-service.cjs:589-605, 901` |
| `payment_forms[0].payment_due_date` | `"2025-11-28"` | Fecha vencimiento | `ven_facturas` | `fecha_vencimiento` o `venfac` | `String(new Date(fecha).toISOString().split('T')[0])` | `dian-service.cjs:461-463, 902` |
| `payment_forms[0].duration_measure` | `0` | Días de crédito | `ven_facturas` | `plazo` | Solo si `payment_form_id === 4` (crédito), sino `0` | `dian-service.cjs:903` |

**📝 Lógica de Forma de Pago:**
1. Si `tarjetacr > 0` → Form ID: 2, Method ID: 48
2. Si `Transferencia > 0` → Form ID: 3, Method ID: 42
3. Si `credito > 0` → Form ID: 4, Method ID: 1, `duration_measure = plazo`
4. Si no → Form ID: 1, Method ID: 10 (Efectivo)

---

## 🔍 CONSULTAS SQL QUE SE EJECUTAN

### 1. Obtener Datos de Empresa
```sql
SELECT TOP 1 
  nitemp,
  razemp,
  diremp,
  teleep,
  email,
  Coddane
FROM gen_empresa
ORDER BY id DESC
```
**Ubicación:** `dian-service.cjs:110-121`
**Notas:**
- `nitemp`: Se toma solo la parte antes del guión (ej: "802024306-1" → "802024306")
- `Coddane`: Campo con mayúscula inicial (no `codmunicipio`)
- `email`: Campo en minúscula (no `emailemp`)

### 2. Obtener Último Número de Factura
```sql
SELECT TOP 1 
  numfact,
  CASE 
    WHEN ISNUMERIC(numfact) = 1 THEN CAST(numfact AS INT)
    WHEN numfact LIKE 'FC-%' AND ISNUMERIC(SUBSTRING(numfact, 4, LEN(numfact))) = 1 
      THEN CAST(SUBSTRING(numfact, 4, LEN(numfact)) AS INT)
    ELSE 0
  END as maxNum
FROM ven_facturas
WHERE (
  ISNUMERIC(numfact) = 1 OR
  (numfact LIKE 'FC-%' AND ISNUMERIC(SUBSTRING(numfact, 4, LEN(numfact))) = 1)
)
ORDER BY maxNum DESC
```
**Ubicación:** `dian-service.cjs:485-506`

### 3. Obtener Resolución DIAN
```sql
SELECT TOP 1 
  id,
  consecutivo,
  rango_inicial,
  rango_final,
  codigo,
  activa
FROM Dian_Resolucion_electronica
WHERE activa = 1
ORDER BY id DESC
```
**Ubicación:** `dian-service.cjs:50-96`
**Nota:** Se obtiene el campo `codigo` que se usa como `resolution_id` en el JSON

### 4. Obtener Factura Completa
```sql
-- Encabezado
SELECT * FROM ven_facturas WHERE ID = @facturaId

-- Detalles
SELECT * FROM ven_detafact WHERE id_factura = @facturaId

-- Cliente
SELECT * FROM con_terceros WHERE codter = @codter
```
**Ubicación:** `dian-service.cjs:245-319`

---

## ⚠️ CORRECCIONES NECESARIAS vs JSON DE EJEMPLO

### ✅ Ya Implementado Correctamente:
1. ✅ Todos los tipos de datos son correctos (números como números, strings como strings)
2. ✅ `tax_id` es número (1) no string
3. ✅ Validación de consistencia de totales entre factura y líneas
4. ✅ Recalculo de totales desde líneas para garantizar coincidencia exacta

### 🔧 Posibles Mejoras Identificadas:

1. **Campo `id_location` del cliente:**
   - **Ejemplo:** `"08001"` (Barranquilla)
   - **Actual:** Se usa `cliente.coddane` o `"11001"` (Bogotá) por defecto
   - **Estado:** ✅ Correcto - Se toma desde `con_terceros.coddane`

2. **Campo `phone` del cliente:**
   - **Ejemplo:** `"0000000302"` (10 dígitos)
   - **Actual:** Se normaliza a 10 dígitos mínimo
   - **Estado:** ✅ Correcto - Función `normalizePhone()` asegura formato correcto

3. **Campo `email` del cliente:**
   - **Ejemplo:** `"cliente@ejemplo.com"` (valor de ejemplo)
   - **Actual:** Se toma desde `cliente.EMAIL` o usa por defecto
   - **Estado:** ✅ Correcto - Valor por defecto si no existe

---

## 📝 RESUMEN DE ORIGEN DE DATOS

| Sección | Tabla Principal | Campos Clave |
|---------|----------------|--------------|
| **Encabezado** | `ven_facturas` | `numfact`, `valvta`, `valiva`, `netfac`, `fecfac`, `venfac`, `codter` |
| **Empresa** | `gen_empresa` | `nitemp` (solo parte antes del guión), `razemp`, `diremp`, `teleep`, `email`, `Coddane` |
| **Cliente** | `con_terceros` | `codter`, `nomter`, `tipter`, `Tipo_documento`, `coddane`, `dirter`, `TELTER`, `EMAIL` |
| **Líneas** | `ven_detafact` | `codins`, `qtyins`, `valins`, `ivains`, `valdescuento`, `observa` |
| **Forma Pago** | `ven_facturas` | `efectivo`, `credito`, `tarjetacr`, `Transferencia`, `plazo` |
| **Resolución** | `Dian_Resolucion_electronica` | `codigo`, `id`, `consecutivo`, `rango_inicial`, `rango_final`, `activa` |

---

## 🎯 FLUJO COMPLETO

1. **Obtener Factura:** `getFacturaCompleta(facturaId)` → Consulta `ven_facturas`, `ven_detafact`, `con_terceros`
2. **Obtener Empresa:** `getCompanyData()` → Consulta `gen_empresa`
3. **Obtener Resolución:** `getDIANResolution()` → Consulta `Dian_Resolucion_electronica` (campo `codigo`)
4. **Generar Número:** Consulta MAX(`ven_facturas.numfact`) + 1
5. **Construir Líneas:** Itera sobre `ven_detafact`, calcula valores, ajusta para consistencia
6. **Recalcular Totales:** Suma líneas para garantizar coincidencia exacta
7. **Construir JSON:** Ensambla todo en formato DIAN
8. **Validar Consistencia:** Verifica que totales cuadren exactamente

---

**Última actualización:** Generado automáticamente desde código fuente
**Archivo fuente:** `app/back/services/dian-service.cjs`

