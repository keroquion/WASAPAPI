require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(cors());

// Configuración de Gemini AI
let aiModel = null;
let currentSystemInstruction = "Responde de forma concisa y directa. Si es una prueba, asiste cordialmente.";

function initAI() {
    if (process.env.GEMINI_API_KEY) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        aiModel = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: currentSystemInstruction
        });
    }
}
initAI();

// Servir la carpeta public para el CRM
app.use(express.static(path.join(__dirname, 'public')));

// 1. CONFIGURACIÓN DE BASE DE DATOS (SQLite)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error al conectar a SQLite:', err.message);
    } else {
        console.log('Conectado a SQLite local.');
        // Crear tabla si no existe
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            phone TEXT PRIMARY KEY,
            name TEXT,
            last_message_time INTEGER
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT,
            sender TEXT,
            text TEXT,
            timestamp INTEGER
        )`);
    }
});

function insertMessage(phone, sender, text) {
    db.run('INSERT INTO messages (phone, sender, text, timestamp) VALUES (?, ?, ?, ?)', [phone, sender, text, Date.now()]);
}

// Función auxiliar para actualizar contacto
function updateContact(phone, name, timestamp) {
    db.get('SELECT phone FROM contacts WHERE phone = ?', [phone], (err, row) => {
        if (err) return console.error(err);
        if (row) {
            // Actualizar si existe
            db.run('UPDATE contacts SET last_message_time = ?, name = ? WHERE phone = ?', [timestamp, name, phone]);
        } else {
            // Insertar si es nuevo
            db.run('INSERT INTO contacts (phone, name, last_message_time) VALUES (?, ?, ?)', [phone, name, timestamp]);
        }
    });
}

// 2. WEBHOOK PARA RECIBIR MENSAJES DE WHATSAPP (BOT)

// A. Verificación del Webhook (Requerido por Meta)
app.get('/webhook', (req, res) => {
    const verify_token = process.env.WEBHOOK_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verify_token) {
            console.log('WEBHOOK VERIFICADO');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// B. Recibir mensajes entrantes
app.post('/webhook', async (req, res) => {
    const body = req.body;
    
    if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            const phoneNumber = body.entry[0].changes[0].value.contacts[0].wa_id;
            const contactName = body.entry[0].changes[0].value.contacts[0].profile.name;
            const msg = body.entry[0].changes[0].value.messages[0];
            const timestamp = Date.now(); // Guardamos el momento exacto en milisegundos

            console.log(`Nuevo mensaje de ${contactName} (${phoneNumber}): ${msg.text ? msg.text.body : 'Media/Other'}`);

            // 1. Actualizar la ventana de 24 horas en nuestra base de datos
            updateContact(phoneNumber, contactName, timestamp);

            // Guardar el mensaje entrante en el historial
            const promptText = msg.text ? msg.text.body : '';
            if (promptText) {
                insertMessage(phoneNumber, 'user', promptText);
            } else {
                insertMessage(phoneNumber, 'user', '[Archivo Multimedia]');
            }

            // 2. Lógica del Bot (Responder con Gemini)
            if (aiModel) {
                try {
                    if (promptText) {
                        const result = await aiModel.generateContent(promptText);
                        const aiResponse = result.response.text();
                        await sendReply(phoneNumber, aiResponse);
                        insertMessage(phoneNumber, 'bot', aiResponse);
                    } else {
                        const msgFile = "He recibido un archivo multimedia, pero por ahora solo respondo a texto.";
                        await sendReply(phoneNumber, msgFile);
                        insertMessage(phoneNumber, 'bot', msgFile);
                    }
                } catch (error) {
                    console.error("Error con Gemini:", error);
                    const errorMsg = "Mi sistema de Inteligencia Artificial está fallando.";
                    await sendReply(phoneNumber, errorMsg);
                    insertMessage(phoneNumber, 'bot', errorMsg);
                }
            } else {
                const noAiMsg = `¡Hola ${contactName}! He recibido tu mensaje, pero no tengo configurada mi clave de IA.`;
                await sendReply(phoneNumber, noAiMsg);
                insertMessage(phoneNumber, 'bot', noAiMsg);
            }
        }
        res.sendStatus(200);
    } else {
        res.sendStatus(404);
    }
});

// Función para enviar mensaje de texto libre (Servicio)
async function sendReply(to, text) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${process.env.GRAPH_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            }
        });
        console.log(`Respuesta enviada a ${to}`);
    } catch (error) {
        console.error('Error enviando mensaje libre:', error.response ? error.response.data : error.message);
    }
}

// 3. API PARA EL CRM (FRONTEND)

// Estado de la conexión a Meta API
app.get('/api/status', (req, res) => {
    const isTokenSet = process.env.GRAPH_API_TOKEN && !process.env.GRAPH_API_TOKEN.includes('pon_aqui');
    const isPhoneSet = process.env.PHONE_NUMBER_ID && !process.env.PHONE_NUMBER_ID.includes('pon_aqui');
    
    res.json({
        apiConfigured: isTokenSet && isPhoneSet,
        details: {
            token: isTokenSet,
            phoneId: isPhoneSet,
            gemini: !!aiModel,
            webhookUrl: publicUrl ? `${publicUrl}/webhook` : null,
            isPubliclyAccessible
        },
        currentPrompt: currentSystemInstruction
    });
});

// Configurar personalidad de Gemini AI
app.post('/api/ai-config', (req, res) => {
    const { prompt } = req.body;
    if (prompt) {
        currentSystemInstruction = prompt;
        initAI();
        res.json({ success: true, message: "Personalidad actualizada" });
    } else {
        res.status(400).json({ success: false, error: "Prompt no provisto" });
    }
});

// Obtener contactos y calcular si están en la ventana de 24h
app.get('/api/contacts', (req, res) => {
    db.all('SELECT * FROM contacts', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        const now = Date.now();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        const contactsWithStatus = rows.map(contact => {
            const diff = now - contact.last_message_time;
            const isWithin24h = diff <= TWENTY_FOUR_HOURS;
            return {
                ...contact,
                isWithin24h,
                timeRemainingStr: isWithin24h ? Math.floor((TWENTY_FOUR_HOURS - diff) / (60 * 60 * 1000)) + ' horas restantes' : 'Ventana Cerrada'
            };
        });

        res.json(contactsWithStatus);
    });
});

// Enviar plantilla de marketing (cobra por mensaje, se puede usar aunque pasen 24h)
app.post('/api/send-template', async (req, res) => {
    const { to, templateName } = req.body; // templateName por defecto suele ser 'hello_world' en cuentas nuevas

    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${process.env.GRAPH_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'en_US' } // Cambiar a 'es' si tu plantilla está en español
                }
            }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error enviando plantilla:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: error.response ? error.response.data : error.message });
    }
});

// Obtener historial de mensajes de un contacto
app.get('/api/messages/:phone', (req, res) => {
    const { phone } = req.params;
    db.all('SELECT * FROM messages WHERE phone = ? ORDER BY timestamp ASC', [phone], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Enviar mensaje libre a cualquier número (Para el panel de pruebas)
app.post('/api/send-free-message', async (req, res) => {
    const { to, text } = req.body;

    try {
        const response = await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
            headers: {
                'Authorization': `Bearer ${process.env.GRAPH_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: to,
                type: 'text',
                text: { body: text }
            }
        });
        insertMessage(to, 'bot', text);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error enviando mensaje libre:', error.response ? error.response.data : error.message);
        res.status(500).json({ success: false, error: error.response ? error.response.data : error.message });
    }
});

