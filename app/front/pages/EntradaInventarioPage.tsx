
import React, { useState } from 'react';
import { useData } from '../hooks/useData';
import { apiClient } from '../services/apiClient';
import Card from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

const EntradaInventarioPage: React.FC = () => {
    const { productos, refreshData } = useData();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        productoId: '',
        cantidad: '',
        costoUnitario: '',
        documentoRef: '',
        motivo: '',
        codalm: '002' // Default warehouse
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Filter products for autocomplete
    const filteredProducts = productos.filter(p => {
        const nombre = (p.nombre || p.nomins || '').toLowerCase();
        const codigo = (p.codins || '').toLowerCase();
        const term = searchTerm.toLowerCase();
        return nombre.includes(term) || codigo.includes(term);
    }).slice(0, 10); // Limit to 10 suggestions

    const handleProductSelect = (prod: any) => {
        setFormData(prev => ({
            ...prev,
            productoId: prod.id,
            costoUnitario: prod.ultimoCosto || prod.costoPromedio || '0'
        }));
        setSearchTerm(`${prod.codins} - ${prod.nombre}`);
        setShowSuggestions(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        if (!formData.productoId) {
            setError('Por favor seleccione un producto válido');
            setLoading(false);
            return;
        }

        try {
            // Use the correct API method from apiClient class
            const response = await apiClient.registerInventoryEntry(formData);

            if (!response.success) {
                throw new Error(response.message || 'Error al registrar la entrada');
            }

            setSuccess(response.message || 'Entrada registrada correctamente');

            // Reset form but keep warehouse
            setFormData({
                productoId: '',
                cantidad: '',
                costoUnitario: '',
                documentoRef: '',
                motivo: '',
                codalm: formData.codalm
            });
            setSearchTerm('');

            // Refresh products to show new stock using the correct context method
            await refreshData();

        } catch (err: any) {
            console.error('Error registrando entrada:', err);
            setError(err.message || 'Error al registrar la entrada de inventario');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 transition-all duration-500 ease-in-out">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        <i className="fas fa-plus-circle text-indigo-600"></i>
                        Entrada de Inventario
                    </h1>
                    <p className="text-gray-500 mt-1 ml-11">
                        Registre nuevos ingresos de mercancía al almacén
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm flex items-start animate-fade-in-down">
                    <i className="fas fa-exclamation-circle text-red-500 mr-3 mt-1"></i>
                    <div>
                        <h3 className="text-red-800 font-medium">Error</h3>
                        <p className="text-red-700 text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            {success && (
                <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-r shadow-sm flex items-start animate-fade-in-down">
                    <i className="fas fa-check-circle text-green-500 mr-3 mt-1"></i>
                    <div>
                        <h3 className="text-green-800 font-medium">Éxito</h3>
                        <p className="text-green-700 text-sm mt-1">{success}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulario Principal */}
                <div className="lg:col-span-2">
                    <Card className="p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300">
                        <form onSubmit={handleSubmit} className="space-y-6">

                            {/* Selección de Producto */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Producto</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <i className="fas fa-box text-gray-400"></i>
                                    </div>
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setShowSuggestions(true);
                                            setFormData(prev => ({ ...prev, productoId: '' })); // Reset ID if name changes
                                        }}
                                        onFocus={() => setShowSuggestions(true)}
                                        placeholder="Escriba código o nombre del producto..."
                                        className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-3 border"
                                        autoComplete="off"
                                    />
                                </div>

                                {showSuggestions && searchTerm && filteredProducts.length > 0 && (
                                    <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                        {filteredProducts.map((prod) => (
                                            <li
                                                key={prod.id}
                                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50 transition-colors"
                                                onClick={() => handleProductSelect(prod)}
                                            >
                                                <div className="flex items-center">
                                                    <span className="font-semibold text-gray-900 w-24">{prod.codins}</span>
                                                    <span className="text-gray-700 ml-2">{prod.nombre}</span>
                                                    <span className="ml-auto text-gray-500 text-xs mr-2">Stock: {prod.stock}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Cantidad */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Ingresar</label>
                                    <input
                                        type="number"
                                        name="cantidad"
                                        value={formData.cantidad}
                                        onChange={handleChange}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border"
                                        placeholder="0"
                                        min="0.01"
                                        step="0.01"
                                        required
                                    />
                                </div>

                                {/* Costo Unitario */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Costo Unitario ($)</label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <i className="fas fa-dollar-sign text-gray-400"></i>
                                        </div>
                                        <input
                                            type="number"
                                            name="costoUnitario"
                                            value={formData.costoUnitario}
                                            onChange={handleChange}
                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Documento Referencia */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Documento Ref. (Opcional)</label>
                                    <div className="relative rounded-md shadow-sm">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <i className="fas fa-file-alt text-gray-400"></i>
                                        </div>
                                        <input
                                            type="text"
                                            name="documentoRef"
                                            value={formData.documentoRef}
                                            onChange={handleChange}
                                            className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 border"
                                            placeholder="Ej. Factura Compra #123"
                                        />
                                    </div>
                                </div>

                                {/* Bodega */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bodega Destino</label>
                                    <select
                                        name="codalm"
                                        value={formData.codalm}
                                        onChange={handleChange}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border"
                                    >
                                        <option value="002">Portal de Soledad (002)</option>
                                        <option value="001">Bodega Principal (001)</option>
                                        {/* Add more warehouses here if available in context */}
                                    </select>
                                </div>
                            </div>

                            {/* Motivo */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Observaciones</label>
                                <textarea
                                    name="motivo"
                                    rows={3}
                                    value={formData.motivo}
                                    onChange={handleChange}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border"
                                    placeholder="Detalle el motivo del ingreso de inventario..."
                                />
                            </div>

                            {/* Botón Submit */}
                            <div className="flex justify-end pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => navigate('/productos')}
                                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                                        } transition-colors duration-200`}
                                >
                                    {loading ? 'Procesando...' : 'Registrar Entrada'}
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>

                {/* Resumen Lateral */}
                <div className="lg:col-span-1">
                    <Card className="p-6 shadow-md bg-gray-50 border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de Entrada</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Producto</span>
                                <span className="text-sm font-medium text-gray-900 truncate ml-2 max-w-[150px]">
                                    {searchTerm.split('-')[1] || '-'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Cantidad</span>
                                <span className="text-sm font-medium text-gray-900">
                                    {formData.cantidad || '0'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-gray-500">Costo Unit.</span>
                                <span className="text-sm font-medium text-gray-900">
                                    ${parseFloat(formData.costoUnitario || '0').toLocaleString()}
                                </span>
                            </div>
                            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                                <span className="text-base font-bold text-gray-900">Total Valorizado</span>
                                <span className="text-xl font-bold text-indigo-600">
                                    ${(parseFloat(formData.cantidad || '0') * parseFloat(formData.costoUnitario || '0')).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 bg-blue-50 p-3 rounded-md text-xs text-blue-700 border border-blue-100">
                            <p>
                                <strong>Nota:</strong> Esta acción aumentará el stock disponible en la bodega seleccionada y actualizará el costo promedio/último del producto.
                                Se generará un registro en el Kardex.
                            </p>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default EntradaInventarioPage;
