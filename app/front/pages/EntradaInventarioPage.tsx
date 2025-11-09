import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import Table, { Column } from '../components/ui/Table';
import { useTable } from '../hooks/useTable';
import { ActivityLog, Producto } from '../types';
import { isNotEmpty, isPositiveInteger, isNonNegativeNumber } from '../utils/validation';
import { useData } from '../hooks/useData';

// Helper to format currency
const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

// Helper to parse the new structured details string
const parseDetails = (details: string): Record<string, string> => {
    if (!details) return { Cantidad: 'N/A', Motivo: 'N/A', CostoU: '0', Ref: 'N/A', ValorTotal: '0' };

    // Intentar parsear como JSON (nuevo formato estructurado)
    try {
        const parsed = JSON.parse(details);
        if (parsed && typeof parsed === 'object') {
            return {
                Cantidad: parsed.cantidad !== undefined ? String(parsed.cantidad) : 'N/A',
                Motivo: parsed.motivo || 'N/A',
                CostoU: parsed.costoUnitario !== undefined ? String(parsed.costoUnitario) : '0',
                Ref: parsed.referencia || 'N/A',
                ValorTotal: parsed.valorTotal !== undefined ? String(parsed.valorTotal) : '0'
            };
        }
    } catch (error) {
        // No es JSON, continuar con los formatos legacy
    }

    // Check for new format
    if (details.includes(' | ')) {
        const parts = details.split(' | ');
        const data: Record<string, string> = {};
        parts.forEach(part => {
            const [key, ...value] = part.split(': ');
            if (key && value.length > 0) {
                data[key.trim()] = value.join(': ').trim();
            }
        });
        return data;
    }
    
    // Fallback for old format
    const cantidadMatch = details.match(/Ingresaron (\d+)/);
    const motivoMatch = details.match(/Motivo: (.*)/);
    return {
        Cantidad: cantidadMatch ? cantidadMatch[1] : 'N/A',
        Motivo: motivoMatch ? motivoMatch[1] : details,
        CostoU: '0',
        Ref: 'N/A',
        ValorTotal: cantidadMatch ? cantidadMatch[1] : '0'
    };
};

interface FormData {
    selectedProductId: string;
    quantity: number | string;
    costoUnitario: number | string;
    documentoReferencia: string;
    reason: string;
}

interface Errors {
    [key: string]: string;
}

const MAX_STOCK_PER_PRODUCT = 1000;

