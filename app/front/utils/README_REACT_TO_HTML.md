# 🚀 Convertir Componente React a HTML - Guía Rápida

## 📦 Archivos Creados

1. **`reactToHtml.ts`** - Función principal para convertir React a HTML
2. **`ejemplo-uso-reactToHtml.tsx`** - Ejemplos de uso
3. **`ejemplo-cotizacion-modal-actualizado.tsx`** - Ejemplo de componente actualizado
4. **`GUIA_REACT_TO_HTML.md`** - Guía completa y detallada

## ⚡ Uso Rápido

### 1. Generar PDF Directamente

```typescript
import { generarPDFDesdeReact } from '../../utils/reactToHtml';
import CotizacionPDF from './CotizacionPDF';

// En tu función
await generarPDFDesdeReact(
    <CotizacionPDF
        cotizacion={cotizacion}
        cliente={cliente}
        vendedor={vendedor}
        empresa={empresa}
        preferences={preferences}
    />,
    'cotizacion.pdf'
);
```

### 2. Obtener Solo el HTML

```typescript
import { reactToHtml } from '../../utils/reactToHtml';

const html = reactToHtml(
    <CotizacionPDF {...props} />
);

console.log(html); // HTML completo
```

### 3. Obtener Body para API

```typescript
import { reactToHtml } from '../../utils/reactToHtml';

const html = reactToHtml(<CotizacionPDF {...props} />);
const body = {
    html: html,
    fileName: 'cotizacion.pdf'
};

// Enviar a API
fetch('/api/generar-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});
```

## 🔄 Actualizar CotizacionPreviewModal

Reemplaza el `handleDownload` actual con:

```typescript
import { generarPDFDesdeReact } from '../../utils/reactToHtml';

const handleDownload = async () => {
    if (!cotizacion || !cliente || !vendedor) return;

    try {
        const safeClientName = cliente.nombreCompleto.replace(/[^a-zA-Z0-9]/g, '_');
        
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
        console.error('Error:', error);
        addNotification({ 
            message: 'Error generando PDF', 
            type: 'error' 
        });
    }
};
```

**Ventaja**: Ya no necesitas el `componentRef` ni renderizar el componente antes de generar el PDF.

## 📋 Comparación

| Característica | Método Actual | Método Nuevo |
|----------------|---------------|--------------|
| Requiere ref | ✅ Sí | ❌ No |
| Requiere renderizado | ✅ Sí | ❌ No |
| Eficiencia | Normal | Mejor |
| Simplicidad | Media | Alta |

## 🎯 Cuándo Usar Cada Uno

- **Método Actual**: Cuando ya tienes el componente renderizado (preview)
- **Método Nuevo**: Cuando quieres generar PDFs sin renderizar primero

## 📚 Documentación Completa

Ver `GUIA_REACT_TO_HTML.md` para:
- Opciones avanzadas
- Personalización de estilos
- Limitaciones
- Mejores prácticas
- Ejemplos completos

## ✅ Listo para Usar

No se requieren dependencias adicionales. `react-dom` ya está instalado.

