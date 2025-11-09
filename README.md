
# ERP360 Comercial

ERP360 Comercial es una plataforma ERP enfocada en el ciclo comercial completo de una empresa: cotizaciones → pedidos → remisiones → facturación → notas de crédito. El proyecto combina un **frontend React + Vite (TypeScript)** con un **backend Express** conectado a **SQL Server** y añade utilidades como generación de PDF con Puppeteer y asistentes con Gemini.

> Esta versión consolida toda la documentación previa en un único README y elimina archivos auxiliares obsoletos. Si necesitas consultar el historial de los documentos antiguos, revísalo en el control de versiones.

---

## 📦 Estructura principal

```
├── app/
│   ├── back/
│   │   ├── package.json            # Dependencias del backend
│   │   ├── server.cjs              # API Express principal
│   │   ├── services/               # mssql helpers y configuración
│   │   └── db/
│   │       └── create_database_ERP360.sql
│   └── front/
│       ├── package.json            # Dependencias del frontend
│       ├── App.tsx                 # Layout / routing
│       ├── components/             # UI modular (auth, comercial, shared, etc.)
│       ├── contexts/               # Auth, Data, Navigation, Notifications, Theme
│       ├── hooks/                  # Hooks personalizados (Tabla, ColumnManager...)
│       ├── pages/                  # Pantallas principales (cotizaciones, pedidos...)
│       ├── services/               # apiClient (fetch), geminiService
│       ├── types.ts                # Modelos TypeScript compartidos
│       └── utils/                  # Helpers (formato, PDF Puppeteer, etc.)
├── .gitignore
└── README.md                      # Este documento
```

---

## ✨ Funcionalidades destacadas
- **Dashboard** con KPIs y atajos del pipeline comercial.
- **Gestión del ciclo comercial completo**: cotizaciones → pedidos → remisiones → facturas → devoluciones.
- **Búsqueda global** con resalte automático y apertura del registro en la vista correspondiente.
- **Generación de PDF** de cotizaciones/vouchers mediante backend Puppeteer (textos seleccionables, estilos idénticos a la preview).
- **Gestión de productos, clientes, categorías** con tablas personalizables, resaltado y modo tarjeta en mobile.
- **Centro de informes** con filtros y exportaciones CSV.
- **Control de acceso por roles** (configurable en `config/rolesConfig.ts`).
- **Integración con Gemini** (sugerencias de texto, borradores).
- **UI responsiva** optimizada: tablas con tarjetas en mobile, sticky headers y posibilidad de resaltar filas desde la búsqueda o notificaciones.

---

## 🧱 Arquitectura

- **Frontend**
  - React 19 + TypeScript
  - Tailwind CSS + utilidades personalizadas
  - Context API para estado global (autenticación, datos, nav, tema)
  - Hooks reutilizables (`useTable`, `useColumnManager`, `useDocumentPreferences`, etc.)
  - Generación de PDF delegada al backend (`utils/pdfClient.ts` → `POST /api/generar-pdf`)

- **Backend**
  - Express 5 con `mssql` como cliente SQL Server
  - Middleware CORS, body-parser ampliado para HTML de PDF
  - Endpoint principal: `/api/generar-pdf` (Puppeteer headless)
  - Servicios compartidos en `app/back/services`

- **Base de datos**
  - SQL Server (script opcional en `app/back/db/create_database_ERP360.sql`)
  - Tablas esperadas: clientes, productos, cotizaciones, pedidos, remisiones, facturas, notas_credito, etc. (ver DataContext para mapping `snake_case` → `camelCase`).

---

## 🚀 Puesta en marcha

### 1. Requisitos
- Node.js LTS 18+
- SQL Server accesible (local o remoto)
- Powershell/Bash para ejecutar scripts (Windows probado)

### 2. Instalar dependencias
```bash
cd app/back
npm install

cd ../front
npm install
```

### 3. Configurar variables de entorno
- **Backend**: copia `app/back/.env.example` → `app/back/.env` y ajusta los valores:

  ```env
  DB_SERVER=localhost
  DB_PORT=1433
  DB_DATABASE=ERP360
  DB_USER=sa
  DB_PASSWORD=Password123!
  PORT=3001            # opcional: puerto API
  DB_ENCRYPT=false     # true si usas Azure SQL u SSL obligatorio
  ```

- **Frontend**: personaliza `app/front/.env.local` (solo variables públicas). Ejemplo:

  ```env
  VITE_API_BASE_URL=http://localhost:3001/api
  ```

### 4. Iniciar servicios
```bash
# API Express (http://localhost:3001)
cd app/back
npm run dev

# Frontend Vite (http://localhost:3000)
cd ../front
npm run dev
```

> Ejecuta cada comando en su propia terminal para mantener ambos procesos activos.

### 5. Build y deploy (frontend)
```bash
cd app/front
npm run build
npm run preview   # opcional: validar el build localmente
```

> **Nota:** Tras el build, `app/front/dist/` se excluye del control de versiones.

---

