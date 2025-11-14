# Guía: Convertir Componente React a HTML Completo

## 📋 Resumen

Hay dos formas de convertir tu componente React a HTML para generar PDFs:

1. **Método Actual** (Ya implementado): `descargarElementoComoPDF`
   - Renderiza el componente en el DOM
   - Toma el HTML del elemento renderizado
   - ✅ Funciona perfectamente para previews
   - ❌ Requiere que el componente esté renderizado en el DOM

2. **Método Nuevo**: `reactToHtml` / `generarPDFDesdeReact`
   - Convierte React directamente a HTML sin renderizar en el DOM
   - ✅ Más eficiente
   - ✅ No requiere renderizado previo
   - ✅ Útil para generación en segundo plano

## 🚀 Uso Básico

### Opción 1: Generar PDF Directamente (Recomendado)

```typescript
import { generarPDFDesdeReact } from '../../utils/reactToHtml';
import CotizacionPDF from './CotizacionPDF';

// En tu componente
const handleDownload = async () => {
    try {
        await generarPDFDesdeReact(
            <CotizacionPDF
                cotizacion={cotizacion}
                cliente={cliente}
                vendedor={vendedor}
                empresa={empresa}
                preferences={preferences}
            />,
            `Cotizacion-${cotizacion.numeroCotizacion}.pdf`,
            {
                includeTailwind: true,
                title: `Cotización ${cotizacion.numeroCotizacion}`
            }
        );
    } catch (error) {
        console.error('Error:', error);
    }
};
```

### Opción 2: Obtener Solo el HTML

```typescript
import { reactToHtml } from '../../utils/reactToHtml';

const html = reactToHtml(
    <CotizacionPDF {...props} />,
    {
        includeTailwind: true,
        title: 'Mi Documento'
    }
);

// Ahora puedes usar el HTML como quieras
console.log(html); // HTML completo listo para PDF
```

### Opción 3: Obtener Body para API

```typescript
import { reactToHtml } from '../../utils/reactToHtml';

const html = reactToHtml(<CotizacionPDF {...props} />);
const body = {
    html: html,
    fileName: 'cotizacion.pdf'
};

// Enviar manualmente a la API
fetch('http://localhost:3001/api/generar-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});
```

## 📝 Ejemplo Completo: Actualizar CotizacionPreviewModal

Puedes actualizar el `handleDownload` en `CotizacionPreviewModal.tsx`:

```typescript
import { generarPDFDesdeReact } from '../../utils/reactToHtml';

const handleDownload = async () => {
    if (!cotizacion || !cliente || !vendedor) return;

    addNotification({ 
        message: `Generando PDF para ${cotizacion.numeroCotizacion}...`, 
        type: 'info' 
    });

    try {
        const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
        
        // Método nuevo: Directo desde React (sin necesidad de ref)
        await generarPDFDesdeReact(
            <CotizacionPDF
                cotizacion={cotizacion}
                cliente={cliente}
                vendedor={vendedor}
                empresa={datosEmpresa}
                preferences={preferences}
            />,
            `Cotizacion-${cotizacion.numeroCotizacion}-${safeClientName}.pdf`,
            {
                includeTailwind: true,
                title: `Cotización ${cotizacion.numeroCotizacion}`
            }
        );
        
        addNotification({ 
            message: 'PDF generado correctamente.', 
            type: 'success' 
        });
    } catch (error) {
        console.error('Error al generar el PDF:', error);
        addNotification({ 
            message: 'No se pudo generar el archivo. Intenta nuevamente.', 
            type: 'warning' 
        });
    }
};
```

## 🔄 Comparación de Métodos

### Método Actual (descargarElementoComoPDF)
```typescript
// Requiere que el componente esté renderizado
const componentRef = useRef<HTMLDivElement>(null);

return (
    <div ref={componentRef}>
        <CotizacionPDF {...props} />
    </div>
);

// Luego generar PDF
await descargarElementoComoPDF(componentRef.current, {
    fileName: 'cotizacion.pdf'
});
```

### Método Nuevo (generarPDFDesdeReact)
```typescript
// No requiere renderizado previo
await generarPDFDesdeReact(
    <CotizacionPDF {...props} />,
    'cotizacion.pdf'
);
```

## ⚙️ Opciones Avanzadas

### Personalizar Estilos

```typescript
await generarPDFDesdeReact(
    <CotizacionPDF {...props} />,
    'cotizacion.pdf',
    {
        includeTailwind: true,
        title: 'Cotización',
        customStyles: `
            .mi-clase {
                color: red;
            }
            @media print {
                .no-imprimir {
                    display: none;
                }
            }
        `
    }
);
```

### Sin Tailwind (solo CSS personalizado)

```typescript
await generarPDFDesdeReact(
    <CotizacionPDF {...props} />,
    'cotizacion.pdf',
    {
        includeTailwind: false,
        customStyles: `
            body {
                font-family: Arial, sans-serif;
            }
            /* Tus estilos aquí */
        `
    }
);
```

## 🎯 Cuándo Usar Cada Método

### Usa `descargarElementoComoPDF` cuando:
- ✅ Ya tienes el componente renderizado en el DOM (preview)
- ✅ Quieres ver el componente antes de generar el PDF
- ✅ El componente usa hooks que requieren DOM (useRef, etc.)

### Usa `generarPDFDesdeReact` cuando:
- ✅ No necesitas mostrar el preview
- ✅ Quieres generar PDFs en segundo plano
- ✅ El componente es puro (solo props, sin hooks de DOM)
- ✅ Quieres mejor rendimiento

## 📦 Instalación

No se requieren dependencias adicionales. `react-dom` ya está instalado y `ReactDOMServer` viene incluido.

## 🔍 Debugging

### Ver el HTML generado

```typescript
import { reactToHtml } from '../../utils/reactToHtml';

const html = reactToHtml(<CotizacionPDF {...props} />);
console.log(html); // Ver el HTML completo
```

### Probar el HTML manualmente

```typescript
const html = reactToHtml(<CotizacionPDF {...props} />);

// Copiar el HTML y probarlo en un navegador
navigator.clipboard.writeText(html);
console.log('HTML copiado al portapapeles');
```

## ⚠️ Limitaciones

1. **Hooks de React**: Algunos hooks no funcionan con `ReactDOMServer.renderToStaticMarkup`:
   - `useEffect` - No se ejecuta
   - `useState` - Solo valores iniciales
   - `useRef` - No funciona
   - `useContext` - Funciona si el contexto está disponible

2. **Event Handlers**: No se incluyen en el HTML (no son necesarios para PDF)

3. **Imágenes**: Las imágenes deben estar en URLs absolutas o base64

## ✅ Mejores Prácticas

1. **Componentes Puros**: Mantén los componentes de PDF lo más puros posible
2. **Datos Preparados**: Prepara todos los datos antes de renderizar
3. **Estilos Inline o Tailwind**: Usa estilos que funcionen en PDF
4. **Pruebas**: Prueba el HTML generado en un navegador antes de generar PDF

## 📚 Archivos Relacionados

- `utils/reactToHtml.ts` - Función principal
- `utils/ejemplo-uso-reactToHtml.tsx` - Ejemplos de uso
- `components/comercial/CotizacionPDF.tsx` - Componente de ejemplo
- `components/comercial/CotizacionPreviewModal.tsx` - Uso actual

