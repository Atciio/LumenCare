// ============================================================
//  CHATBOT — LumenCare
//  Lógica completa: conversaciones, mensajes, CRUD
//  ⚠️  Sección marcada con TODO para conectar Botpress
// ============================================================

let currentUser          = null;
let activeConversationId = null;   // ID de la conversación abierta
let allConversations     = [];     // cache de conversaciones del usuario
let isWaitingBot         = false;  // evitar doble envío mientras el bot responde

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    if (!AuthSystem.requireAuth()) return;

    currentUser = AuthSystem.getUser();
    if (!currentUser) { window.location.href = 'index.html'; return; }

    // El asistente es solo para alumnos
    if (currentUser.tipo_cuenta === 'profesional') {
        window.location.href = 'profesional.html';
        return;
    }

    updateUserUI();
    setupEventListeners();
    loadConversations();
});

function updateUserUI() {
    const n = document.getElementById('userName');
    const a = document.getElementById('userAvatar');
    if (n) n.textContent = currentUser.name.split(' ')[0];
    if (a) a.textContent = currentUser.avatar;
}

// ─── EVENTOS ─────────────────────────────────────────────────────────────────

function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        AuthSystem.logout();
        window.location.href = 'index.html';
    });

    // Nueva conversación
    document.getElementById('btnNewChat')?.addEventListener('click', createNewConversation);

    // Enviar mensaje
    document.getElementById('btnSend')?.addEventListener('click', sendMessage);
    document.getElementById('messageInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize del textarea
    document.getElementById('messageInput')?.addEventListener('input', autoResizeTextarea);

    // Habilitar/deshabilitar botón de enviar
    document.getElementById('messageInput')?.addEventListener('input', () => {
        const val = document.getElementById('messageInput').value.trim();
        document.getElementById('btnSend').disabled = !val || isWaitingBot;
    });

    // Eliminar conversación activa
    document.getElementById('btnDeleteChat')?.addEventListener('click', () => {
        if (activeConversationId) deleteConversation(activeConversationId);
    });

    // Toggle sidebar en móvil
    document.getElementById('btnToggleSidebar')?.addEventListener('click', openSidebar);
    document.getElementById('btnCloseSidebar')?.addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebar);
}

// ─── SIDEBAR MÓVIL ───────────────────────────────────────────────────────────

function openSidebar() {
    document.getElementById('chatSidebar')?.classList.add('sidebar-open');
    document.getElementById('sidebarOverlay')?.classList.remove('hidden');
}

function closeSidebar() {
    document.getElementById('chatSidebar')?.classList.remove('sidebar-open');
    document.getElementById('sidebarOverlay')?.classList.add('hidden');
}

// ─── CONVERSACIONES ───────────────────────────────────────────────────────────

