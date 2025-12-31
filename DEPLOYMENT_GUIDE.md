# Guía de Despliegue en Vercel - ERP360

Este proyecto ya está configurado para ser desplegado en **Vercel (Capa Gratuita)** como una aplicación "Monorepo" (Frontend + Backend en el mismo repositorio).

## 1. Requisitos Previos (Crítico)

### Base de Datos
Vercel es una plataforma "Serverless" y **NO puede conectarse a tu SQL Server local (`localhost`)** directamente.
Como indicas que **ya tienes una IP Pública**, solo necesitas asegurarte de:
1.  Usar esa **IP Pública** en la variable `DB_SERVER`.
2.  Tener el puerto **1433** (o el que uses) abierto en tu Router/Firewall para permitir conexiones entrantes.
3.  Permitir que las IPs de Vercel se conecten (o permitir `0.0.0.0/0` temporalmente para probar).

*No necesitas migrar a Azure/AWS si tu servidor ya es accesible desde internet.*

### Configuración Automática de API
El sistema ha sido actualizado para detectar automáticamente el entorno:
- **Local**: Usa `http://localhost:3001/api`
- **Vercel (Producción)**: Usa `/api` (ruta relativa que Vercel redirige internamente).
*Esto soluciona el error "Failed to fetch" y evita problemas de CORS.*

## 2. Pasos para Desplegar

1.  Sube este código a **GitHub**.
2.  Ve a [Vercel](https://vercel.com) y crea un **"New Project"**.
3.  Importa tu repositorio de GitHub.
4.  **Configuración del Proyecto**:
    -   **Framework Preset**: Vite (lo detectará automáticamente).
    -   **Root Directory**: Déjalo en `.` (raíz).
    -   **Build Command**: Vercel usará el comando definido en `vercel.json` automáticamente.
        (`cd app/back && npm install && cd ../front && npm install && npm run build`)
    -   **Output Directory**: `app/front/dist` (definido en `vercel.json`).

5.  **Variables de Entorno (Environment Variables)**:
    Antes de desplegar, configura estas variables en Vercel (Settings > Environment Variables):

    | Variable | Descripción |
    | :--- | :--- |
    | `DB_SERVER` | **Tu IP Pública** (ej. `200.1.2.3` o `midominio.com`) |
    | `DB_DATABASE` | Nombre de la base de datos |
    | `DB_USER` | Usuario SQL |
    | `DB_PASSWORD` | Contraseña SQL |
    | `JWT_SECRET` | Tu clave secreta para tokens |
    | `GEMINI_API_KEY` | Tu API Key de Google IA (Opcional) |

    *Nota: `VITE_API_BASE_URL` es opcional, el código ya usa `/api` por defecto en producción.*

6.  Haz clic en **Deploy**.

## 3. Verificación y Solución de Problemas

### Error: "Failed to fetch"
- Verifica que la variable `DB_SERVER` sea correcta y accesible.
- Asegúrate de que el Firewall de tu base de datos permita el acceso desde Vercel.

### Error: "Login fallido"
- Revisa las credenciales `DB_USER` y `DB_PASSWORD` en Vercel.
- Verifica los logs en Vercel > Functions.
