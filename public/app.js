let currentTargetPhone = '';

// --- NAVEGACIÓN Y PESTAÑAS ---
function showTab(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(`tab-${tabId}`).style.display = 'block';
    
    document.querySelectorAll('.menu a').forEach(a => a.classList.remove('active'));
    element.classList.add('active');

    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');
    if (tabId === 'contactos') {
        title.innerText = 'Gestión de Clientes';
        subtitle.innerText = 'Monitorea la ventana de 24 hrs y envía publicidad.';
    } else if (tabId === 'chat') {
        title.innerText = 'Chat en Vivo';
        subtitle.innerText = 'Supervisa las conversaciones entre clientes y la IA.';
    } else if (tabId === 'configuracion') {
        title.innerText = 'Configuración del CRM';
        subtitle.innerText = 'Ajustes de Inteligencia Artificial y API.';
    }
}

// --- ESTADO Y CONFIGURACIÓN ---
async function checkApiStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        // Actualizar Configuración
        const metaApiStatus = document.getElementById('metaApiStatus');
        const metaApiStatusText = document.getElementById('metaApiStatusText');
        if (metaApiStatus) metaApiStatus.className = data.details.token && data.details.phoneId ? 'api-status connected' : 'api-status disconnected';
        if (metaApiStatusText) metaApiStatusText.innerText = data.details.token && data.details.phoneId ? 'Conectada 🟢' : 'Desconectada 🔴';
        
        const geminiApiStatus = document.getElementById('geminiApiStatus');
        const geminiApiStatusText = document.getElementById('geminiApiStatusText');
        if (geminiApiStatus) geminiApiStatus.className = data.details.gemini ? 'api-status connected' : 'api-status disconnected';
        if (geminiApiStatusText) geminiApiStatusText.innerText = data.details.gemini ? 'Conectada 🟢' : 'Falta API Key 🔴';

        // Actualizar Estado del Webhook Visual
        const webhookDiv = document.getElementById('webhookPublicStatus');
        const webhookText = document.getElementById('webhookPublicStatusText');
        const webhookInput = document.getElementById('webhookUrlInput');

        if (webhookInput) {
            if (data.details.webhookUrl) {
                webhookInput.value = data.details.webhookUrl;
            } else {
                webhookInput.value = 'Generando túnel con Pinggy...';
            }
        }

        if (webhookDiv && webhookText) {
            if (data.details.isPubliclyAccessible) {
                webhookDiv.className = 'api-status connected';
                webhookText.innerText = 'Visible en Internet 🟢';
            } else {
                webhookDiv.className = 'api-status disconnected';
                webhookText.innerText = 'No Visible 🔴 (Comprobando...)';
            }
        }

        const aiPrompt = document.getElementById('aiPrompt');
        if (aiPrompt && data.currentPrompt) {
            aiPrompt.value = data.currentPrompt;
        }
    } catch (e) {
        const metaApiStatus = document.getElementById('metaApiStatus');
        const metaApiStatusText = document.getElementById('metaApiStatusText');
        if (metaApiStatus) metaApiStatus.className = 'api-status disconnected';
        if (metaApiStatusText) metaApiStatusText.innerText = 'Error 🔴';
        
        const geminiApiStatus = document.getElementById('geminiApiStatus');
        const geminiApiStatusText = document.getElementById('geminiApiStatusText');
        if (geminiApiStatus) geminiApiStatus.className = 'api-status disconnected';
        if (geminiApiStatusText) geminiApiStatusText.innerText = 'Error 🔴';
    }
}

async function saveAiConfig() {
    const prompt = document.getElementById('aiPrompt').value.trim();
    if (!prompt) return alert('Escribe una instrucción');
    
    try {
        const res = await fetch('/api/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ ¡Personalidad de Gemini actualizada instantáneamente!');
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('Error guardando configuración');
    }
}

