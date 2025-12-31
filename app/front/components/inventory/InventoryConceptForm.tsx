import React, { useState, useEffect } from 'react';

interface ConceptoFormProps {
    initialData?: any;
    existingConcepts?: any[];
    onClose: () => void;
    onSave: (data: any) => void;
}

const InventoryConceptForm: React.FC<ConceptoFormProps> = ({ initialData, existingConcepts = [], onClose, onSave }) => {
    console.log('Rendering InventoryConceptForm', { initialData });

    const [formData, setFormData] = useState({
        codcon: '',
        nomcon: '',
        tipcon: 'E',
        codcue: '',
        contable: true,
        inicializa_inventario: false
    });

    const [errors, setErrors] = useState<{ codcon?: string; nomcon?: string; general?: string }>({});

    useEffect(() => {
        if (initialData) {
            setFormData({
                codcon: initialData.codcon,
                nomcon: initialData.nomcon,
                tipcon: initialData.tipcon,
                codcue: String(initialData.codcue || '').trim(),
                contable: !!initialData.contable,
                inicializa_inventario: !!initialData.inicializa_inventario
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;

        // Auto-format Code: Uppercase and No Spaces
        if (name === 'codcon') {
            value = value.toUpperCase().replace(/\s/g, '');
            if (value.length > 2) {
                // Prevent longer than 2 chars programmatically if manual change tries to bypass maxLength
                value = value.substring(0, 2);
                // Optionally show a toast/alert here if strictly requested, but truncation is cleaner.
                // alert("El código no puede tener más de 2 caracteres."); 
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear specific error on change
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const newErrors: { codcon?: string; nomcon?: string } = {};

        // Client-side Unique Validation
        // Check for duplicate Code (exclude current if editing)
        const duplicateCode = existingConcepts.some(c =>
            c.codcon.trim() === formData.codcon.trim() &&
            (!initialData || c.codcon !== initialData.codcon)
        );

        if (duplicateCode) {
            newErrors.codcon = `El código "${formData.codcon}" ya existe.`;
        }

        // Check for duplicate Name (exclude current if editing)
        const duplicateName = existingConcepts.some(c =>
            c.nomcon.trim().toLowerCase() === formData.nomcon.trim().toLowerCase() &&
            (!initialData || c.codcon !== initialData.codcon)
        );

        if (duplicateName) {
            newErrors.nomcon = `El nombre ya está en uso.`;
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSave(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-slate-900/60 backdrop-blur-sm p-4 transition-all" role="dialog" aria-modal="true" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-lg p-6 relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div>
                    <div className="flex items-center justify-center w-12 h-12 mx-auto bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                        <i className="fas fa-clipboard-list text-indigo-600 dark:text-indigo-400 text-xl"></i>
                    </div>
                    <div className="mt-3 text-center sm:mt-5">
                        <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                            {initialData ? 'Editar Concepto' : 'Nuevo Concepto'}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500 dark:text-slate-400">
                                Complete la información del concepto de inventario.
                            </p>
                        </div>
                    </div>
                </div>

                {errors.general && (
                    <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4">
                        <p className="text-sm text-red-700">{errors.general}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-5 sm:mt-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Código</label>
                            <input
                                type="text"
                                name="codcon"
                                value={formData.codcon}
                                onChange={handleChange}
                                maxLength={2}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm py-2 px-3 dark:bg-slate-700 dark:text-white ${errors.codcon
                                    ? 'border-red-300 text-red-900 focus:outline-none focus:ring-red-500 focus:border-red-500'
                                    : 'border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500'
                                    }`}
                                placeholder="Ej. 01"
                                required
                            />
                            {errors.codcon && <p className="mt-1 text-sm text-red-600">{errors.codcon}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Tipo Movimiento</label>
                            <select
                                name="tipcon"
                                value={formData.tipcon}
                                onChange={handleChange}
                                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 px-3 dark:bg-slate-700 dark:text-white"
                            >
                                <option value="E">Entrada</option>
                                <option value="S">Salida</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Descripción (Nombre)</label>
                        <input
                            type="text"
                            name="nomcon"
                            value={formData.nomcon}
                            onChange={handleChange}
                            maxLength={70}
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm py-2 px-3 dark:bg-slate-700 dark:text-white ${errors.nomcon
                                ? 'border-red-300 text-red-900 focus:outline-none focus:ring-red-500 focus:border-red-500'
                                : 'border-gray-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500'
                                }`}
                            placeholder="Nombre del concepto"
                            required
                        />
                        {errors.nomcon && <p className="mt-1 text-sm text-red-600">{errors.nomcon}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Cuenta Contable</label>
                        <input
                            type="text"
                            name="codcue"
                            value={formData.codcue}
                            onChange={handleChange}
                            maxLength={8}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 px-3 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej. 14350101"
                        />
                    </div>

                    <div className="flex items-center gap-6 mt-4">
                        <div className="flex items-center">
                            <input
                                id="contable"
                                name="contable"
                                type="checkbox"
                                checked={formData.contable}
                                onChange={handleChange}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor="contable" className="ml-2 block text-sm text-gray-900 dark:text-slate-300">
                                Genera Contabilidad
                            </label>
                        </div>
                        <div className="flex items-center">
                            <input
                                id="inicializa"
                                name="inicializa_inventario"
                                type="checkbox"
                                checked={formData.inicializa_inventario}
                                onChange={handleChange}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor="inicializa" className="ml-2 block text-sm text-gray-900 dark:text-slate-300">
                                Inicializa Inventario
                            </label>
                        </div>
                    </div>

                    <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                        <button
                            type="submit"
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                        >
                            Guardar
                        </button>
                        <button
                            type="button"
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-transparent text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
                            onClick={onClose}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default InventoryConceptForm;
// End of component
