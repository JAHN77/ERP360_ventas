# Walkthrough: Verification of Invoice Approval Logic

This walkthrough details the changes made to ensure that any invoice with a CUFE (Código Único de Factura Electrónica) is automatically treated as "ACEPTADA" (Approved), regardless of its stored status (e.g., 'BORRADOR').

## Changes Implemented

### 1. Invoice List Display (`FacturasPage.tsx`)
- **Status Badge**: The status column in the invoices table now checks for the presence of a `cufe`. If present, it displays the "ACEPTADA" badge, overriding the stored status unless it is 'ANULADA' (though currently, it effectively shows ACEPTADA if CUFE exists, logically assuming an annulled invoice might not have a CUFE or handled separately, but the prompt focused on approval).
  - *Note*: If an invoice is rejected but somehow has a CUFE, it will now show as Accepted (which is technically correct if a CUFE exists, it was signed by DIAN).

### 2. Invoice Detail Modal (`FacturasPage.tsx`)
- **Header Status**: The detail modal now also displays the "ACEPTADA" badge in the header if a CUFE is present.

### 3. Filtering Logic (`FacturasPage.tsx`)
- **Status Filter**: The dropdown filter (Todos, Borrador, Enviada, Aceptada, etc.) now correctly categorizes invoices with a CUFE as 'ACEPTADA'.
  - Selecting "Aceptada" includes invoices with `status='ACEPTADA'` OR `cufe` present.
  - Selecting "Borrador" excludes invoices with a `cufe`.

### 4. Dashboard & Reports (`DashboardPage.tsx` & `DataContext.tsx`)
- **Sales Calculations**: Logic for calculating "Total Sales", "Sales by Client", "Sales by Seller", and "Top Products" has been updated.
- **Inclusion Criteria**: Invoices are now included in these calculations if:
  - Status is NOT 'ANULADA'
  - AND (Status is NOT 'BORRADOR' OR `cufe` is present).
- This ensures that valid invoices (with CUFE) that haven't had their status updated from 'BORRADOR' are still counted as valid sales.

## Verification Steps

### Prerequisite
Ensure you have invoices in the database. Ideally, identify or create a test case where an invoice has `estado: 'BORRADOR'` but has a valid string in the `cufe` field.

### Step 1: Verify Invoice List
1. Navigate to the **Facturación** page.
2. Locate an invoice known to have a CUFE (even if you suspect it wasn't marked as sent).
3. **Expectation**: The "Estado" column should show a Green "ACEPTADA" badge. It should NOT show "BORRADOR".

### Step 2: Verify Filtering
1. On the **Facturación** page, use the status filter dropdown.
2. Select **"Borrador"**.
   - **Expectation**: The invoice with CUFE should NOT appear.
3. Select **"Aceptada"** (or "Enviada" if that's the label used, mapped to valid status).
   - **Expectation**: The invoice with CUFE SHOULD appear.

### Step 3: Verify Detail Modal
1. Click the "eye" icon (Ver detalles) on the invoice with CUFE.
2. **Expectation**: In the top right of the modal, the status badge should show "ACEPTADA".
3. **Expectation**: The "Validación Fiscal" section (existing logic) should show the CUFE and "Factura Timbrada".

### Step 4: Verify Dashboard Stats (Optional but Recommended)
1. Note the total sales amount or top products count.
2. If the invoice with CUFE was previously excluded (because it was 'BORRADOR'), the sales figures should now be higher/correct.
