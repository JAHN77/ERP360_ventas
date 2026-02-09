# 🚀 Sistema de Enrutado para Microfrontend

## 📋 Resumen

Se ha implementado un sistema de enrutado completo usando **React Router** que permite:

- ✅ **URLs reales** en el navegador (ej: `/clientes`, `/productos/editar/123`)
- ✅ **Compatibilidad con Single-SPA** para funcionar como microfrontend
- ✅ **Funcionamiento standalone** para desarrollo independiente
- ✅ **Lazy loading** de páginas para mejor rendimiento
- ✅ **Navegación programática** y por URL
- ✅ **Parámetros en rutas** (ej: `/clientes/editar/:id`)

---

## 🔧 Instalación

### 1. Instalar dependencias

```bash
cd app/front
npm install react-router-dom@^6.28.0
```

### 2. Estructura creada

```
app/front/
├── config/
│   └── routes.ts              # Configuración de rutas
├── components/
│   └── routing/
│       ├── AppRouter.tsx      # Router principal con todas las rutas
│       └── RouterWrapper.tsx   # Wrapper para Single-SPA/Standalone
└── contexts/
    └── NavigationContext.tsx  # Contexto actualizado con soporte Router
```

---

## 🎯 Cómo Funciona

### Modo Standalone (Desarrollo)

Cuando ejecutas `npm run dev`, la aplicación funciona independientemente:

- Usa `BrowserRouter` de React Router
- Las URLs son: `http://localhost:4203/clientes`
- Puedes compartir URLs directamente
- El botón "Atrás" del navegador funciona

### Modo Single-SPA (Producción)

Cuando se integra en Single-SPA:

- El router se maneja desde el root config
- Las rutas se integran con el sistema de routing principal
- Mantiene compatibilidad con otros microfrontends

---

## 📝 Uso

### Navegación Programática

```typescript
import { useNavigation } from '../hooks/useNavigation';

const MyComponent = () => {
  const { setPage, navigate } = useNavigation();
  
  // Opción 1: Usar setPage (recomendado)
  setPage('clientes');
  setPage('editar_cliente', { id: '123' });
  
  // Opción 2: Usar navigate directamente
  navigate('/clientes');
  navigate('/clientes/editar/123');
};
```

### Navegación desde Links

```tsx
import { Link } from 'react-router-dom';

<Link to="/clientes">Ver Clientes</Link>
<Link to="/clientes/editar/123">Editar Cliente 123</Link>
```

### Obtener Parámetros de Ruta

```typescript
import { useParams } from 'react-router-dom';

const EditPage = () => {
  const { id } = useParams<{ id: string }>();
  // id = "123" si la URL es /clientes/editar/123
};
```

---

## 🗺️ Mapeo de Rutas

| Página | Ruta URL | Parámetros |
|--------|----------|------------|
| Dashboard | `/` | - |
| Clientes | `/clientes` | - |
| Nuevo Cliente | `/clientes/nuevo` | - |
| Editar Cliente | `/clientes/editar/:id` | `id` |
| Productos | `/productos` | - |
| Editar Producto | `/productos/editar/:id` | `id` |
| Cotizaciones | `/cotizaciones` | - |
| Editar Cotización | `/cotizaciones/editar/:id` | `id` |
| ... | ... | ... |

Ver `app/front/config/routes.ts` para el mapeo completo.

---

## 🔄 Migración de Código Existente

### Antes (sin Router)

```typescript
const { setPage } = useNavigation();
setPage('clientes');
```

### Después (con Router)

```typescript
// Funciona igual, pero ahora actualiza la URL
const { setPage } = useNavigation();
setPage('clientes'); // URL cambia a /clientes
```

**¡No necesitas cambiar nada!** El código existente sigue funcionando.

---

## 🎨 Beneficios

1. **URLs Compartibles**: Puedes copiar y compartir URLs específicas
2. **Navegación del Navegador**: Botones Atrás/Adelante funcionan
3. **Bookmarks**: Los usuarios pueden guardar páginas específicas
4. **SEO Friendly**: URLs descriptivas (aunque es una SPA)
5. **Debugging**: Más fácil ver en qué página estás
6. **Lazy Loading**: Páginas se cargan bajo demanda

---

## 🐛 Troubleshooting

### Las rutas no funcionan

1. Verifica que `react-router-dom` esté instalado
2. Asegúrate de que `RouterWrapper` envuelva la app
3. Revisa la consola por errores

### En Single-SPA no funciona

- El root config debe manejar el routing
- Las rutas deben estar bajo el base path correcto
- Verifica `getBasePath()` en `routes.ts`

### URLs no se actualizan

- Verifica que `NavigationProvider` reciba `navigate` y `location`
- Asegúrate de estar dentro de un `RouterWrapper`

---

## 📚 Recursos

- [React Router Docs](https://reactrouter.com/)
- [Single-SPA Routing](https://single-spa.js.org/docs/routing-overview)
- [Lazy Loading en React](https://react.dev/reference/react/lazy)

---

**Última actualización**: $(date)
**Versión**: 1.0

