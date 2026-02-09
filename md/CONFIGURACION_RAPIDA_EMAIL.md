# Configuración Rápida de Email

Para habilitar el envío de cotizaciones por correo, sigue estos pasos:

## 1. Configurar variables de entorno
Edita tu archivo `app/back/.env` y agrega:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@gmail.com
SMTP_PASS=tu_clave_de_aplicacion
SMTP_FROM_NAME="Nombre de tu Empresa"
```

> **Nota:** Si usas Gmail, debes generar una **"Contraseña de Aplicación"** en tu cuenta de Google.

## 2. Reiniciar el servidor
Detén y vuelve a iniciar el servidor de backend:
```bash
cd app/back
npm run dev
```

## 3. Probar el envío
1. Ve a la sección de **Cotizaciones**.
2. Haz clic en el botón de **Adobe PDF** (Vista Previa) de cualquier cotización.
3. En el modal de previsualización, haz clic en el botón de **Enviar** (Ícono de avión de papel).
4. El sistema generará el PDF profesional con el logo y lo enviará al correo del cliente.