const PORT = process.env.PORT || 3000;

let publicUrl = '';
let isPubliclyAccessible = false;

function startCloudflaredTunnel(port) {
    console.log('Iniciando túnel seguro Cloudflare...');
    const tunnel = spawn(path.join(__dirname, 'cloudflared.exe'), ['tunnel', '--url', `http://localhost:${port}`]);
    
    const parseOutput = (data) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && match[0] !== publicUrl) {
            publicUrl = match[0];
            console.log('\n======================================================');
            console.log('✅ TUNNEL CLOUDFLARE INICIADO');
            console.log('🔗 WEBHOOK URL: ' + publicUrl + '/webhook');
            console.log('======================================================\n');
        }
    };
    tunnel.stdout.on('data', parseOutput);
    tunnel.stderr.on('data', parseOutput);
    tunnel.on('close', () => {
        console.log('Cloudflare tunnel cerrado. Reiniciando...');
        publicUrl = '';
        isPubliclyAccessible = false;
        setTimeout(() => startCloudflaredTunnel(port), 5000);
    });
}

setInterval(async () => {
    if (publicUrl) {
        try {
            const res = await axios.get(`${publicUrl}/api/status`, { timeout: 5000 });
            if (res.data) {
                isPubliclyAccessible = true;
            }
        } catch (e) {
            isPubliclyAccessible = false;
        }
    }
}, 10000);

app.listen(PORT, () => {
    console.log(`Servidor CRM corriendo en el puerto ${PORT}`);
    startCloudflaredTunnel(PORT);
});