## 🔌 Scripts npm disponibles
| Carpeta | Script | Descripción |
| --- | --- | --- |
| `app/back` | `npm run dev` | Lanza el servidor Express (API + Puppeteer) |
| `app/back` | `npm run start` | Arranque del backend para entornos productivos |
| `app/front` | `npm run dev` | Levanta Vite en modo desarrollo |
| `app/front` | `npm run build` | Compila el frontend para producción |
| `app/front` | `npm run preview` | Sirve el build generado localmente |

No hay scripts de test automatizados incluidos; ver sección de mejoras.

---

## 🔁 Flujos principales

1. **Cotizaciones**
   - Creación/edición: `pages/NuevaCotizacionPage.tsx`
   - Preview + descarga PDF: `components/comercial/CotizacionPreviewModal.tsx`
   - Aprobación → genera pedido y lanza notificaciones.

2. **Pedidos**
   - Listado con acciones (ver detalles, aprobar, preparar remisión).
   - Integración con remisiones para mostrar número de entregas.

3. **Remisiones**
   - Dos paneles: pedidos listos para despachar y historial.
   - Formularios logísticos (guía, transportadora, etc.).

4. **Facturación**
   - Selección de remisiones entregadas para facturar.
   - Timbrado (simulado) y envío por correo (hooks de notificación).

5. **Búsqueda global / Notificaciones**
   - Usa `NavigationContext` para saltar a la sección correspondiente y resaltar la fila (`highlightRowId`).

---

## 🌐 API útil (resumen)

| Método | Endpoint | Uso |
| --- | --- | --- |
| GET | `/api/health` | Verificar que Express responde |
| GET | `/api/test-connection` | Comprueba conexión SQL |
| GET | `/api/clientes` | Lista de clientes |
| GET | `/api/productos` | Lista de productos |
| GET | `/api/cotizaciones` | Cotizaciones, con filtros opcionales |
| GET | `/api/pedidos` | Pedidos actuales |
| GET | `/api/remisiones` | Remisiones y detalle |
| GET | `/api/facturas` | Historial de facturas |
| POST | `/api/generar-pdf` | Recibe HTML y retorna PDF (Puppeteer) |

> Las respuestas suelen mapear campos `snake_case` a `camelCase`. Revisa `app/front/contexts/DataContext.tsx` para ver el mapeo detallado y los parámetros admitidos.

---

## 🧪 QA y pruebas
- **Automatizadas:** No hay suites configuradas. Para añadirlas:
  - Frontend: Jest + React Testing Library.
  - Backend: Jest/Supertest + base de datos mock o Dockerized SQL.
- **Manual:** Usa Postman o curl (ver ejemplos en la sección de comandos útiles del backend).

---

## 🧰 Mantenimiento
- Limpiar artefactos con `cd app/front && npm run build` seguido de `rm -rf dist/` (si el build no se usará de inmediato).
- Revisar `apiClient.ts` por los `dynamic import` warns de Vite (se pueden convertir en imports explícitos si molestan en producción).
- Mantener actualizados los componentes de UI para conservar la responsividad (especialmente las tablas/`Card` móviles).
- Para nuevos scripts de mantenimiento, agrúpalos en una carpeta `tools/` o documenta su uso en este README para evitar acumulación de archivos sueltos.

---

## 🧯 Troubleshooting
| Problema | Causa probable | Solución |
| --- | --- | --- |
| `ECONNCLOSED` en backend | Datos de conexión inválidos o SQL Server caído | Verifica `.env`, reinicia SQL Server, prueba `npm run backend` nuevamente |
| PDF se descarga en blanco | Revisa logs de `/api/generar-pdf` → CSS con `display:none` en print | Asegúrate de incluir `print-color-adjust` y que el HTML enviado sea completo (usa `utils/pdfClient.ts`) |
| Tablas se desbordan en móvil | Usa `Table` actualizado (modo tarjeta). Si agregas nuevas tablas, reutiliza el componente | Importa desde `components/ui/Table` |
| Búsqueda no abre la fila | Verifica que el componente destino lee `highlightRowId` y limpia `params` al cerrar el modal | Revisar `pages/*Page.tsx` correspondientes |

---

## 📄 Changelog reciente
- Limpieza de scripts/manuales y artefactos de build obsoletos.
- Consolidación de documentación en este README.
- Mejora responsiva de tablas (vista tarjeta en mobile + highlight).
- Mejora de la sección de categorías (estadísticas, filtros, buscador).
- Ajustes de PDF Puppeteer: fondo claro forzado, estilos copiados, manejo de media print.

---

## 🤝 Contribuciones
1. Bifurca el repositorio.
2. Crea una rama (`feat/nueva-funcionalidad`).
3. Commit y push (`npm run frontend:build` solo para validar, no subir `dist/`).
4. Abre un Pull Request con descripción y pasos de prueba manual.

---

## 📬 Contacto
- Equipo interno ERP360
- Issues y mejoras: crear ticket con reproducción + capturas

¡Listo! Con este README la base está documentada en un único lugar y la carpeta `docs/` más los Markdown auxiliares se eliminaron para mantener el repositorio liviano y claro.
