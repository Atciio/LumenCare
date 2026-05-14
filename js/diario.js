

let currentUser = null;
let editingEntryId = null;

document.addEventListener('DOMContentLoaded', () => {
    initDiaryPage();
});

function initDiaryPage() {
    if (!AuthSystem.requireAuth()) return;

    currentUser = AuthSystem.getUser();
    if (!currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // Los profesionales no tienen diario — redirigir a su panel
    if (currentUser.tipo_cuenta === 'profesional') {
        window.location.href = 'profesional.html';
        return;
    }

    updateUserUI();
    setupEventListeners();
    loadUserEntries();
}

function updateUserUI() {
    const userName   = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    if (userName)   userName.textContent   = currentUser.name.split(' ')[0];
    if (userAvatar) userAvatar.textContent = currentUser.avatar;
}

function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        AuthSystem.logout();
        window.location.href = 'index.html';
    });

    document.getElementById('btnNewEntry')?.addEventListener('click', showNewEntryForm);
    document.getElementById('btnCloseForm')?.addEventListener('click', hideEntryForm);
    document.getElementById('btnCancelForm')?.addEventListener('click', hideEntryForm);
    document.getElementById('entryForm')?.addEventListener('submit', handleSaveEntry);

    document.getElementById('entryContent')?.addEventListener('input', (e) => {
        const charCount = document.getElementById('charCount');
        if (charCount) charCount.textContent = e.target.value.length;
    });

    document.getElementById('searchInput')?.addEventListener('input', Utils.debounce(loadUserEntries, 300));
    document.getElementById('moodFilter')?.addEventListener('change', loadUserEntries);
    document.getElementById('sortFilter')?.addEventListener('change', loadUserEntries);
}

