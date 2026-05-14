// ============================================================
//  DIARIO PERSONAL — LumenCare
//  10 estados de ánimo, selección de hasta 2
//  Calendario con 2 puntos de color por día
// ============================================================

const MOOD_EMOJIS = {
    euforico:    '🤩', contento:    '😊', tranquilo:   '😌', neutral:     '😐',
    ansioso:     '😰', frustrado:   '😤', triste:      '😢', solitario:   '😔',
    agobiado:    '😩', desesperado: '😞'
};

const MOOD_COLORS = {
    euforico:    '#1DB954', contento:    '#7BC9A6', tranquilo:   '#C6DC6A',
    neutral:     '#FFD93D', ansioso:     '#FFB347', frustrado:   '#FF7043',
    triste:      '#3B82F6', solitario:   '#9B59B6', agobiado:    '#E74C3C',
    desesperado: '#2C3E50'
};

const MOOD_LABELS = {
    euforico: 'Eufórico', contento: 'Contento', tranquilo: 'Tranquilo',
    neutral: 'Neutral',   ansioso: 'Ansioso',   frustrado: 'Frustrado',
    triste: 'Triste',     solitario: 'Solitario', agobiado: 'Agobiado',
    desesperado: 'Desesperado'
};

// ─── ESTADO ──────────────────────────────────────────────────────────────────

let currentUser    = null;
let editingEntryId = null;
let allEntries     = [];
let selectedDate   = null;
let moodSelection  = [];   // orden de clic → [0] = predominante, [1] = secundario

const calendarState = {
    year:    new Date().getFullYear(),
    month:   new Date().getMonth() + 1,
    // dias ahora es { "YYYY-MM-DD": { mood, mood2 } }
    dias:    {},
    eventos: {}
};

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => { initDiaryPage(); });

function initDiaryPage() {
    if (!AuthSystem.requireAuth()) return;
    currentUser = AuthSystem.getUser();
    if (!currentUser) { window.location.href = 'index.html'; return; }

    // Solo alumnos tienen diario
    if (currentUser.tipo_cuenta === 'profesional') {
        window.location.href = 'profesional.html';
        return;
    }

    updateUserUI();
    setupEventListeners();
    loadUserEntries();
    fetchCalendarData();
    loadMiProfesional();
}

function updateUserUI() {
    const n = document.getElementById('userName');
    const a = document.getElementById('userAvatar');
    if (n) n.textContent = currentUser.name.split(' ')[0];
    if (a) a.textContent = currentUser.avatar;
}

// ─── EVENTOS ─────────────────────────────────────────────────────────────────

function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        AuthSystem.logout(); window.location.href = 'index.html';
    });

    document.getElementById('btnNewEntry')?.addEventListener('click', () => showNewEntryForm(null));
    document.getElementById('btnCloseForm')?.addEventListener('click', hideEntryForm);
    document.getElementById('btnCancelForm')?.addEventListener('click', hideEntryForm);
    document.getElementById('entryForm')?.addEventListener('submit', handleSaveEntry);

    document.getElementById('entryContent')?.addEventListener('input', e => {
        const el = document.getElementById('charCount');
        if (el) el.textContent = e.target.value.length;
    });

    document.querySelectorAll('.mood-checkbox').forEach(cb => {
        cb.addEventListener('change', () => handleMoodCheckbox(cb.value, cb.checked));
    });

    document.getElementById('searchInput')?.addEventListener('input', Utils.debounce(applyFiltersAndRender, 300));
    document.getElementById('moodFilter')?.addEventListener('change', applyFiltersAndRender);
    document.getElementById('sortFilter')?.addEventListener('change', applyFiltersAndRender);

    document.getElementById('btnPrevMonth')?.addEventListener('click', () => {
        calendarState.month--;
        if (calendarState.month < 1) { calendarState.month = 12; calendarState.year--; }
        fetchCalendarData();
    });
    document.getElementById('btnNextMonth')?.addEventListener('click', () => {
        calendarState.month++;
        if (calendarState.month > 12) { calendarState.month = 1; calendarState.year++; }
        fetchCalendarData();
    });

    document.getElementById('btnAddDiaryForDay')?.addEventListener('click', () => {
        if (selectedDate) showNewEntryForm(selectedDate);
    });
    document.getElementById('btnCloseDay')?.addEventListener('click', () => {
        selectedDate = null; renderCalendar(); closeDayPanel();
    });

    document.getElementById('btnShowAgendaForm')?.addEventListener('click', () => {
        document.getElementById('agendaForm')?.classList.toggle('hidden');
        document.getElementById('agendaTitulo')?.focus();
    });
    document.getElementById('btnCancelAgendaForm')?.addEventListener('click', hideAgendaForm);
    document.getElementById('btnSaveAgenda')?.addEventListener('click', handleSaveAgenda);
}

