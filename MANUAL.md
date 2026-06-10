# Manual de Usuario: WhatsApp CRM & Gemini AI

Este documento explica cómo ejecutar este proyecto en cualquier computadora, cómo funciona nuestro sistema de túneles hacia Internet, y nuestro plan de migración para evitar el cambio constante de enlaces.

---

## 1. Requisitos para ejecutar en otra PC
Si descargas o sincronizas este código en otra computadora, necesitas instalar lo siguiente para que funcione:

1. **Instalar Node.js:** Debes descargar e instalar Node.js (versión 18 o superior) desde [nodejs.org](https://nodejs.org).
2. **Instalar Dependencias:** Abre una terminal (CMD o PowerShell) en la carpeta del proyecto y ejecuta:
   ```bash
   npm install
   ```
   Esto descargará automáticamente todas las librerías necesarias (`express`, `sqlite3`, `@google/generative-ai`, etc.).
3. **Archivo `.env`:** El archivo `.env` con tus tokens de seguridad (Meta API, Gemini API) no se sube a GitHub por motivos de seguridad. Deberás crear un archivo `.env` en la nueva PC con la siguiente estructura:
   ```text
   PORT=3000
   GRAPH_API_TOKEN=tu_token_de_meta
   PHONE_NUMBER_ID=tu_numero_id
   WEBHOOK_VERIFY_TOKEN=mi_token_secreto_123
   GEMINI_API_KEY=tu_token_de_gemini
   ```
4. **Ejecutar el Servidor:** 
   ```bash
   npm start
   ```

---

## 2. ¿Cómo funciona el generador de Enlaces Públicos (El Túnel)?
Te habrás dado cuenta de que cada vez que prendes el servidor se genera una URL mágica (tipo `https://palabras-random.trycloudflare.com`). 

**¿Qué es y cómo lo instalé?**
Utilizamos una tecnología llamada **Cloudflare Tunnels (Quick Tunnels)**. Para que funcionara sin errores ni ventanas de advertencia (algo que Meta detesta), descargué silenciosamente un archivo ejecutable oficial llamado `cloudflared.exe`. 

**¿Cómo funciona nuestro código?**
Dentro del archivo `server.js`, utilizo un módulo nativo de Node.js llamado `child_process.spawn`. Lo que hace es abrir el `cloudflared.exe` por detrás (sin que tú veas la consola negra) y le dice: *"Toma todo el tráfico de Internet y envíalo al puerto 3000 de esta computadora local"*. Luego, nuestro código lee lo que Cloudflare responde y extrae la URL generada para mostrarla en tu panel del CRM.

**¿Sirve para Minecraft u otros juegos?**
¡Sí! Cloudflared no solo sirve para páginas web (HTTP). Permite hacer túneles TCP y UDP. Si abres una terminal en tu computadora que tiene el servidor de Minecraft y tienes el `cloudflared.exe`, puedes correr este comando:
```bash
cloudflared.exe tcp --url tcp://localhost:25565
```
Esto te dará una conexión segura y pública para que tus amigos se conecten a tu servidor sin que tengas que abrir puertos en tu router (port forwarding) o usar Hamachi o Radmin VPN. (Nota: Para jugar, tus amigos también tendrían que usar un comando de cloudflared como cliente, o puedes comprar un dominio barato en Cloudflare y enlazarlo directamente).

---

## 3. Plan de Migración a la Nube (Vercel + Supabase)

El problema de usar túneles (Cloudflare, Ngrok, Localtunnel) en un servidor local (tu PC) es que **la URL cambia cada vez que apagas y prendes el servidor**. Meta requiere que la URL sea fija, por lo que estar cambiando el Webhook diario es tedioso.

Para tener el sistema 24/7 con un **enlace permanente que nunca cambie**, debemos migrar el proyecto a la nube.

### Fase 1: Migración de Base de Datos (Supabase)
Actualmente usamos `SQLite`, que guarda los chats en un archivo local `database.sqlite` en tu PC. Vercel no permite bases de datos en archivos locales porque sus servidores se reinician constantemente (serverless).
1. Crearemos una cuenta gratuita en **Supabase** (que es como un servidor de base de datos en la nube).
2. Crearemos las tablas `contacts` y `messages` ahí.
3. Cambiaremos las llamadas en `server.js` para que en vez de usar `sqlite3` hablen con la API de Supabase vía Internet.

### Fase 2: Separar y Subir el Frontend (Vercel)
1. Subiremos la carpeta `public/` (nuestro HTML, CSS y JS del CRM) directamente a Vercel. 
2. Vercel nos dará un dominio web gratuito y permanente (ej: `whatsapp-crm-keroquion.vercel.app`).
3. El frontend ya no correrá en tu `localhost`, sino que vivirá en Internet.

### Fase 3: Subir el Backend/Webhook (Vercel Serverless Functions)
1. Convertiremos los endpoints de `server.js` (como `/webhook`, `/api/contacts`, `/api/messages`) en Funciones Serverless de Vercel (Vercel Functions).
2. Configuraremos las Variables de Entorno (`.env`) directamente en el panel de Vercel.
3. Una vez subido, Vercel nos dará la URL final: `https://whatsapp-crm-keroquion.vercel.app/api/webhook`.
4. Pondremos esa URL fija en Meta Developers. **¡Y listo! Nunca más tendrás que cambiarla ni dejar tu PC encendida.**