async function refreshContacts() {
    const tbody = document.getElementById('contactsBody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Cargando...</td></tr>';
    
    try {
        const res = await fetch('/api/contacts');
        const contacts = await res.json();
        
        tbody.innerHTML = '';
        
        if (contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No hay contactos registrados aún. ¡Envía un mensaje al bot!</td></tr>';
            return;
        }

        contacts.forEach(c => {
            const statusClass = c.isWithin24h ? 'status-open' : 'status-closed';
            const statusText = c.isWithin24h ? `Abierta (${c.timeRemainingStr})` : 'Cerrada (Solo Plantillas)';
            const isDisabled = c.isWithin24h ? '' : 'disabled title="La ventana de 24h cerró. Contacto inalcanzable."';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${c.name || 'Desconocido'}</strong></td>
                <td>${c.phone}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        <div class="status-dot"></div>
                        ${statusText}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary btn-small" onclick="loadChat('${c.phone}')">💬 Ver Chat</button>
                    <button class="btn btn-primary btn-small" onclick="openModal('${c.phone}')" ${isDisabled}>🚀 Enviar Plantilla</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--danger);">Error cargando contactos. Asegúrate de que el servidor esté corriendo.</td></tr>';
    }
}

function openModal(phone) {
    currentTargetPhone = phone;
    document.getElementById('modalPhoneTarget').innerText = phone;
    document.getElementById('templateModal').classList.add('active');
}

function closePromoModal() {
    document.getElementById('promoModal').classList.remove('active');
}

// --- HISTORIAL DE CHAT ---
let currentChatPhone = null;

async function loadChat(phone = currentChatPhone) {
    if (!phone) return;
    currentChatPhone = phone;
    
    // Switch tab to chat
    const chatLink = Array.from(document.querySelectorAll('.menu a')).find(a => a.innerText.includes('Chat'));
    if(chatLink) showTab('chat', chatLink);
    
    document.getElementById('chatPhoneTitle').innerText = phone;
    const box = document.getElementById('chatMessagesBox');
    box.innerHTML = 'Cargando mensajes...';
    
    try {
        const res = await fetch(`/api/messages/${phone}`);
        const messages = await res.json();
        
        if (messages.length === 0) {
            box.innerHTML = '<div style="text-align: center; color: var(--text-secondary); margin-top: 2rem;">No hay mensajes registrados para este número.</div>';
            return;
        }
        
        box.innerHTML = '';
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-bubble ${msg.sender === 'bot' ? 'msg-bot' : 'msg-user'}`;
            // Convert timestamp to time string
            const date = new Date(msg.timestamp);
            const timeStr = date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            div.innerHTML = `<div>${msg.text}</div><div style="font-size: 0.65rem; text-align: right; margin-top: 4px; opacity: 0.7;">${timeStr}</div>`;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    } catch (e) {
        box.innerHTML = 'Error cargando mensajes.';
    }
}

function closeModal() {
    document.getElementById('templateModal').classList.remove('active');
    currentTargetPhone = '';
}

async function sendTemplate() {
    const templateName = document.getElementById('templateName').value.trim();
    if (!templateName) return alert('Ingresa un nombre de plantilla');

    const btn = document.querySelector('.modal-actions .btn-primary');
    btn.innerText = 'Enviando...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/send-template', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: currentTargetPhone, templateName })
        });
        const data = await res.json();

        if (data.success) {
            alert('¡Plantilla enviada exitosamente!');
            closeModal();
        } else {
            alert('Error enviando: ' + JSON.stringify(data.error));
        }
    } catch (error) {
        alert('Error de conexión');
    } finally {
        btn.innerText = 'Enviar Ahora';
        btn.disabled = false;
    }
}

// --- LÓGICA DEL PANEL DE PRUEBAS ---
let testLoopInterval = null;
let testCount = 0;

async function sendFreeMessage(to, text) {
    try {
        const res = await fetch('/api/send-free-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, text })
        });
        const data = await res.json();
        return data.success;
    } catch (e) {
        return false;
    }
}

async function sendTestMessageOnce() {
    const phone = document.getElementById('testPhone').value.trim();
    const text = document.getElementById('testMessage').value.trim();
    const status = document.getElementById('testStatus');
    
    if (!phone) return alert('Ingresa un número de destino');
    
    status.innerText = 'Enviando...';
    const success = await sendFreeMessage(phone, text);
    
    if (success) {
        status.innerText = '✅ Mensaje enviado exitosamente';
    } else {
        status.innerText = '❌ Error al enviar mensaje. Revisa que tu .env tenga los tokens correctos y el número esté verificado.';
    }
}

function startTestLoop(seconds) {
    const phone = document.getElementById('testPhone').value.trim();
    const text = document.getElementById('testMessage').value.trim();
    const status = document.getElementById('testStatus');
    
    if (!phone) return alert('Ingresa un número de destino para iniciar el bucle');
    
    // Si ya hay uno, detenerlo
    stopTestLoop();
    
    testCount = 0;
    document.getElementById('stopLoopBtn').disabled = false;
    
    status.innerText = `⏳ Iniciando bucle cada ${seconds} segundos...`;
    
    // Función ejecutora
    const execute = async () => {
        testCount++;
        status.innerText = `🔄 Enviando mensaje #${testCount}...`;
        const success = await sendFreeMessage(phone, `${text} [Envío #${testCount}]`);
        if (success) {
            status.innerText = `✅ Mensaje #${testCount} enviado. Esperando ${seconds}s...`;
        } else {
            status.innerText = `❌ Error en el envío #${testCount}. Deteniendo bucle. Revisa la consola o tus tokens.`;
            stopTestLoop();
        }
    };
    
    // Ejecutar inmediato la primera vez
    execute();
    
    // Iniciar intervalo
    testLoopInterval = setInterval(execute, seconds * 1000);
}

function stopTestLoop() {
    if (testLoopInterval) {
        clearInterval(testLoopInterval);
        testLoopInterval = null;
    }
    document.getElementById('stopLoopBtn').disabled = true;
    document.getElementById('testStatus').innerText = '⏹️ Bucle detenido.';
}

// Cargar datos al inicio
checkApiStatus();
refreshContacts();