// ─── SELECCIÓN DE MOOD ────────────────────────────────────────────────────────

function handleMoodCheckbox(value, checked) {
    if (checked) {
        if (moodSelection.length >= 2) {
            document.querySelector(`.mood-checkbox[value="${value}"]`).checked = false;
            return;
        }
        moodSelection.push(value);
    } else {
        moodSelection = moodSelection.filter(m => m !== value);
    }
    updateMoodUI();
}

function updateMoodUI() {
    const maxReached = moodSelection.length >= 2;
    const hint    = document.getElementById('moodHint');
    const counter = document.getElementById('moodCounter');
    if (counter) {
        counter.innerHTML = maxReached
            ? `<strong style="color:var(--color-primary)">2/2</strong> emociones seleccionadas`
            : `Selecciona hasta <strong>2</strong> emociones &nbsp;·&nbsp; ${moodSelection.length}/2`;
    }
    if (hint) hint.classList.toggle('hidden', !maxReached);
    document.querySelectorAll('.mood-option').forEach(opt => {
        const v = opt.querySelector('.mood-checkbox').value;
        opt.classList.toggle('mood-option--selected', moodSelection.includes(v));
        opt.classList.toggle('mood-option--dimmed', maxReached && !moodSelection.includes(v));
    });
}

function resetMoodSelector() {
    moodSelection = [];
    document.querySelectorAll('.mood-checkbox').forEach(cb => { cb.checked = false; });
    document.querySelectorAll('.mood-option').forEach(opt => {
        opt.classList.remove('mood-option--selected', 'mood-option--dimmed');
    });
    const hint    = document.getElementById('moodHint');
    const counter = document.getElementById('moodCounter');
    if (hint)    hint.classList.add('hidden');
    if (counter) counter.innerHTML = `Selecciona hasta <strong>2</strong> emociones`;
}

function setMoodSelection(moods) {
    resetMoodSelector();
    moods.filter(Boolean).forEach(m => {
        moodSelection.push(m);
        const cb = document.querySelector(`.mood-checkbox[value="${m}"]`);
        if (cb) cb.checked = true;
    });
    updateMoodUI();
}

// ─── CALENDARIO ──────────────────────────────────────────────────────────────

