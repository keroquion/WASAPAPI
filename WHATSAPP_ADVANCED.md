# Guía Avanzada de WhatsApp Cloud API

WhatsApp Business API es mucho más que solo enviar texto. Aquí tienes una investigación completa sobre cómo aprovechar todo el potencial interactivo de la plataforma.

---

## 1. Plantillas de Meta (Message Templates)

Las plantillas son **el único tipo de mensaje que puedes enviar a un cliente cuando han pasado más de 24 horas** desde su último mensaje (la ventana de 24h). Sirven para iniciar conversaciones o enviar notificaciones.

### ¿Cómo se crean?
1. Debes ir a tu [Administrador de WhatsApp](https://business.facebook.com/wa/manage/message-templates/) en Meta Business Suite.
2. Hacer clic en **"Crear Plantilla"**.
3. Elegir la categoría:
   - **Marketing:** Promociones, ofertas, novedades (Son las más costosas).
   - **Utilidad:** Actualizaciones de envío, confirmaciones de compra, recordatorios.
   - **Autenticación:** Códigos OTP de verificación.
4. Diseñas tu mensaje (puedes incluir variables como `{{1}}` para personalizar el nombre, imágenes, y botones).
5. Se envían a revisión (Meta suele aprobarlas en menos de 1 minuto hoy en día).

### ¿Cómo las enviamos por tu Web (CRM)?
En nuestro código actual, tenemos un botón de "Enviar Plantilla". Cuando le das clic, el servidor de Node.js hace una petición `POST` a la API de Graph enviando el nombre de la plantilla.

**Próxima Mejora para el CRM:** Podemos conectar el CRM directamente a un endpoint de Meta (`GET /v19.0/{whatsapp-business-account-id}/message_templates`) para que descargue todas tus plantillas aprobadas automáticamente y te las muestre en un menú desplegable (Select) en tu interfaz.

---

## 2. Mensajes Interactivos (Lo que pocos usan)

En lugar de que el usuario tenga que escribir "1 para ventas, 2 para soporte", WhatsApp permite menús nativos que son mucho más elegantes.

### A. Botones de Respuesta Rápida (Reply Buttons)
Puedes enviar hasta **3 botones** debajo de un mensaje. 
*Ejemplo de uso:* Confirmar una cita.
- ✅ Confirmar
- 🔄 Reprogramar
- ❌ Cancelar

Al presionar el botón, se envía el texto exactamente como si el usuario lo hubiera escrito. Esto es perfecto para que el Bot lo procese sin equivocaciones ortográficas.

### B. Menús de Lista (List Messages)
Si tienes más de 3 opciones, puedes enviar un "Menú de Selección". Aparecerá un botón que dice, por ejemplo, "Ver Opciones". Al tocarlo, se despliega desde abajo una lista nativa (como la de iOS o Android) con hasta **10 opciones agrupadas**.
*Ejemplo de uso:* Catálogo de productos o Menú de Soporte.

### C. Botones de Llamada a la Acción (CTA)
Son botones que en lugar de enviar un mensaje, ejecutan una acción en el teléfono del usuario:
- **Abrir sitio web:** Un botón que los saca de WhatsApp y los lleva a una URL.
- **Llamar por teléfono:** Abre el marcador del celular.
- **Copiar Código:** Útil para cupones de descuento.

---

## 3. La Joya de la Corona: WhatsApp Flows

Mencionaste funciones avanzadas como *checkboxes, calendarios y formularios sin necesidad de un Bot conversacional*. Esto existe y se llama **WhatsApp Flows**.

Es una tecnología relativamente nueva que permite crear **aplicaciones enteras dentro de la misma pantalla de WhatsApp**, sin que el usuario tenga que ir a tu sitio web.

### ¿Qué componentes puedes incluir?
- Cajas de texto (Inputs).
- Menús desplegables (Dropdowns).
- Casillas de verificación (Checkboxes) y Botones de radio.
- Selectores de fecha (Date pickers) perfectos para reservas.
- Pantallas con imágenes y botones de navegación.

### ¿Para qué se usa?
- **Consulta de Órdenes:** Un usuario abre un Flow, escribe su número de orden en un campo de texto nativo, y ve el estado de su pedido de inmediato.
- **Agendamiento de Citas:** Escogen el día en un calendario emergente y seleccionan la hora en un menú.
- **Generación de Leads:** Completan una encuesta o formulario de registro estructurado. Todo esto se envía a tu webhook (nuestro `server.js`) como un único paquete JSON perfectamente ordenado, sin tener que interactuar con el bot.

**IMPORTANTE:** Los WhatsApp Flows requieren un poco más de conocimiento técnico para crearlos. Se diseñan escribiendo código en formato JSON usando el [Flow Builder](https://business.facebook.com/wa/manage/flows/) de Meta, pero la experiencia para el usuario final es inigualable y luce extremadamente profesional.
