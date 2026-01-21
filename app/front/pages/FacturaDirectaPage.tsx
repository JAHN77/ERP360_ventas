import React, { useState, useEffect } from 'react';
import FacturaDirectaForm from '../components/facturacion/FacturaDirectaForm';
import Card, { CardContent } from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { useNavigation } from '../hooks/useNavigation';
import { useNotifications } from '../hooks/useNotifications';
import { useData } from '../hooks/useData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';

const FacturaDirectaPage: React.FC = () => {
    const { setPage } = useNavigation();
    const { addNotification } = useNotifications();
    const { datosEmpresa, refreshFacturasYRemisiones } = useData();
    const { selectedCompany } = useAuth();
    const [nextNumber, setNextNumber] = useState<string>('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Estados para Modo Prueba
    const [isTestMode, setIsTestMode] = useState(false);
    const [jsonModalOpen, setJsonModalOpen] = useState(false);
    const [jsonContent, setJsonContent] = useState<string>('');

    useEffect(() => {
        const fetchNextNumber = async () => {
            try {
                const response = await apiClient.getNextInvoiceNumber();
                if (response.success && response.data) {
                    setNextNumber(response.data.nextNumber);
                } else {
                    setNextNumber('88996');
                }
            } catch (error) {
                console.error("Error fetching next invoice number", error);
                setNextNumber('88996');
            }
        };
        fetchNextNumber();
    }, []);

    const handleSubmit = async (formData: any) => {
        try {
            addNotification({ message: 'Iniciando proceso de facturación...', type: 'info' });

            // 1. Preparar Payload para DIAN
            const totals = formData.items.reduce((acc: any, item: any) => {
                const subtotal = item.precioUnitario * item.cantidad;
                const discount = subtotal * (item.descuentoPorcentaje / 100);
                const taxBase = subtotal - discount;
                const taxAmount = taxBase * (item.ivaPorcentaje / 100);
                return {
                    lineExtensionAmount: acc.lineExtensionAmount + subtotal,
                    taxAmount: acc.taxAmount + taxAmount,
                    payableAmount: acc.payableAmount + (taxBase + taxAmount)
                };
            }, { lineExtensionAmount: 0, taxAmount: 0, payableAmount: 0 });

            const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

            const payload = {
                number: parseInt(formData.number) || 0,
                legal_monetary_totals: {
                    tax_inclusive_amount: round(totals.payableAmount),
                    line_extension_amount: round(totals.lineExtensionAmount),
                    charge_total_amount: 0,
                    tax_exclusive_amount: round(totals.lineExtensionAmount),
                    payable_amount: round(totals.payableAmount),
                    allowance_total_amount: 0
                },
                identification_number: 901994818, // Orquidea NIT fijo según ManualInvoiceModal
                payment_forms: [
                    {
                        payment_method_id: parseInt(formData.paymentMethodId),
                        duration_measure: "0",
                        payment_due_date: formData.dueDate,
                        payment_form_id: 1
                    }
                ],
                tax_totals: [
                    {
                        tax_amount: round(totals.taxAmount),
                        taxable_amount: round(totals.lineExtensionAmount),
                        percent: 19,
                        tax_id: 1
                    }
                ],
                resolution_id: 101,
                sync: true,
                type_document_id: 1,
                invoice_lines: formData.items.map((item: any) => {
                    const lineExtension = round(item.precioUnitario * item.cantidad);
                    const taxAmt = round(lineExtension * (item.ivaPorcentaje / 100));
                    return {
                        base_quantity: item.cantidad,
                        invoiced_quantity: item.cantidad,
                        code: item.codProducto || '001',
                        tax_totals: [
                            {
                                tax_amount: taxAmt,
                                taxable_amount: lineExtension,
                                percent: item.ivaPorcentaje,
                                tax_id: 1
                            }
                        ],
                        free_of_charge_indicator: false,
                        line_extension_amount: lineExtension,
                        type_item_identification_id: 3,
                        price_amount: item.precioUnitario,
                        description: item.descripcion,
                        unit_measure_id: 70 // Mantener 70 por ahora, cambiar a 642 si falla
                    };
                }),
                customer: {
                    identification_number: parseInt(formData.customer.identification_number), // Asegurar número
                    name: formData.customer.name,
                    phone: formData.customer.phone,
                    address: formData.customer.address,
                    email: formData.customer.email,
                    merchant_registration: "No tiene",
                    type_document_id: formData.customer.type_document_id || "31", // String, key correcta
                    type_organization_id: 2,
                    type_liability_id: parseInt(formData.customer.type_liability_id) || 1,
                    municipality_id: formData.customer.id_location || "08001",
                    id_location: formData.customer.id_location || "08001",
                    type_regime_id: parseInt(formData.customer.type_regime_id) || 1,
                    dv: formData.customer.dv,
                    tax_detail_id: 1
                }
            };

            // Si es Orquidea, flujo especial
            if (selectedCompany?.razonSocial?.toLowerCase().includes('orquidea')) {
                setIsGeneratingPdf(true);
                try {
                    // Generar y descargar PDF
                    const response = await apiClient.generatePreviewPdf(payload);
                    if (response.success) {
                        const { pdf_url: url, filename } = response.data;
                        if (url) {
                            const link = document.createElement('a');
                            link.href = url;
                            const downloadName = filename || `Factura_${formData.number}.pdf`;
                            link.setAttribute('download', downloadName);
                            link.setAttribute('target', '_blank');
                            document.body.appendChild(link);
                            link.click();

                            // Limpieza con timeout largo para asegurar descarga
                            setTimeout(() => {
                                document.body.removeChild(link);
                                if (url.startsWith('blob:')) {
                                    window.URL.revokeObjectURL(url);
                                }
                            }, 60000);

                            addNotification({ message: 'PDF descargado.', type: 'success' });
                        } else {
                            throw new Error('No se recibió URL ni datos del PDF');
                        }
                    } else {
                        throw new Error(response.message || 'Error generando PDF');
                    }
                } catch (error: any) {
                    console.error('Error en flujo Orquidea (PDF):', error);
                    addNotification({ message: `Error generando PDF: ${error.message}`, type: 'error' });
                } finally {
                    setIsGeneratingPdf(false);
                }

                // Lógica Condicional según Modo Prueba
                if (isTestMode) {
                    // MODO PRUEBA: Mostrar JSON y NO guardar
                    setJsonContent(JSON.stringify(payload, null, 2));
                    setJsonModalOpen(true);
                    addNotification({ message: 'Modo Prueba: Factura NO enviada a DIAN ni guardada.', type: 'warning' });
                    return;
                } else {
                    // MODO PRODUCCIÓN: Guardar y Enviar a DIAN
                    addNotification({ message: 'Procediendo con envío a DIAN y guardado...', type: 'info' });
                    await proceedWithInvoice(payload, formData);
                    return;
                }
            } else {
                // Para otras empresas, proceder directamente (flujo estándar)
                await proceedWithInvoice(payload, formData);
            }

        } catch (error: any) {
            console.error('Error en proceso de facturación:', error);
            addNotification({ message: `Error: ${error.message}`, type: 'error' });
        }
    };

    const proceedWithInvoice = async (payload: any, formData: any) => {
        try {
            // 2. Enviar a DIAN
            const dianResponse = await apiClient.sendManualDianTest(payload);
            if (!dianResponse.success) {
                throw new Error(dianResponse.message || 'Error enviando a DIAN');
            }

            const cufe = (dianResponse as any).dianResult?.cufe || (dianResponse as any).dianResult?.uuid || 'CUFE_PENDIENTE';
            addNotification({ message: 'Factura aceptada por la DIAN', type: 'success' });

            // 3. Guardar en DB
            const isOrquidea = selectedCompany?.db_name === 'orquidea';
            const now = new Date();
            const formatDateTime = (date: Date) => {
                const pad = (n: number) => n.toString().padStart(2, '0');
                return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`;
            };

            const codterFormatted = `${formData.customer.identification_number}-${formData.customer.dv}`;

            let sqlQuery = '';
            if (isOrquidea) {
                const totals = formData.items.reduce((acc: any, item: any) => {
                    const subtotal = item.precioUnitario * item.cantidad;
                    const discount = subtotal * (item.descuentoPorcentaje / 100);
                    const taxBase = subtotal - discount;
                    const taxAmount = taxBase * (item.ivaPorcentaje / 100);
                    return {
                        lineExtensionAmount: acc.lineExtensionAmount + subtotal,
                        taxAmount: acc.taxAmount + taxAmount,
                        payableAmount: acc.payableAmount + (taxBase + taxAmount)
                    };
                }, { lineExtensionAmount: 0, taxAmount: 0, payableAmount: 0 });

                sqlQuery = `
    DECLARE @NewId INT;
    INSERT INTO ven_facturas (
        codalm, numfact, tipfac, codter, doccoc, fecfac, venfac, codven, 
        valvta, valiva, valotr, valant, valdev, abofac, valdcto, valret, valrica, valriva, 
        netfac, valcosto, codcue, efectivo, cheques, credito, tarjetacr, TarjetaDB, Transferencia, 
        valpagado, resolucion_dian, Observa, TARIFA_CREE, RETECREE, codusu, fecsys, estfac, 
        VALDOMICILIO, CUFE, estado_envio, IdCaja, afecta_inventario
    ) VALUES (
        '001', '${formData.number}', 'FV', '${codterFormatted}', '${formData.number}', '${formData.date} 00:00:00.000', '${formData.dueDate} 00:00:00.000', '${formData.seller || '001'}',
        ${totals.lineExtensionAmount.toFixed(2)}, ${totals.taxAmount.toFixed(2)}, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00,
        ${totals.payableAmount.toFixed(2)}, 0.00, '13050501', ${formData.paymentMethodId === '10' ? totals.payableAmount.toFixed(2) : '0.00'}, 0.00, ${formData.paymentMethodId === '30' ? totals.payableAmount.toFixed(2) : '0.00'}, 0.00, 0.00, ${formData.paymentMethodId === '31' ? totals.payableAmount.toFixed(2) : '0.00'},
        ${totals.payableAmount.toFixed(2)}, '02', 'Factura Directa', 0.0000, 0, 'ADMIN', '${formatDateTime(now)}', '1',
        0.00, '${cufe}', 1, 1, 1
    );
    SET @NewId = SCOPE_IDENTITY();
    `;
                const detailsSql = formData.items.map((item: any) => `
    INSERT INTO ven_detafact (
        codalm, numfac, tipfact, codins, observa, qtyins, valins, PRECIOUND, PRECIO_LISTA, ivains, valdescuento, id_factura
    ) VALUES (
        '001', '${formData.number}', 'FV', '${item.codProducto || '001'}', '${item.descripcion.substring(0, 50)}',
        ${item.cantidad}, ${item.precioUnitario.toFixed(2)}, ${item.precioUnitario.toFixed(2)}, ${item.precioUnitario.toFixed(2)},
        ${item.valorIva.toFixed(2)}, ${(item.precioUnitario * item.cantidad * (item.descuentoPorcentaje / 100)).toFixed(2)}, @NewId
    );`).join('');
                sqlQuery += detailsSql;
            }

            const saveResponse = await apiClient.executeQuery(sqlQuery);
            if (!saveResponse.success) {
                throw new Error('Error guardando en base de datos: ' + saveResponse.message);
            }

            addNotification({ message: 'Factura guardada exitosamente', type: 'success' });
            await refreshFacturasYRemisiones();
            setPage('facturacion_electronica');

        } catch (error: any) {
            console.error(error);
            addNotification({ message: error.message || 'Error en el proceso', type: 'error' });
        }
    };

    return (
        <div className="animate-fade-in space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Factura Directa {nextNumber ? `#${nextNumber}` : ''}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Diligencia el formulario para generar una factura directa y enviarla a la DIAN.
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-center mb-4">
                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Configuración</h1>

                {selectedCompany?.razonSocial?.toLowerCase().includes('orquidea') && (
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${isTestMode ? 'text-amber-600' : 'text-slate-400'}`}>
                            {isTestMode ? 'MODO PRUEBA' : 'Producción'}
                        </span>
                        <button
                            onClick={() => setIsTestMode(!isTestMode)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${isTestMode ? 'bg-amber-500' : 'bg-slate-200'
                                }`}
                        >
                            <span
                                className={`${isTestMode ? 'translate-x-5' : 'translate-x-1'
                                    } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>
                )}
            </div>

            <Card className="mb-6">
                <CardContent>
                    <FacturaDirectaForm
                        onSubmit={handleSubmit}
                        nextInvoiceNumber={nextNumber}
                        onCancel={() => setPage('facturacion_electronica')}
                    />
                </CardContent>
            </Card>

            {/* Modal para ver JSON en Modo Prueba */}
            <Modal
                isOpen={jsonModalOpen}
                onClose={() => setJsonModalOpen(false)}
                title="JSON Generado (Modo Prueba)"
                size="4xl"
            >
                <div className="p-4">
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <i className="fas fa-exclamation-triangle text-amber-500"></i>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-amber-700">
                                    Estás en <strong>Modo Prueba</strong>. Este JSON es el que se enviaría a la DIAN.
                                    La factura <strong>NO</strong> se ha guardado en la base de datos ni se ha enviado a la DIAN.
                                    El PDF se ha descargado para tu revisión.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                        <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-b border-slate-200">
                            <span className="text-xs font-mono text-slate-500 font-medium">payload.json</span>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(jsonContent);
                                    addNotification({ message: 'JSON copiado al portapapeles', type: 'success' });
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                            >
                                <i className="fas fa-copy"></i> Copiar
                            </button>
                        </div>
                        <pre className="p-4 text-xs font-mono text-slate-700 overflow-auto max-h-[60vh] bg-white">
                            {jsonContent}
                        </pre>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={() => setJsonModalOpen(false)}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </Modal>

            {isGeneratingPdf && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-200 dark:border-slate-700">
                        <div className="mb-6 relative">
                            <div className="w-20 h-20 border-4 border-slate-100 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <i className="fas fa-file-pdf text-blue-600 text-2xl animate-pulse"></i>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Generando Factura</h3>
                        <p className="text-slate-500 dark:text-slate-400">
                            Estamos procesando tu solicitud y generando el PDF...
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacturaDirectaPage;