async function fetchCalendarData() {
    const mes = `${calendarState.year}-${String(calendarState.month).padStart(2,'0')}`;
    try {
        const res  = await fetch(`/api/diario/calendario?mes=${mes}`, {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();

        calendarState.dias    = {};
        calendarState.eventos = {};

        if (data.success) {
            // Guardar AMBOS moods por día
            data.dias.forEach(d => {
                calendarState.dias[d.fecha] = {
                    mood:  d.sentimiento,
                    mood2: d.sentimiento2 || null   // puede ser null
                };
            });
            data.eventos.forEach(ev => {
                if (!calendarState.eventos[ev.fecha]) calendarState.eventos[ev.fecha] = [];
                calendarState.eventos[ev.fecha].push(ev);
            });
        }
    } catch (err) { console.warn('Error cargando calendario:', err); }

    renderCalendar();
    if (selectedDate) openDayPanel(selectedDate);
}

function renderCalendar() {
    const grid  = document.getElementById('calendarGrid');
    const title = document.getElementById('calendarTitle');
    if (!grid || !title) return;

    const { year, month } = calendarState;
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    title.textContent = `${MESES[month - 1]} ${year}`;

    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const daysInMonth  = new Date(year, month, 0).getDate();
    const today        = new Date().toLocaleDateString('en-CA');

    let html = '';
    for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day cal-day--empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

        // Leer ambos moods del día
        const dayData  = calendarState.dias[dateStr];
        const mood     = dayData?.mood  ?? null;
        const mood2    = dayData?.mood2 ?? null;
        const hasAgenda = !!(calendarState.eventos[dateStr]?.length);

        const cls = ['cal-day',
            dateStr === today        ? 'cal-day--today'    : '',
            dateStr === selectedDate ? 'cal-day--selected' : '',
            mood       ? 'cal-day--has-diary'  : '',
            hasAgenda  ? 'cal-day--has-agenda' : ''
        ].filter(Boolean).join(' ');

        // Puntos: mood principal, mood secundario (si existe), agenda
        const dot1      = mood      ? `<span class="cal-dot" style="background:${MOOD_COLORS[mood]  ?? '#ccc'}"></span>` : '';
        const dot2      = mood2     ? `<span class="cal-dot" style="background:${MOOD_COLORS[mood2] ?? '#ccc'}"></span>` : '';
        const agendaDot = hasAgenda ? `<span class="cal-dot cal-dot--agenda"></span>` : '';

        html += `
            <div class="${cls}" onclick="onCalendarDayClick('${dateStr}')" title="${dateStr}">
                <span class="cal-day__num">${d}</span>
                <div class="cal-day__dots">${dot1}${dot2}${agendaDot}</div>
            </div>`;
    }

    grid.innerHTML = html;
}

// ─── CLIC EN DÍA ─────────────────────────────────────────────────────────────

function onCalendarDayClick(dateStr) {
    if (selectedDate === dateStr) { selectedDate = null; renderCalendar(); closeDayPanel(); return; }
    selectedDate = dateStr;
    renderCalendar();
    openDayPanel(dateStr);
}

// ─── PANEL DEL DÍA ───────────────────────────────────────────────────────────

function openDayPanel(dateStr) {
    const panel = document.getElementById('dayPanel');
    if (!panel) return;

    const [y, m, d] = dateStr.split('-');
    const MESES = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    document.getElementById('dayPanelTitle').textContent =
        `${parseInt(d)} de ${MESES[parseInt(m)-1]} de ${y}`;

    panel.classList.remove('hidden');

    const diaryEntries = allEntries.filter(e =>
        new Date(e.createdAt).toLocaleDateString('en-CA') === dateStr
    );
    renderDayDiaryEntries(diaryEntries);
    renderDayAgendaEvents(calendarState.eventos[dateStr] || []);

    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

function closeDayPanel() {
    document.getElementById('dayPanel')?.classList.add('hidden');
    hideAgendaForm();
}

function renderDayDiaryEntries(entries) {
    const c = document.getElementById('dayDiaryEntries');
    const e = document.getElementById('dayDiaryEmpty');
    if (!c || !e) return;
    if (entries.length === 0) { c.innerHTML = ''; e.classList.remove('hidden'); return; }
    e.classList.add('hidden');
    c.innerHTML = entries.map(en => {
        const color1 = MOOD_COLORS[en.mood]  ?? '#ccc';
        const color2 = en.mood2 ? (MOOD_COLORS[en.mood2] ?? '#ccc') : null;
        const border = color2
            ? `border-image: linear-gradient(to bottom, ${color1}, ${color2}) 1`
            : `border-left-color: ${color1}`;
        return `
        <div class="day-entry-card" style="${border}">
            <div class="day-entry-card__left">
                <span class="day-entry-card__emoji">
                    ${MOOD_EMOJIS[en.mood] ?? '😐'}${en.mood2 ? MOOD_EMOJIS[en.mood2] ?? '' : ''}
                </span>
                <div class="day-entry-card__body">
                    <p class="day-entry-card__time">${formatTime(en.createdAt)}</p>
                    <p class="day-entry-card__preview">${Utils.escapeHtml(
                        en.content.substring(0,110) + (en.content.length > 110 ? '…' : '')
                    )}</p>
                </div>
            </div>
            <button class="icon-btn icon-btn--danger" onclick="deleteDiaryFromPanel('${en.id}')" title="Eliminar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>`;
    }).join('');
}

function renderDayAgendaEvents(events) {
    const c = document.getElementById('dayAgendaEvents');
    const e = document.getElementById('dayAgendaEmpty');
    if (!c || !e) return;
    if (events.length === 0) { c.innerHTML = ''; e.classList.remove('hidden'); return; }
    e.classList.add('hidden');
    c.innerHTML = events.map(ev => `
        <div class="agenda-event-card">
            <div class="agenda-event-card__icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8"  y1="2" x2="8"  y2="6"/>
                    <line x1="3"  y1="10" x2="21" y2="10"/>
                </svg>
            </div>
            <div class="agenda-event-card__body">
                <p class="agenda-event-card__title">${Utils.escapeHtml(ev.titulo)}</p>
                ${ev.descripcion ? `<p class="agenda-event-card__desc">${Utils.escapeHtml(ev.descripcion)}</p>` : ''}
            </div>
            <button class="icon-btn icon-btn--danger" onclick="deleteAgendaEvent(${ev.id_agenda})" title="Eliminar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
            </button>
        </div>`).join('');
}

// ─── AGENDA CRUD ─────────────────────────────────────────────────────────────

function hideAgendaForm() {
    document.getElementById('agendaForm')?.classList.add('hidden');
    const t = document.getElementById('agendaTitulo');
    const d = document.getElementById('agendaDescripcion');
    if (t) t.value = ''; if (d) d.value = '';
}

async function handleSaveAgenda() {
    const titulo      = document.getElementById('agendaTitulo')?.value.trim();
    const descripcion = document.getElementById('agendaDescripcion')?.value.trim();
    if (!titulo)       { Utils.showToast('El título es obligatorio', 'error'); return; }
    if (!selectedDate) { Utils.showToast('Selecciona un día primero', 'error'); return; }
    try {
        const res  = await fetch('/api/agenda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AuthSystem.getToken()}` },
            body:    JSON.stringify({ titulo, descripcion, fecha_evento: selectedDate })
        });
        const data = await res.json();
        if (data.success) { Utils.showToast('Evento guardado 📅', 'success'); hideAgendaForm(); await fetchCalendarData(); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

async function deleteAgendaEvent(id) {
    if (!confirm('¿Eliminar este evento de agenda?')) return;
    try {
        const res  = await fetch(`/api/agenda/${id}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (data.success) { Utils.showToast('Evento eliminado', 'info'); await fetchCalendarData(); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

// ─── DIARIO CRUD ─────────────────────────────────────────────────────────────

async function loadUserEntries() {
    try {
        const res  = await fetch('/api/diario', { headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` } });
        const data = await res.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }
        allEntries = data.entries.map(e => ({
            id:        e.id_diario,
            mood:      e.sentimiento_predominante,
            mood2:     e.sentimiento_secundario || null,
            content:   e.registro_diario,
            createdAt: e.fecha_registro
        }));
        applyFiltersAndRender();
    } catch { Utils.showToast('Error cargando entradas', 'error'); }
}

function applyFiltersAndRender() {
    let entries = [...allEntries];
    const q  = document.getElementById('searchInput')?.value.toLowerCase().trim();
    if (q)  entries = entries.filter(e => e.content.toLowerCase().includes(q));
    const mf = document.getElementById('moodFilter')?.value;
    if (mf) entries = entries.filter(e => e.mood === mf || e.mood2 === mf);
    const sf = document.getElementById('sortFilter')?.value || 'recent';
    entries  = sf === 'oldest'
        ? [...entries].sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt))
        : [...entries].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderEntries(entries);
}