async function loadConversations() {
    try {
        const res  = await fetch('/api/conversaciones', {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (!data.success) return;

        allConversations = data.conversaciones;
        renderConversationList();

    } catch (err) {
        console.error('Error cargando conversaciones:', err);
    }
}

function renderConversationList() {
    const list  = document.getElementById('conversationsList');
    const empty = document.getElementById('sidebarEmpty');
    if (!list) return;

    if (allConversations.length === 0) {
        list.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }
    empty?.classList.add('hidden');

    // Agrupar por fecha
    const groups = groupByDate(allConversations);
    let html = '';

    for (const [label, convs] of Object.entries(groups)) {
        html += `<div class="conv-date-label">${label}</div>`;
        for (const conv of convs) {
            html += createConvItem(conv);
        }
    }

    list.innerHTML = html;
}

function createConvItem(conv) {
    const isActive = conv.id_conversacion === activeConversationId;
    return `
        <div class="conv-item ${isActive ? 'active' : ''}"
             onclick="openConversation(${conv.id_conversacion})"
             data-id="${conv.id_conversacion}">
            <div class="conv-item__icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            </div>
            <div class="conv-item__text">
                <div class="conv-item__title">${Utils.escapeHtml(conv.titulo)}</div>
                <div class="conv-item__date">${formatRelativeDate(conv.fecha_update || conv.fecha_creacion)}</div>
            </div>
            <button class="conv-item__delete"
                    onclick="event.stopPropagation(); deleteConversation(${conv.id_conversacion})"
                    title="Eliminar">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                </svg>
            </button>
        </div>
    `;
}

async function createNewConversation() {
    try {
        const res  = await fetch('/api/conversaciones', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({ titulo: 'Nueva conversación' })
        });
        const data = await res.json();
        if (!data.success) { Utils.showToast('Error creando conversación', 'error'); return; }

        await loadConversations();
        openConversation(data.id_conversacion);
        closeSidebar();

    } catch (err) {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

async function openConversation(id) {
    activeConversationId = id;

    // Actualizar estado activo en la lista
    document.querySelectorAll('.conv-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.id) === id);
    });

    // Mostrar botón eliminar
    document.getElementById('btnDeleteChat')?.classList.remove('hidden');

    // Ocultar pantalla de bienvenida
    document.getElementById('chatWelcome')?.style.setProperty('display', 'none');

    // Cargar título
    const conv = allConversations.find(c => c.id_conversacion === id);
    if (conv) document.getElementById('chatTitle').textContent = conv.titulo;

    // Cargar mensajes
    await loadMessages(id);
    closeSidebar();
}

async function deleteConversation(id) {
    if (!confirm('¿Eliminar esta conversación? No se puede deshacer.')) return;

    try {
        const res  = await fetch(`/api/conversaciones/${id}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();

        if (data.success) {
            Utils.showToast('Conversación eliminada', 'info');

            if (activeConversationId === id) {
                activeConversationId = null;
                showWelcomeScreen();
                document.getElementById('btnDeleteChat')?.classList.add('hidden');
                document.getElementById('chatTitle').textContent = 'Asistente LumenCare';
            }

            await loadConversations();
        }
    } catch (err) {
        Utils.showToast('Error eliminando conversación', 'error');
    }
}

// ─── MENSAJES ─────────────────────────────────────────────────────────────────

async function loadMessages(conversationId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // Limpiar mensajes previos (excepto la bienvenida)
    const welcome = document.getElementById('chatWelcome');
    container.innerHTML = '';
    if (welcome) container.appendChild(welcome);
    welcome?.style.setProperty('display', 'none');

    try {
        const res  = await fetch(`/api/conversaciones/${conversationId}/mensajes`, {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (!data.success) return;

        if (data.mensajes.length === 0) {
            // Conversación vacía — mostrar mensaje inicial del bot
            appendMessage('bot', '¡Hola! 👋 Estoy aquí para escucharte. ¿Cómo te sientes hoy?');
        } else {
            data.mensajes.forEach(m => appendMessage(m.rol, m.contenido, m.fecha_mensaje));
        }

        scrollToBottom();

    } catch (err) {
        console.error('Error cargando mensajes:', err);
    }
}

async function sendMessage() {
    const input   = document.getElementById('messageInput');
    const content = input?.value.trim();

    if (!content || isWaitingBot) return;

    // Si no hay conversación activa, crear una nueva
    if (!activeConversationId) {
        await createNewConversation();
        if (!activeConversationId) return;
    }

    // Mostrar mensaje del usuario
    appendMessage('user', content);
    input.value = '';
    autoResizeTextarea();
    document.getElementById('btnSend').disabled = true;

    // Guardar mensaje del usuario en la BD
    await saveMessage(activeConversationId, 'user', content);

    // Actualizar título de la conversación con el primer mensaje
    const conv = allConversations.find(c => c.id_conversacion === activeConversationId);
    if (conv && conv.titulo === 'Nueva conversación') {
        const newTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
        await updateConversationTitle(activeConversationId, newTitle);
    }

    // Mostrar indicador de escritura
    isWaitingBot = true;
    const typingId = showTypingIndicator();

    try {
        // ── BOTPRESS integrado ──────────────────────────────────────
        const bpResponse = await fetch('/api/chat/botpress', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({
                message:        content,
                conversationId: activeConversationId
            })
        });

        const bpData = await bpResponse.json();
        const botReply = bpData.success
            ? bpData.reply
            : 'Lo siento, el asistente no está disponible en este momento. Intenta de nuevo.';

        removeTypingIndicator(typingId);
        appendMessage('bot', botReply);
        await saveMessage(activeConversationId, 'bot', botReply);

    } catch (err) {
        removeTypingIndicator(typingId);
        appendMessage('bot', 'Lo siento, tuve un problema al responder. ¿Puedes intentarlo de nuevo?');
        console.error('Error del bot:', err);
    }

    isWaitingBot = false;
    scrollToBottom();
    await loadConversations();  // refrescar lista para actualizar fecha
}

async function saveMessage(conversationId, rol, contenido) {
    try {
        await fetch(`/api/conversaciones/${conversationId}/mensajes`, {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({ rol, contenido })
        });
    } catch (err) {
        console.error('Error guardando mensaje:', err);
    }
}

async function updateConversationTitle(id, titulo) {
    try {
        await fetch(`/api/conversaciones/${id}`, {
            method:  'PUT',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({ titulo })
        });
        // Actualizar en el cache local
        const conv = allConversations.find(c => c.id_conversacion === id);
        if (conv) conv.titulo = titulo;
        document.getElementById('chatTitle').textContent = titulo;
        renderConversationList();
    } catch (err) {
        console.error('Error actualizando título:', err);
    }
}

// ─── RENDER DE MENSAJES ────────────────────────────────────────────────────────

function appendMessage(rol, contenido, fecha = null) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const avatar = rol === 'bot'
        ? `<svg width="18" height="18" viewBox="0 0 40 40" fill="none">
               <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="2.5"/>
               <circle cx="20" cy="20" r="12" fill="currentColor" opacity="0.3"/>
               <path d="M20 8 L20 20 L28 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
               <circle cx="20" cy="20" r="3" fill="currentColor"/>
           </svg>`
        : currentUser?.avatar || 'U';

    const time = fecha
        ? new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const msg = document.createElement('div');
    msg.className = `message ${rol}`;
    msg.innerHTML = `
        <div class="message-avatar">${rol === 'bot' ? avatar : (currentUser?.avatar || 'U')}</div>
        <div class="message-content">
            <div class="message-bubble">${Utils.escapeHtml(contenido)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    container.appendChild(msg);
    scrollToBottom();
}

function showTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const id = 'typing-' + Date.now();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'typing-indicator';
    el.innerHTML = `
        <div class="message-avatar" style="background:var(--gradient-primary);color:white;">
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="2.5"/>
                <circle cx="20" cy="20" r="12" fill="currentColor" opacity="0.3"/>
                <path d="M20 8 L20 20 L28 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <circle cx="20" cy="20" r="3" fill="currentColor"/>
            </svg>
        </div>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    container.appendChild(el);
    scrollToBottom();
    return id;
}

function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
}

function showWelcomeScreen() {
    const container = document.getElementById('chatMessages');
    const welcome   = document.getElementById('chatWelcome');
    if (!container || !welcome) return;
    container.innerHTML = '';
    container.appendChild(welcome);
    welcome.style.removeProperty('display');
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) container.scrollTop = container.scrollHeight;
}

// ─── SUGERENCIAS DE BIENVENIDA ────────────────────────────────────────────────

function useSuggestion(btn) {
    const text  = btn.textContent.trim().replace(/^[^\s]+\s/, '');   // quitar emoji
    const input = document.getElementById('messageInput');
    if (input) {
        input.value = text;
        input.focus();
        document.getElementById('btnSend').disabled = false;
        autoResizeTextarea();
    }
}

// ─── AUTO-RESIZE TEXTAREA ─────────────────────────────────────────────────────

function autoResizeTextarea() {
    const ta = document.getElementById('messageInput');
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function groupByDate(conversations) {
    const groups = {};
    const now    = new Date();

    for (const conv of conversations) {
        const d    = new Date(conv.fecha_update || conv.fecha_creacion);
        const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));

        let label;
        if (diff === 0)       label = 'Hoy';
        else if (diff === 1)  label = 'Ayer';
        else if (diff < 7)    label = 'Esta semana';
        else if (diff < 30)   label = 'Este mes';
        else                  label = 'Anteriores';

        if (!groups[label]) groups[label] = [];
        groups[label].push(conv);
    }

    return groups;
}

function formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    const d    = new Date(dateStr);
    const now  = new Date();
    const diff = Math.floor((now - d) / (1000 * 60));

    if (diff < 1)    return 'Ahora';
    if (diff < 60)   return `Hace ${diff} min`;
    if (diff < 1440) return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// ─── RESPUESTA TEMPORAL (reemplazar con Botpress) ────────────────────────────

async function getBotReplyTemp(userMessage) {
    // Simula un pequeño delay de respuesta
    await new Promise(r => setTimeout(r, 1200));

    const msg = userMessage.toLowerCase();

    if (msg.includes('estrés') || msg.includes('estres') || msg.includes('stress'))
        return 'El estrés es algo que muchos estudiantes experimentan. ¿Qué es lo que más te está generando presión en este momento?';

    if (msg.includes('ansied') || msg.includes('nervios'))
        return 'Entiendo que la ansiedad puede ser difícil de manejar. Una técnica que ayuda es la respiración 4-7-8: inhala 4 segundos, retén 7 y exhala 8. ¿Te gustaría hablar más sobre lo que estás sintiendo?';

    if (msg.includes('dorm') || msg.includes('sueño') || msg.includes('insomnio'))
        return 'Los problemas de sueño son muy comunes en universitarios. ¿Tienes pensamientos acelerados cuando intentas dormir, o es algo físico lo que te impide descansar?';

    if (msg.includes('triste') || msg.includes('mal') || msg.includes('llor'))
        return 'Está bien sentirse mal a veces. Gracias por compartirlo conmigo. ¿Quieres contarme qué está pasando?';

    if (msg.includes('hola') || msg.includes('buenas') || msg.includes('hey'))
        return '¡Hola! Me alegra que estés aquí. ¿Cómo te has sentido hoy?';

    return '¿Puedes contarme un poco más sobre eso? Estoy aquí para escucharte sin juzgarte.';
}

// ─── GLOBALES ─────────────────────────────────────────────────────────────────

window.openConversation   = openConversation;
window.deleteConversation = deleteConversation;
window.useSuggestion      = useSuggestion;