function showNewEntryForm() {
    editingEntryId = null;
    document.getElementById('formTitle').textContent = 'Nueva entrada en tu diario';
    document.getElementById('entryForm')?.reset();
    document.getElementById('entryId').value = '';
    document.getElementById('charCount').textContent = '0';
    document.getElementById('entryFormContainer')?.classList.remove('hidden');
    document.getElementById('entryFormContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showEditEntryForm(entryId) {
    
    const card = document.querySelector(`[data-id="${entryId}"]`);
    if (!card) return;

    editingEntryId = entryId;
    document.getElementById('formTitle').textContent = 'Editar entrada';
    document.getElementById('entryId').value = entryId;
    document.getElementById('entryContent').value = card.dataset.content;

    const moodInput = document.querySelector(`input[name="mood"][value="${card.dataset.mood}"]`);
    if (moodInput) moodInput.checked = true;

    document.getElementById('charCount').textContent = card.dataset.content.length;
    document.getElementById('entryFormContainer')?.classList.remove('hidden');
    document.getElementById('entryFormContainer')?.scrollIntoView({ behavior: 'smooth' });
}

function hideEntryForm() {
    document.getElementById('entryFormContainer')?.classList.add('hidden');
    document.getElementById('entryForm')?.reset();
    editingEntryId = null;
}

async function handleSaveEntry(e) {
    e.preventDefault();

    
    const content = document.getElementById('entryContent')?.value.trim();
    const mood    = document.querySelector('input[name="mood"]:checked')?.value;

    if (!content || !mood) {
        Utils.showToast('Por favor completa los campos requeridos', 'error');
        return;
    }

    if (editingEntryId) {
        await updateEntry(editingEntryId, mood, content);
    } else {
        await createEntry(mood, content);
    }
}

async function createEntry(mood, content) {
    try {
        const response = await fetch('/api/diario', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({
                registro_diario:          content,
                sentimiento_predominante: mood,
                // Fecha local del navegador en YYYY-MM-DD para evitar desfase UTC
                fecha_registro: new Date().toLocaleDateString('en-CA')
            })
        });

        const data = await response.json();

        if (data.success) {
            Utils.showToast('Entrada guardada ✨', 'success');
            hideEntryForm();
            loadUserEntries();
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch (error) {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

async function updateEntry(entryId, mood, content) {
    try {
        const response = await fetch(`/api/diario/${entryId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            },
            body: JSON.stringify({
                registro_diario:          content,
                sentimiento_predominante: mood,
                // Fecha local del navegador en YYYY-MM-DD para evitar desfase UTC
                fecha_registro: new Date().toLocaleDateString('en-CA')
            })
        });

        const data = await response.json();

        if (data.success) {
            Utils.showToast('Entrada actualizada', 'success');
            hideEntryForm();
            loadUserEntries();
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch (error) {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

async function deleteEntry(entryId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta entrada? Esta acción no se puede deshacer.')) return;

    try {
        const response = await fetch(`/api/diario/${entryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            }
        });

        const data = await response.json();

        if (data.success) {
            Utils.showToast('Entrada eliminada', 'info');
            loadUserEntries();
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch (error) {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

async function loadUserEntries() {
    try {
        const response = await fetch('/api/diario', {
            headers: {
                'Authorization': `Bearer ${AuthSystem.getToken()}`
            }
        });

        const data = await response.json();

        if (!data.success) {
            Utils.showToast(data.message, 'error');
            return;
        }

        
        let entries = data.entries.map(e => ({
            id:        e.id_diario,
            mood:      e.sentimiento_predominante,
            content:   e.registro_diario,
            createdAt: e.fecha_registro
        }));

        
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase();
        if (searchTerm) {
            entries = entries.filter(e => e.content.toLowerCase().includes(searchTerm));
        }

        const moodFilter = document.getElementById('moodFilter')?.value;
        if (moodFilter) {
            entries = entries.filter(e => e.mood === moodFilter);
        }

        const sortFilter = document.getElementById('sortFilter')?.value || 'recent';
        entries = sortEntries(entries, sortFilter);

        renderEntries(entries);

    } catch (error) {
        Utils.showToast('Error cargando entradas', 'error');
    }
}

function sortEntries(entries, sortBy) {
    switch (sortBy) {
        case 'recent':
            return [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        case 'oldest':
            return [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        default:
            return entries;
    }
}

function renderEntries(entries) {
    const grid       = document.getElementById('entriesGrid');
    const emptyState = document.getElementById('emptyState');

    if (!grid || !emptyState) return;

    if (entries.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');

        const searchTerm = document.getElementById('searchInput')?.value;
        const moodFilter = document.getElementById('moodFilter')?.value;

        if (searchTerm || moodFilter) {
            document.getElementById('emptyTitle').textContent   = 'No se encontraron entradas';
            document.getElementById('emptyMessage').textContent = 'Intenta con otros filtros de búsqueda';
        } else {
            document.getElementById('emptyTitle').textContent   = 'Tu diario está vacío';
            document.getElementById('emptyMessage').textContent = 'Comienza escribiendo tu primera entrada';
        }
        return;
    }

    grid.classList.remove('hidden');
    emptyState.classList.add('hidden');

    grid.innerHTML = entries.map(entry => createEntryCard(entry)).join('');

    grid.querySelectorAll('.entry-card').forEach((card, index) => {
        Utils.animateIn(card, index * 50);
    });
}

function createEntryCard(entry) {
    const moodEmoji = getMoodEmoji(entry.mood);
    const preview   = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');

    
    return `
        <div class="entry-card mood-${entry.mood}"
             data-id="${entry.id}"
             data-mood="${entry.mood}"
             data-content="${Utils.escapeHtml(entry.content)}">
            <div class="entry-header">
                <span class="entry-mood">${moodEmoji}</span>
                <div class="entry-actions">
                    <button class="entry-btn edit" onclick="showEditEntryForm('${entry.id}')" title="Editar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="entry-btn delete" onclick="deleteEntry('${entry.id}')" title="Eliminar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </div>
            <p class="entry-date">${Utils.formatDate(entry.createdAt)}</p>
            <p class="entry-preview">${Utils.escapeHtml(preview)}</p>
        </div>
    `;
}

function getMoodEmoji(mood) {
    const moods = {
        great:    '😊',
        good:     '🙂',
        okay:     '😐',
        bad:      '😔',
        terrible: '😢'
    };
    return moods[mood] || '😐';
}

window.showEditEntryForm = showEditEntryForm;
window.deleteEntry       = deleteEntry;
