# 🔓 Cómo Abrir Puertos en macOS

## 📋 Pasos para Permitir Conexiones al Puerto 3001

### Método 1: Configuración del Firewall de macOS (Recomendado)

#### Paso 1: Abrir Preferencias del Sistema
1. Haz clic en el menú **Apple** (🍎) en la esquina superior izquierda
2. Selecciona **Preferencias del Sistema** (o **Configuración del Sistema** en macOS Ventura+)

#### Paso 2: Acceder a Seguridad y Privacidad
1. Busca y haz clic en **Seguridad y Privacidad** (o **Seguridad** en versiones recientes)
2. Si está bloqueado, haz clic en el candado 🔒 en la esquina inferior izquierda
3. Ingresa tu contraseña de administrador

#### Paso 3: Configurar el Firewall
1. Haz clic en la pestaña **Firewall**
2. Si el firewall está **desactivado**, haz clic en **Activar Firewall**
3. Haz clic en **Opciones del Firewall...**

#### Paso 4: Agregar Node.js a las Excepciones
1. Haz clic en el botón **+** (Agregar)
2. Navega hasta la aplicación Node.js:
   - Presiona `Cmd + Shift + G` para ir a una carpeta
   - Ingresa: `/usr/local/bin/node` o `/opt/homebrew/bin/node`
   - O busca Node.js en `/usr/local/bin/` o donde lo tengas instalado
3. Selecciona `node` y haz clic en **Abrir**
4. Asegúrate de que esté marcado como **Permitir conexiones entrantes**
5. Haz clic en **OK**

#### Paso 5: Verificar Configuración
- El firewall debería mostrar Node.js en la lista de aplicaciones permitidas
- Asegúrate de que esté configurado para **Permitir conexiones entrantes**

---

### Método 2: Desactivar el Firewall Temporalmente (No Recomendado)

⚠️ **Solo para pruebas rápidas. No recomendado para uso permanente.**

1. Ve a **Preferencias del Sistema** → **Seguridad y Privacidad** → **Firewall**
2. Haz clic en **Desactivar Firewall**
3. ⚠️ **Recuerda reactivarlo después de las pruebas**

---

### Método 3: Usar Terminal (Avanzado)

Si prefieres usar la línea de comandos:

```bash
# Verificar estado del firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Agregar Node.js a las excepciones
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/local/bin/node

# O si Node.js está instalado con Homebrew
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /opt/homebrew/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /opt/homebrew/bin/node
```

---

## 🔍 Verificar que el Puerto Está Abierto

### Opción 1: Desde Terminal
```bash
# Verificar que el servidor está escuchando
lsof -i :3001

# O usar netstat
netstat -an | grep 3001
```

### Opción 2: Desde Otro Dispositivo
1. Asegúrate de que el servidor esté corriendo
2. Desde otro dispositivo en la misma red, intenta acceder a:
   ```
   http://TU_IP:3001/api/health
   ```
3. Si funciona, el puerto está abierto ✅

---

## 🛠️ Solución de Problemas

### Problema: "No se puede conectar"
**Soluciones:**
1. Verifica que el firewall permita Node.js
2. Asegúrate de que el servidor esté escuchando en `0.0.0.0` (ya configurado)
3. Verifica que ambos dispositivos estén en la misma red Wi‑Fi

### Problema: "Connection refused"
**Soluciones:**
1. Verifica que el servidor esté corriendo: `lsof -i :3001`
2. Revisa que no haya otro proceso usando el puerto 3001
3. Reinicia el servidor

### Problema: Firewall bloquea todo
**Solución:**
1. Ve a **Firewall** → **Opciones**
2. Desmarca **Bloquear todas las conexiones entrantes**
3. Asegúrate de que Node.js esté en la lista de excepciones

---

## 📱 Probar desde Otro Dispositivo

### Desde un Teléfono/Tablet:
1. Conéctate a la misma red Wi‑Fi
2. Abre un navegador
3. Ingresa la URL que aparece en la consola del servidor:
   ```
   http://192.168.1.XXX:3001/api/health
   ```
4. Deberías ver una respuesta JSON

### Desde otra Computadora:
1. Misma red Wi‑Fi
2. Abre un navegador o usa `curl`:
   ```bash
   curl http://TU_IP:3001/api/health
   ```

---

## ✅ Checklist

- [ ] Firewall activado
- [ ] Node.js agregado a excepciones del firewall
- [ ] Node.js configurado para "Permitir conexiones entrantes"
- [ ] Servidor corriendo y mostrando la IP de red
- [ ] Dispositivos en la misma red Wi‑Fi
- [ ] Puerto 3001 accesible desde otro dispositivo

---

## 🔒 Seguridad

**Recomendaciones:**
- ✅ Solo permite Node.js cuando lo necesites
- ✅ No desactives el firewall completamente
- ✅ Usa solo en redes de confianza (no en redes públicas)
- ✅ Considera usar un VPN si necesitas acceso remoto seguro

---

## 📝 Notas Adicionales

- El puerto 3001 es el predeterminado, pero puedes cambiarlo con la variable de entorno `PORT`
- Si usas otro puerto, repite estos pasos para ese puerto
- En macOS, el firewall es por aplicación, no por puerto específico
- Si cambias la ubicación de Node.js, necesitarás actualizar la excepción