function showNewEntryForm(forDate) {
    editingEntryId = null;
    resetMoodSelector();
    document.getElementById('entryForm')?.reset();
    document.getElementById('entryId').value        = '';
    document.getElementById('charCount').textContent = '0';

    const indicator = document.getElementById('formDateIndicator');
    const entryDate = document.getElementById('entryDate');

    if (forDate) {
        const [y, m, d] = forDate.split('-');
        const MESES = ['enero','febrero','marzo','abril','mayo','junio',
                       'julio','agosto','septiembre','octubre','noviembre','diciembre'];
        entryDate.value = forDate;
        document.getElementById('formDateText').textContent =
            `Entrada para el ${parseInt(d)} de ${MESES[parseInt(m)-1]} de ${y}`;
        indicator.classList.remove('hidden');
        document.getElementById('formTitle').textContent = 'Nueva entrada — día seleccionado';
    } else {
        entryDate.value = ''; indicator.classList.add('hidden');
        document.getElementById('formTitle').textContent = 'Nueva entrada en tu diario';
    }

    document.getElementById('entryFormContainer')?.classList.remove('hidden');
    document.getElementById('entryFormContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showEditEntryForm(entryId) {
    const card = document.querySelector(`[data-id="${entryId}"]`);
    if (!card) return;
    editingEntryId = entryId;
    resetMoodSelector();

    document.getElementById('formTitle').textContent  = 'Editar entrada';
    document.getElementById('entryId').value          = entryId;
    document.getElementById('entryDate').value        = '';
    document.getElementById('entryContent').value     = card.dataset.content;
    document.getElementById('formDateIndicator')?.classList.add('hidden');
    document.getElementById('charCount').textContent  = card.dataset.content.length;

    setMoodSelection([card.dataset.mood, card.dataset.mood2].filter(Boolean));

    document.getElementById('entryFormContainer')?.classList.remove('hidden');
    document.getElementById('entryFormContainer')?.scrollIntoView({ behavior: 'smooth' });
}

function hideEntryForm() {
    document.getElementById('entryFormContainer')?.classList.add('hidden');
    document.getElementById('entryForm')?.reset();
    document.getElementById('formDateIndicator')?.classList.add('hidden');
    document.getElementById('entryDate').value = '';
    resetMoodSelector();
    editingEntryId = null;
}

async function handleSaveEntry(e) {
    e.preventDefault();
    const content = document.getElementById('entryContent')?.value.trim();
    if (!content)                   { Utils.showToast('Escribe algo en tu entrada', 'error'); return; }
    if (moodSelection.length === 0) { Utils.showToast('Selecciona al menos un estado de ánimo', 'error'); return; }

    const predominante = moodSelection[0];
    const secundario   = moodSelection[1] || null;
    const forDate      = document.getElementById('entryDate')?.value || null;

    if (editingEntryId) await updateEntry(editingEntryId, predominante, secundario, content);
    else                await createEntry(predominante, secundario, content, forDate);
}

async function createEntry(mood, mood2, content, forDate) {
    try {
        const body = { registro_diario: content, sentimiento_predominante: mood };
        if (mood2)   body.sentimiento_secundario = mood2;
        // Si no hay fecha específica, usar la fecha local del navegador
        body.fecha_registro = forDate || new Date().toLocaleDateString('en-CA');
        const res  = await fetch('/api/diario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AuthSystem.getToken()}` },
            body:    JSON.stringify(body)
        });
        const data = await res.json();
        if (data.success) {
            Utils.showToast('Entrada guardada ✨', 'success');
            hideEntryForm(); await loadUserEntries(); await fetchCalendarData();
        } else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

async function updateEntry(entryId, mood, mood2, content) {
    try {
        const res  = await fetch(`/api/diario/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AuthSystem.getToken()}` },
            body:    JSON.stringify({ registro_diario: content, sentimiento_predominante: mood, sentimiento_secundario: mood2 })
        });
        const data = await res.json();
        if (data.success) {
            Utils.showToast('Entrada actualizada', 'success');
            hideEntryForm(); await loadUserEntries(); await fetchCalendarData();
        } else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

async function deleteEntry(entryId) {
    if (!confirm('¿Eliminar esta entrada? No se puede deshacer.')) return;
    try {
        const res  = await fetch(`/api/diario/${entryId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (data.success) {
            Utils.showToast('Entrada eliminada', 'info');
            await loadUserEntries(); await fetchCalendarData();
        } else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

async function deleteDiaryFromPanel(entryId) {
    if (!confirm('¿Eliminar esta entrada? No se puede deshacer.')) return;
    try {
        const res  = await fetch(`/api/diario/${entryId}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (data.success) {
            Utils.showToast('Entrada eliminada', 'info');
            await loadUserEntries(); await fetchCalendarData();
        } else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

// ─── RENDER ──────────────────────────────────────────────────────────────────

function renderEntries(entries) {
    const grid  = document.getElementById('entriesGrid');
    const empty = document.getElementById('emptyState');
    if (!grid || !empty) return;

    if (entries.length === 0) {
        grid.classList.add('hidden'); empty.classList.remove('hidden');
        const hf = document.getElementById('searchInput')?.value || document.getElementById('moodFilter')?.value;
        document.getElementById('emptyTitle').textContent   = hf ? 'No se encontraron entradas'          : 'Tu diario está vacío';
        document.getElementById('emptyMessage').textContent = hf ? 'Intenta con otros filtros de búsqueda' : 'Comienza escribiendo tu primera entrada';
        return;
    }

    grid.classList.remove('hidden'); empty.classList.add('hidden');
    grid.innerHTML = entries.map(e => createEntryCard(e)).join('');
    grid.querySelectorAll('.entry-card').forEach((card, i) => Utils.animateIn(card, i * 50));
}

function createEntryCard(entry) {
    const preview  = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
    const color1   = MOOD_COLORS[entry.mood]  ?? '#ccc';
    const color2   = entry.mood2 ? (MOOD_COLORS[entry.mood2] ?? '#ccc') : null;
    const borderStyle = color2
        ? `style="border-top:4px solid transparent;background:linear-gradient(var(--color-surface),var(--color-surface)) padding-box,linear-gradient(to right,${color1},${color2}) border-box;"`
        : `style="border-top:4px solid ${color1};"`;

    return `
        <div class="entry-card" ${borderStyle}
             data-id="${entry.id}"
             data-mood="${entry.mood}"
             data-mood2="${entry.mood2 ?? ''}"
             data-content="${Utils.escapeHtml(entry.content)}">
            <div class="entry-header">
                <span class="entry-mood">
                    ${MOOD_EMOJIS[entry.mood] ?? '😐'}
                    ${entry.mood2 ? `<span class="entry-mood2">${MOOD_EMOJIS[entry.mood2] ?? ''}</span>` : ''}
                </span>
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
            <div class="entry-mood-tags">
                <span class="mood-tag" style="background:${color1}20;color:${color1};border-color:${color1}40">
                    ${MOOD_LABELS[entry.mood] ?? entry.mood}
                </span>
                ${entry.mood2 ? `<span class="mood-tag" style="background:${color2}20;color:${color2};border-color:${color2}40">
                    ${MOOD_LABELS[entry.mood2] ?? entry.mood2}
                </span>` : ''}
            </div>
            <p class="entry-date">${Utils.formatDate(entry.createdAt)}</p>
            <p class="entry-preview">${Utils.escapeHtml(preview)}</p>
        </div>`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}


// ─── MI PROFESIONAL ───────────────────────────────────────────────────────────

async function loadMiProfesional() {
    try {
        const res  = await fetch('/api/alumno/mi-profesional', {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        const card = document.getElementById('miProfesionalCard');
        if (!card) return;
        if (data.success && data.profesional) {
            const n = document.getElementById('profAsignadoNombre');
            const e = document.getElementById('profAsignadoEsp');
            if (n) n.textContent = data.profesional.nombre;
            if (e) e.textContent = data.profesional.especialidad;
            card.classList.remove('hidden');
            document.getElementById('btnDesvincular')?.addEventListener('click', handleDesvincular);
        } else {
            card.classList.add('hidden');
        }
    } catch { /* silencioso */ }
}

async function handleDesvincular() {
    if (!confirm('¿Seguro que quieres desvincularte de tu profesional?')) return;
    try {
        const res  = await fetch('/api/alumno/mi-profesional', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (data.success) {
            Utils.showToast('Te desvinculaste de tu profesional', 'info');
            document.getElementById('miProfesionalCard')?.classList.add('hidden');
        } else { Utils.showToast(data.message, 'error'); }
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

// ─── GLOBALES ─────────────────────────────────────────────────────────────────

window.showEditEntryForm    = showEditEntryForm;
window.deleteEntry          = deleteEntry;
window.deleteDiaryFromPanel = deleteDiaryFromPanel;
window.deleteAgendaEvent    = deleteAgendaEvent;
window.onCalendarDayClick   = onCalendarDayClick;