const EntradaInventarioPage: React.FC = () => {
    const { user } = useAuth();
    const { addNotification } = useNotifications();
    const { productos: allProducts, ingresarStockProducto, activityLog: allLogs } = useData();
    
    const [formData, setFormData] = useState<FormData>({
        selectedProductId: '',
        quantity: 1,
        costoUnitario: 0,
        documentoReferencia: '',
        reason: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New state for product search
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    
    const selectedProduct = useMemo(() => allProducts.find(p => p.id === Number(formData.selectedProductId)), [formData.selectedProductId, allProducts]);

    const filteredProducts = useMemo(() => {
        const sortedList = [...allProducts].sort((a, b) => a.nombre.trim().localeCompare(b.nombre.trim()));

        const trimmedSearch = productSearchTerm.trim();
        // Requerir mínimo 2 caracteres para mostrar resultados
        if (!trimmedSearch || trimmedSearch.length < 2) {
            return [];
        }

        const lowercasedTerm = trimmedSearch.toLowerCase();
        return sortedList.filter(p => 
            p.nombre.toLowerCase().includes(lowercasedTerm) || 
            String(p.id).includes(lowercasedTerm)
        );
    }, [productSearchTerm, allProducts]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const inventoryLogs = useMemo(() => 
        [...allLogs].filter(log => log.action === 'Entrada de Inventario').sort((a,b) => b.timestamp - a.timestamp), 
        [allLogs]
    );

    const validate = useCallback(() => {
        const newErrors: Errors = {};
        if (!isNotEmpty(formData.selectedProductId)) {
            newErrors.selectedProductId = 'Debe seleccionar un producto.';
        }
        if (!isPositiveInteger(formData.quantity)) {
            newErrors.quantity = 'La cantidad debe ser un número entero positivo.';
        } else if (selectedProduct) {
            const currentStock = selectedProduct.controlaExistencia ?? 0;
            const entryQuantity = Number(formData.quantity);
            if (currentStock + entryQuantity > MAX_STOCK_PER_PRODUCT) {
                newErrors.quantity = `La entrada supera el stock máximo de ${MAX_STOCK_PER_PRODUCT} unidades. (Stock actual: ${currentStock})`;
            }
        }
        if (!isNonNegativeNumber(formData.costoUnitario)) {
            newErrors.costoUnitario = 'El costo debe ser un número no negativo.';
        }
        if (!isNotEmpty(formData.reason)) {
            newErrors.reason = 'El motivo es obligatorio.';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, selectedProduct]);

    useEffect(() => {
        if(hasSubmitted) validate();
    }, [formData, hasSubmitted, validate]);

    const resetForm = () => {
        setFormData({
            selectedProductId: '',
            quantity: 1,
            costoUnitario: 0,
            documentoReferencia: '',
            reason: '',
        });
        setProductSearchTerm('');
        setHasSubmitted(false);
        setErrors({});
    };

    const handleFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'quantity' || name === 'costoUnitario') {
            const numericString = value.replace(/[^0-9]/g, '');
            setFormData(prev => ({ ...prev, [name]: numericString }));
        } else {
            setFormData(prev => ({...prev, [name]: value}));
        }
    }

    const handleProductSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProductSearchTerm(e.target.value);
        setIsProductDropdownOpen(true);
        // Clear selection if user starts typing a new search
        if (formData.selectedProductId) {
            setFormData(prev => ({ ...prev, selectedProductId: '' }));
        }
    };

    const handleProductSelect = (product: Producto) => {
        setFormData(prev => ({ ...prev, selectedProductId: String(product.id) }));
        setProductSearchTerm(product.nombre);
        setIsProductDropdownOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setHasSubmitted(true);
        if (!validate() || !user) return;

        setIsSubmitting(true);
        
        try {
            const updatedProduct = await ingresarStockProducto(
                Number(formData.selectedProductId), 
                Number(formData.quantity), 
                formData.reason, 
                user,
                Number(formData.costoUnitario),
                formData.documentoReferencia
            );
            addNotification({ 
                message: `Stock de '${updatedProduct.nombre}' actualizado a ${updatedProduct.controlaExistencia ?? 0}.`, 
                type: 'success' 
            });
            
            resetForm();
        } catch (error) {
            addNotification({ message: (error as Error).message, type: 'warning' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const { paginatedData, requestSort, sortConfig } = useTable({ data: inventoryLogs, searchKeys: [], initialRowsPerPage: 5 });

    const columns: Column<ActivityLog>[] = [
        { header: 'Fecha', accessor: 'timestamp', cell: (item) => new Date(item.timestamp).toLocaleString('es-CO') },
        { header: 'Producto', accessor: 'entity', cell: (item) => item.entity.name },
        { 
            header: 'Cantidad', 
            accessor: 'details', 
            cell: (item) => {
                const details = parseDetails(item.details);
                return <div className="text-right font-semibold text-green-600 dark:text-green-400">+{details['Cantidad'] || 'N/A'}</div>;
            } 
        },
        {
            header: 'Costo Unitario',
            accessor: 'details',
            cell: (item) => {
                const details = parseDetails(item.details);
                const cost = parseFloat(details['CostoU']);
                return <div className="text-right">{!isNaN(cost) && cost > 0 ? formatCurrency(cost) : 'N/A'}</div>;
            }
        },
        {
            header: 'Valor Total',
            accessor: 'details',
            cell: (item) => {
                const details = parseDetails(item.details);
                const totalParsed = parseFloat(details['ValorTotal']);
                if (!isNaN(totalParsed) && totalParsed > 0) {
                    return <div className="text-right font-bold">{formatCurrency(totalParsed)}</div>;
                }
                const cost = parseFloat(details['CostoU']);
                const qty = parseFloat(details['Cantidad']);
                const total = !isNaN(cost) && !isNaN(qty) ? cost * qty : 0;
                return <div className="text-right font-bold">{total > 0 ? formatCurrency(total) : 'N/A'}</div>;
            }
        },
        { header: 'Documento Ref.', accessor: 'details', cell: (item) => parseDetails(item.details)['Ref'] || 'N/A' },
        { header: 'Motivo', accessor: 'details', cell: (item) => parseDetails(item.details)['Motivo'] || item.details },
        { header: 'Usuario', accessor: 'user', cell: (item) => item.user.nombre },
    ];

    const getInputClasses = (fieldName: keyof FormData | 'productSearch') => `w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-700 border rounded-md focus:outline-none focus:ring-2 ${
        errors[fieldName as keyof FormData] ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'
    }`;
    const labelClasses = "block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1";
    const ErrorMessage: React.FC<{ fieldName: keyof FormData }> = ({ fieldName }) => (
        errors[fieldName] ? <p className="mt-1 text-xs text-red-500">{errors[fieldName]}</p> : null
    );

    return (
        <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-6">Entrada de Inventario</h1>
            
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Registrar Nueva Entrada de Producto</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Columna 1: Producto y Cantidad */}
                            <div className="lg:col-span-2 space-y-4">
                                <div ref={searchRef} className="relative">
                                    <label htmlFor="producto-search" className={labelClasses}>Producto</label>
                                    <input
                                        type="text"
                                        id="producto-search"
                                        value={productSearchTerm}
                                        onChange={handleProductSearchChange}
                                        onFocus={() => setIsProductDropdownOpen(true)}
                                        placeholder="Buscar por nombre o ID..."
                                        className={getInputClasses('selectedProductId')}
                                        autoComplete="off"
                                    />
                                    {isProductDropdownOpen && (
                                        <>
                                            {productSearchTerm.trim().length >= 2 ? (
                                                filteredProducts.length > 0 ? (
                                                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                        {filteredProducts.map(p => (
                                                            <li
                                                                key={p.id}
                                                                onMouseDown={() => handleProductSelect(p)}
                                                                className="px-4 py-2 text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-500 hover:text-white cursor-pointer"
                                                            >
                                                                {p.nombre} <span className="text-xs text-slate-500 dark:text-slate-400">(ID: {p.id})</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg">
                                                        <li className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                                                            No se encontraron productos con "{productSearchTerm}"
                                                        </li>
                                                    </ul>
                                                )
                                            ) : (
                                                <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg">
                                                    <li className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400">
                                                        Ingrese al menos 2 caracteres
                                                    </li>
                                                </ul>
                                            )}
                                        </>
                                    )}
                                    <ErrorMessage fieldName="selectedProductId" />
                                </div>
                                {selectedProduct && (
                                    <div className="grid grid-cols-3 gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Referencia</p>
                                            <p className="font-semibold">{selectedProduct.referencia || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Stock Actual</p>
                                            <p className="font-semibold">{selectedProduct.controlaExistencia ?? 0} {selectedProduct.unidadMedida}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">Precio Venta</p>
                                            <p className="font-semibold">
                                                {formatCurrency(
                                                    Number(
                                                        (selectedProduct as any).precio ??
                                                        (selectedProduct as any).precioPublico ??
                                                        (selectedProduct as any).precioMayorista ??
                                                        (selectedProduct as any).precioMinorista ??
                                                        (selectedProduct as any).ultimoCosto ??
                                                        0
                                                    )
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="quantity" className={labelClasses}>Cantidad a Ingresar</label>
                                    <input type="text" pattern="[0-9]*" inputMode="numeric" id="quantity" name="quantity" value={formData.quantity} onChange={handleFormInputChange} className={getInputClasses('quantity')} />
                                    <ErrorMessage fieldName="quantity" />
                                </div>
                            </div>

                            {/* Columna 2: Costos y Referencia */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="costoUnitario" className={labelClasses}>Costo por Unidad</label>
                                    <input type="text" pattern="[0-9]*" inputMode="numeric" id="costoUnitario" name="costoUnitario" value={formData.costoUnitario} onChange={handleFormInputChange} className={getInputClasses('costoUnitario')} placeholder="0"/>
                                    <ErrorMessage fieldName="costoUnitario" />
                                </div>
                                <div>
                                    <label htmlFor="documentoReferencia" className={labelClasses}>Documento de Referencia</label>
                                    <input type="text" id="documentoReferencia" name="documentoReferencia" value={formData.documentoReferencia} onChange={handleFormInputChange} className={getInputClasses('documentoReferencia')} placeholder="Ej: Factura Compra FC-123" />
                                </div>
                            </div>
                        </div>

                        {/* Motivo y Botón */}
                        <div>
                            <label htmlFor="reason" className={labelClasses}>Motivo de la Entrada</label>
                            <textarea id="reason" name="reason" value={formData.reason} onChange={handleFormInputChange} rows={3} placeholder="Ej: Recepción de pedido a proveedor, ajuste por conteo físico, devolución de cliente." className={getInputClasses('reason')}></textarea>
                            <ErrorMessage fieldName="reason" />
                        </div>
                        <div className="text-right pt-4 border-t border-slate-200 dark:border-slate-700">
                            <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400">
                                {isSubmitting ? <><i className="fas fa-spinner fa-spin mr-2"></i>Registrando...</> : <><i className="fas fa-save mr-2"></i>Registrar Entrada</>}
                            </button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Entradas Recientes</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table columns={columns} data={paginatedData} onSort={requestSort} sortConfig={sortConfig} />
                </CardContent>
            </Card>
        </div>
    );
};

export default EntradaInventarioPage;
