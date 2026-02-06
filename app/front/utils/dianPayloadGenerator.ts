export const createInvoicePayload = (formData: any) => {
    const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

    // Función para calcular el dígito de verificación
    const calculateDV = (nit: number): number => {
        const primes = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
        const nitStr = String(nit);
        let sum = 0;

        for (let i = 0; i < nitStr.length; i++) {
            const digit = parseInt(nitStr[nitStr.length - 1 - i]);
            sum += digit * primes[i];
        }

        const remainder = sum % 11;
        return remainder > 1 ? 11 - remainder : remainder;
    };

    const totals = formData.items.reduce((acc: any, item: any) => {
        const price = Number(item.precioUnitario) || 0;
        const qty = Number(item.cantidad) || 0;
        const discPercent = Number(item.descuentoPorcentaje) || 0;
        const taxPercent = Number(item.ivaPorcentaje) || 0;

        const lineGross = price * qty;
        const lineDiscount = lineGross * (discPercent / 100);
        const lineNet = lineGross - lineDiscount;
        const lineTax = lineNet * (taxPercent / 100);

        return {
            lineExtensionAmount: acc.lineExtensionAmount + lineNet,
            allowanceTotalAmount: acc.allowanceTotalAmount + lineDiscount,
            taxExclusiveAmount: acc.taxExclusiveAmount + lineNet,
            taxAmount: acc.taxAmount + lineTax,
            payableAmount: acc.payableAmount + lineNet + lineTax
        };
    }, { lineExtensionAmount: 0, allowanceTotalAmount: 0, taxExclusiveAmount: 0, taxAmount: 0, payableAmount: 0 });

    return {
        number: parseInt(formData.number) || 0,
        exact_decimals: true,
        legal_monetary_totals: {
            tax_inclusive_amount: round(totals.payableAmount),
            line_extension_amount: round(totals.lineExtensionAmount),
            charge_total_amount: 0,
            tax_exclusive_amount: round(totals.taxExclusiveAmount),
            payable_amount: round(totals.payableAmount),
            allowance_total_amount: round(totals.allowanceTotalAmount)
        },
        identification_number: 901907454, // Hardcoded per user request to remove any DV logic here
        payment_forms: [
            {
                payment_method_id: formData.paymentFormId === '2' ? 44 : parseInt(formData.paymentMethodId),
                duration_measure: "0",
                payment_due_date: formData.dueDate,
                payment_form_id: parseInt(formData.paymentFormId) || 1
            }
        ],
        tax_totals: [
            {
                tax_amount: round(totals.taxAmount),
                taxable_amount: round(totals.taxExclusiveAmount),
                percent: 19,
                tax_id: 1
            }
        ],
        resolution_id: 98,
        sync: true,
        notes: formData.observacionesInternas || "sin ob",
        type_document_id: 1,
        invoice_lines: formData.items.map((item: any) => {
            const price = Number(item.precioUnitario) || 0;
            const qty = Number(item.cantidad) || 0;
            const discPercent = Number(item.descuentoPorcentaje) || 0;
            const taxPercent = Number(item.ivaPorcentaje) || 0;

            const lineGross = price * qty;
            const lineDiscount = lineGross * (discPercent / 100);
            const lineNet = lineGross - lineDiscount;
            const taxAmt = lineNet * (taxPercent / 100);

            return {
                base_quantity: qty,
                invoiced_quantity: qty,
                code: item.referencia || item.codProducto || '001',
                tax_totals: [
                    {
                        tax_amount: round(taxAmt),
                        taxable_amount: round(lineNet),
                        percent: taxPercent,
                        tax_id: 1
                    }
                ],
                free_of_charge_indicator: false,
                line_extension_amount: round(lineNet),
                allowance_charges: discPercent > 0 ? [{
                    charge_indicator: false,
                    allowance_charge_reason: "Descuento",
                    amount: round(lineDiscount),
                    base_amount: round(lineGross)
                }] : undefined,
                type_item_identification_id: 4,
                price_amount: round(price),
                description: item.descripcion,
                unit_measure_id: (() => {
                    const code = String(item.unit_measure_id || item.unidadMedidaCodigo || '').trim();
                    if (code === '001' || code === 'HORA') return 730; // HORA
                    if (code === '002' || code === 'DIA') return 606; // DIA
                    return 70; // UNIDAD / Default
                })(),
                unit_measure: (() => {
                    const code = String(item.unit_measure_id || item.unidadMedidaCodigo || '').trim();
                    if (code === '001' || code === 'HORA') return 'hora';
                    if (code === '002' || code === 'DIA') return 'dia';
                    return 'unidad';
                })()
            };
        }),
        customer: {
            identification_number: parseInt(formData.customer.identification_number),
            name: formData.customer.name?.trim(),
            phone: formData.customer.phone?.trim(),
            address: formData.customer.address?.trim(),
            email: (formData.customer.email && formData.customer.email.includes('@')) ? formData.customer.email.trim() : 'noemail@facturacion.com',
            merchant_registration: "No tiene",
            type_document_id: formData.customer.type_document_id || "31",
            type_organization_id: 2,
            type_liability_id: parseInt(formData.customer.type_liability_id) || 1,
            municipality_id: formData.customer.id_location || "08001",
            id_location: formData.customer.id_location || "08001",
            type_regime_id: parseInt(formData.customer.type_regime_id) || 1,
            dv: formData.customer.dv || (formData.customer.type_document_id === "31" ? calculateDV(parseInt(formData.customer.identification_number)) : ""),
            tax_detail_id: 1
        }
    };
};
