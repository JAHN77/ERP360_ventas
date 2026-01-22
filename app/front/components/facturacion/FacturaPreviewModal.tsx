import React, { useMemo, useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Factura } from '../../types';
import { useNotifications } from '../../hooks/useNotifications';
import { useDocumentPreferences } from '../../hooks/useDocumentPreferences';
import DocumentOptionsToolbar from '../comercial/DocumentOptionsToolbar';
import SendEmailModal from '../comercial/SendEmailModal';
import { useData } from '../../hooks/useData';
import { findClienteByIdentifier } from '../../utils/clientes';
import { apiSendFacturaEmail, apiClient } from '../../services/apiClient';

interface FacturaPreviewModalProps {
    factura: Factura | null;
    onClose: () => void;
    onTimbrar?: (id: string, mode: 'test' | 'production') => Promise<void>;
}

const FacturaPreviewModal: React.FC<FacturaPreviewModalProps> = ({ factura, onClose, onTimbrar }) => {
    const { addNotification } = useNotifications();
    const { clientes, datosEmpresa, vendedores } = useData();
    const { preferences, updatePreferences, resetPreferences } = useDocumentPreferences('factura');
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isStamping, setIsStamping] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>('');
    const [pdfFilename, setPdfFilename] = useState<string>('');

    const cliente = useMemo(() => {
        if (!factura) return null;
        return findClienteByIdentifier(
            clientes,
            factura.clienteId ?? (factura as any).cliente_id ?? (factura as any).nitCliente
        ) || null;
    }, [factura, clientes]);

    const vendedor = useMemo(() => {
        if (!factura || !vendedores.length) return undefined;
        return vendedores.find(v =>
            String(v.id) === String(factura.vendedorId) ||
            String(v.codigoVendedor) === String(factura.vendedorId) ||
            v.codiEmple === factura.vendedorId
        );
    }, [factura, vendedores]);

    useEffect(() => {
        const fetchPdfPreview = async () => {
            if (!factura || !cliente) return;

            setIsGenerating(true);
            // Helper para redondear a 2 decimales
            const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

            try {
                // Construir payload compatible con el endpoint de Factura Directa (Formato Exacto Solicitado)
                const payload = {
                    number: parseInt(factura.numeroFactura.replace(/\D/g, '')),
                    type_document_id: 1, // Factura de Venta
                    resolution_id: parseInt(datosEmpresa.resolucionId || "1"),
                    sync: true,
                    identification_number: parseInt(datosEmpresa.nit || "0"),

                    customer: {
                        identification_number: parseInt(cliente.numeroDocumento),
                        dv: cliente.digitoVerificacion || "0",
                        name: cliente.nombreCompleto || cliente.razonSocial,
                        phone: cliente.telefono || "2222222",
                        address: (cliente.direccion || "Direccion desconocida").trim(),
                        email: (cliente.email || "cliente@correo.com").trim(),
                        merchant_registration: "No tiene",
                        type_document_id: cliente.tipoDocumentoId || "31",
                        type_organization_id: parseInt(cliente.tipoPersonaId || "2"),
                        type_liability_id: 1,
                        municipality_id: cliente.ciudadId || "08001",
                        id_location: cliente.ciudadId || "08001",
                        type_regime_id: 1,
                        tax_detail_id: 1
                    },

                    payment_forms: [
                        {
                            payment_form_id: factura.formaPago === '2' ? 2 : 1,
                            payment_method_id: 10,
                            payment_due_date: factura.fechaVencimiento ? factura.fechaVencimiento.split('T')[0] : factura.fechaFactura.split('T')[0],
                            duration_measure: "0"
                        }
                    ],

                    legal_monetary_totals: {
                        line_extension_amount: 0,
                        tax_exclusive_amount: 0,
                        tax_inclusive_amount: 0,
                        allowance_total_amount: 0,
                        charge_total_amount: 0,
                        payable_amount: 0
                    },

                    tax_totals: [] as any[],

                    invoice_lines: (factura.items || []).map((item, index) => {
                        const precioUnitario = round2(item.precioUnitario);
                        const cantidad = round2(item.cantidad);
                        const brutoLinea = round2(precioUnitario * cantidad);
                        const porcentajeIva = round2(item.ivaPorcentaje || 0);
                        const baseImpuesto = brutoLinea;
                        const montoIva = round2(baseImpuesto * (porcentajeIva / 100));

                        return {
                            unit_measure_id: 70,
                            invoiced_quantity: cantidad,
                            line_extension_amount: brutoLinea,
                            free_of_charge_indicator: false,
                            description: item.descripcion,
                            code: item.codProducto || item.productoId || `ITEM-${index + 1}`,
                            type_item_identification_id: 3,
                            price_amount: precioUnitario,
                            base_quantity: cantidad,
                            tax_totals: [
                                {
                                    tax_id: 1,
                                    tax_amount: montoIva,
                                    taxable_amount: baseImpuesto,
                                    percent: porcentajeIva
                                }
                            ]
                        };
                    })
                };

                // Recalcular totales globales
                const lines = payload.invoice_lines;
                const subtotal = lines.reduce((sum, i) => sum + i.line_extension_amount, 0);
                const descuentos = 0;
                const subtotalBase = round2(subtotal - descuentos);

                // Totales Impuestos Globales
                let totalImpuestos = 0;
                const taxTotalsMap = new Map();

                lines.forEach(line => {
                    line.tax_totals.forEach(tax => {
                        const key = `${tax.tax_id}-${tax.percent}`;
                        const current = taxTotalsMap.get(key) || { tax_amount: 0, taxable_amount: 0, percent: tax.percent, tax_id: tax.tax_id };
                        current.tax_amount += tax.tax_amount;
                        current.taxable_amount += tax.taxable_amount;
                        taxTotalsMap.set(key, current);
                        totalImpuestos += tax.tax_amount;
                    });
                });

                payload.tax_totals = Array.from(taxTotalsMap.values()).map(t => ({
                    tax_id: t.tax_id,
                    tax_amount: round2(t.tax_amount),
                    taxable_amount: round2(t.taxable_amount),
                    percent: t.percent
                }));

                payload.legal_monetary_totals = {
                    line_extension_amount: round2(subtotal),
                    tax_exclusive_amount: round2(subtotalBase),
                    tax_inclusive_amount: round2(subtotalBase + totalImpuestos),
                    allowance_total_amount: round2(descuentos),
                    charge_total_amount: 0,
                    payable_amount: round2(subtotalBase + totalImpuestos)
                };

                console.log('🚀 Payload PDF:', JSON.stringify(payload, null, 2));

                const response = await apiClient.generatePreviewPdf(payload);
                if (response.success && response.data?.pdf_url) {
                    setPdfPreviewUrl(response.data.pdf_url);
                    setPdfFilename(response.data.filename || `Factura-${factura.numeroFactura}.pdf`);
                } else {
                    addNotification({ message: 'No se pudo obtener la vista previa del PDF remoto.', type: 'warning' });
                }

            } catch (error: any) {
                console.error("Error fetching remote PDF preview:", error);
                addNotification({ message: "Error al cargar la vista previa remota.", type: "error" });
            } finally {
                setIsGenerating(false);
            }
        }

        if (factura && cliente && !pdfPreviewUrl) {
            fetchPdfPreview();
        }
    }, [factura, cliente, datosEmpresa]);


    const handleTimbrarClick = async (mode: 'test' | 'production') => {
        if (!factura || !onTimbrar) return;
        if (mode === 'production' && !window.confirm(`¿Está seguro de que desea timbrar la factura ${factura.numeroFactura}? Esto enviará el documento a la DIAN.`)) {
            return;
        }
        setIsStamping(true);
        try {
            await onTimbrar(factura.id, mode);
        } catch (error) {
            console.error('Error al timbrar desde modal:', error);
        } finally {
            setIsStamping(false);
        }
    };

    const handleDownload = () => {
        if (!pdfPreviewUrl) return;
        const link = document.createElement('a');
        link.href = pdfPreviewUrl;
        link.download = pdfFilename || `Factura-${factura?.numeroFactura}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendEmail = () => {
        setIsEmailModalOpen(true);
    };

    const handleConfirmSendEmail = async (emailData: { to: string; subject: string; body: string }) => {
        if (!factura || !cliente || !pdfPreviewUrl) return;
        setIsGenerating(true);
        addNotification({ message: 'Enviando correo con PDF remoto...', type: 'info' });

        try {
            // Descargar PDF para convertir a Base64 si es necesario, o enviar URL si backend soporta
            // Por simplicidad y compatibilidad con endpoint existente, descargamos y convertimos a base64
            const response = await fetch(pdfPreviewUrl);
            const blob = await response.blob();
            const reader = new FileReader();
            reader.readAsDataURL(blob);

            reader.onloadend = async () => {
                const base64data = reader.result?.toString().split(',')[1];

                if (base64data) {
                    const sendRes = await apiSendFacturaEmail(factura.id!, {
                        destinatario: emailData.to,
                        asunto: emailData.subject,
                        mensaje: emailData.body,
                        pdfBase64: base64data
                    });

                    if (sendRes.success) {
                        addNotification({ message: `Correo enviado a ${emailData.to}`, type: 'success' });
                        setIsEmailModalOpen(false);
                    } else {
                        throw new Error(sendRes.message || 'Error al enviar');
                    }
                }
            }

        } catch (error: any) {
            console.error('Error sending email:', error);
            addNotification({ message: error.message || 'Error enviando correo', type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    if (!factura) return null;
    if (!cliente) return null;

    return (
        <>
            <Modal isOpen={!!factura} onClose={onClose} title="" size="4xl" noPadding>
                <div className="sticky top-0 z-10 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between p-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 px-2 truncate">
                            Factura: {factura.numeroFactura}
                            {factura.estado === 'BORRADOR' && (
                                <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                    BORRADOR
                                </span>
                            )}
                        </h3>
                        <div className="flex items-center space-x-1 bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg">
                            {onTimbrar && factura.estado === 'BORRADOR' && (
                                <>
                                    <button
                                        onClick={() => handleTimbrarClick('test')}
                                        disabled={isGenerating || isStamping}
                                        title="Generar JSON para Pruebas"
                                        className="h-8 px-3 flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mr-1"
                                    >
                                        <i className="fas fa-file-code mr-2"></i>
                                        <span className="font-medium text-sm">Prueba JSON</span>
                                    </button>

                                    <button
                                        onClick={() => handleTimbrarClick('production')}
                                        disabled={isGenerating || isStamping}
                                        title="Timbrar y Enviar a DIAN"
                                        className="h-8 px-3 flex items-center justify-center rounded bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed mr-1"
                                    >
                                        {isStamping ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin mr-2"></i>
                                                <span>Timbrando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-paper-plane mr-2"></i>
                                                <span className="font-medium text-sm">Timbrar</span>
                                            </>
                                        )}
                                    </button>
                                    <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                                </>
                            )}
                            <button
                                onClick={handleDownload}
                                disabled={isGenerating || !pdfPreviewUrl}
                                title="Descargar PDF"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-sky-500 transition-colors"
                            >
                                <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
                            </button>
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button
                                onClick={handleSendEmail}
                                disabled={isGenerating || !pdfPreviewUrl}
                                title="Enviar por Correo"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-500 transition-colors"
                            >
                                <i className="fas fa-paper-plane"></i>
                            </button>
                            <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                            <button
                                onClick={onClose}
                                title="Cerrar"
                                className="h-8 w-8 flex items-center justify-center rounded text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:text-red-500 transition-colors"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-900 h-[80vh] flex justify-center overflow-hidden relative">
                    {isGenerating && !pdfPreviewUrl ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <i className="fas fa-spinner fa-spin text-4xl mb-4 text-blue-500"></i>
                            <p>Generando vista previa remota...</p>
                        </div>
                    ) : pdfPreviewUrl ? (
                        <div className="w-full h-full bg-slate-200 overflow-hidden relative">
                            <iframe
                                src={`${pdfPreviewUrl}#toolbar=0&navpanes=0&pagemode=none&view=FitH`}
                                title="Vista Previa PDF Remota"
                                className="absolute inset-0 w-full border-none"
                                style={{ height: '100%', display: 'block' }}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <i className="fas fa-exclamation-circle text-4xl mb-2 opacity-50"></i>
                            <span className="font-medium">No se pudo cargar la vista previa</span>
                        </div>
                    )}
                </div>
            </Modal>
            {isEmailModalOpen && factura && cliente && (
                <SendEmailModal
                    isOpen={isEmailModalOpen}
                    onClose={() => setIsEmailModalOpen(false)}
                    onSend={handleConfirmSendEmail}
                    to={cliente.email || ''}
                    subject={`Factura ${factura.numeroFactura} de ${datosEmpresa.nombre}`}
                    body={`Estimado/a ${cliente.nombreCompleto},

Esperamos que este mensaje le encuentre bien.

Adjuntamos su Factura Electrónica N° ${factura.numeroFactura} correspondiente a su reciente compra.

Agradecemos su pago oportuno.

Cordialmente,
El equipo de ${datosEmpresa.nombre}`}
                />
            )}
        </>
    );
};

export default FacturaPreviewModal;