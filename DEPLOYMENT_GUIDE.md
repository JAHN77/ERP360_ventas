# Guía de Despliegue en Vercel - ERP360

Este proyecto ya está configurado para ser desplegado en **Vercel (Capa Gratuita)** como una aplicación "Monorepo" (Frontend + Backend en el mismo repositorio).

## 1. Requisitos Previos (Crítico)

### Base de Datos en la Nube
Vercel es una plataforma "Serverless" y no puede conectarse a tu SQL Server local (`localhost`) porque no están en la misma red.
**Necesitas migrar tu base de datos a la nube** o exponerla públicamente:
- **Azure SQL Database** (Recomendado para SQL Server)
- **AWS RDS**
- **Hosting VPS** con IP Pública
- **Ngrok** (Solo para pruebas temporales, no producción)

## 2. Pasos para Desplegar

1.  Sube este código a **GitHub**.
2.  Ve a [Vercel](https://vercel.com) y regístrate/inicia sesión.
3.  Haz clic en **"Add New Project"** e importa tu repositorio de GitHub.
4.  **Configuración del Proyecto**:
    -   **Framework Preset**: Vite (lo detectará automáticamente).
    -   **Root Directory**: Déjalo en `.` (raíz).
    -   **Build Command**: Vercel usará el comando definido en `vercel.json`:
        `cd app/back && npm install && cd ../front && npm install && npm run build`
    -   **Output Directory**: `app/front/dist` (definido en `vercel.json`).

5.  **Variables de Entorno (Environment Variables)**:
    Antes de darle a "Deploy", despliega la sección "Environment Variables" y agrega las siguientes claves (copia los valores de tu `.env` local, pero ajusta la BD):

    | Variable | Descripción |
    | :--- | :--- |
    | `DB_SERVER` | **IP o Dominio de tu BD en la Nube** (No usar localhost) |
    | `DB_DATABASE` | Nombre de la base de datos (ej. `ERP360_PRUEBAS`) |
    | `DB_USER` | Usuario SQL |
    | `DB_PASSWORD` | Contraseña SQL |
    | `JWT_SECRET` | Tu clave secreta para tokens (invéntate una larga) |
    | `GOOGLE_CLIENT_ID` | Tu ID de cliente de Google OAuth |
    | `GOOGLE_CLIENT_SECRET` | Tu Secreto de cliente de Google OAuth |
    | `GOOGLE_REFRESH_TOKEN` | Token de refresco largo para Drive |
    | `GOOGLE_REDIRECT_URI` | `https://developers.google.com/oauthplayground` (o tu URL) |
    | `GEMINI_API_KEY` | Tu API Key de Google IA (Si la usas) |
    | `VITE_API_BASE_URL` | `/api` (Esto asegura que el Frontend use el Backend interno de Vercel) |

6.  Haz clic en **Deploy**.

## 3. Verificación

Una vez desplegado:
1.  Visita la URL que te da Vercel (ej. `https://erp360-ventas.vercel.app`).
2.  El Frontend debería cargar (gracias al ajuste en `vite.config.ts`).
3.  Intenta hacer Login. El frontend llamará a `/api/auth/login`.
    -   Vercel redirigirá internamente a `api/server.cjs`.
    -   Si la conexión a la BD es correcta, entrarás al sistema.

## Notas Técnicas Aplicadas
- **Vite Config**: Se modificó para detectar Vercel y generar una build "Standalone" (con React incluido) en lugar de un Microfrontend.
- **Vercel Config**: `vercel.json` configura las redirecciones para que `/api/*` vaya al backend Express y todo lo demás al Frontend React.
- **Serverless**: Se creó `api/server.cjs` como puente para ejecutar Express dentro de las funciones serverless de Vercel.
