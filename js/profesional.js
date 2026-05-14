// ============================================================
//  PANEL PROFESIONAL — LumenCare
//  Gestión de pacientes y visualización de calendarios emocionales
// ============================================================

const MOOD_COLORS = {
    euforico:'#1DB954', contento:'#7BC9A6', tranquilo:'#C6DC6A',
    neutral:'#FFD93D',  ansioso:'#FFB347',  frustrado:'#FF7043',
    triste:'#3B82F6',   solitario:'#9B59B6', agobiado:'#E74C3C',
    desesperado:'#2C3E50'
};

const MOOD_LABELS = {
    euforico:'Eufórico', contento:'Contento', tranquilo:'Tranquilo',
    neutral:'Neutral',   ansioso:'Ansioso',   frustrado:'Frustrado',
    triste:'Triste',     solitario:'Solitario', agobiado:'Agobiado',
    desesperado:'Desesperado'
};

let currentUser    = null;
let calPatient     = null;   // paciente cuyo calendario está abierto
let calYear        = new Date().getFullYear();
let calMonth       = new Date().getMonth() + 1;
let searchTimeout  = null;

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Verificar que es un profesional
    if (!AuthSystem.isAuthenticated()) { window.location.href = 'index.html'; return; }
    currentUser = AuthSystem.getUser();
    if (!currentUser || currentUser.tipo_cuenta !== 'profesional') {
        window.location.href = 'index.html';
        return;
    }

    InactivityManager.start();
    updateUserUI();
    setupEventListeners();
    loadPatients();
});

function updateUserUI() {
    const n = document.getElementById('userName');
    const a = document.getElementById('userAvatar');
    const s = document.getElementById('profSpecialty');
    if (n) n.textContent = currentUser.name.split(' ')[0];
    if (a) a.textContent = currentUser.avatar;
    if (s) s.textContent = currentUser.especialidad || 'Panel de seguimiento emocional';
}

function setupEventListeners() {
    document.getElementById('btnLogout')?.addEventListener('click', () => {
        AuthSystem.logout(); window.location.href = 'index.html';
    });
    document.getElementById('btnAddPatient')?.addEventListener('click', openAddPatientModal);

    // Calendario del paciente — navegación
    document.getElementById('calPrevMonth')?.addEventListener('click', () => {
        calMonth--;
        if (calMonth < 1) { calMonth = 12; calYear--; }
        if (calPatient) loadPatientCalendar(calPatient.boleta);
    });
    document.getElementById('calNextMonth')?.addEventListener('click', () => {
        calMonth++;
        if (calMonth > 12) { calMonth = 1; calYear++; }
        if (calPatient) loadPatientCalendar(calPatient.boleta);
    });
}

// ─── CARGAR PACIENTES ─────────────────────────────────────────────────────────

async function loadPatients() {
    try {
        const res  = await fetch('/api/profesionales/pacientes', {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }
        renderPatients(data.pacientes);
    } catch {
        Utils.showToast('Error cargando pacientes', 'error');
    }
}

function renderPatients(pacientes) {
    const grid  = document.getElementById('patientsGrid');
    const empty = document.getElementById('emptyState');
    const total = document.getElementById('statTotal');
    if (!grid || !empty) return;

    if (total) total.textContent = pacientes.length;

    // Contar registros de esta semana
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recent  = pacientes.filter(p => p.ultima_fecha && new Date(p.ultima_fecha) > weekAgo).length;
    const statRec = document.getElementById('statRecent');
    if (statRec) statRec.textContent = recent;

    if (pacientes.length === 0) {
        grid.innerHTML  = '';
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    empty.classList.add('hidden');
    grid.innerHTML = pacientes.map(p => createPatientCard(p)).join('');
}

function createPatientCard(p) {
    const color     = p.ultima_emocion ? (MOOD_COLORS[p.ultima_emocion] ?? '#ccc') : null;
    const moodLabel = p.ultima_emocion ? (MOOD_LABELS[p.ultima_emocion] ?? p.ultima_emocion) : null;
    const fechaAsig = new Date(p.fecha_asignacion).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
    const ultimaFec = p.ultima_fecha
        ? new Date(p.ultima_fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short' })
        : null;

    return `
        <div class="patient-card" data-boleta="${p.boleta}">
            <div class="patient-card__header">
                <div class="patient-avatar">${p.nombre.charAt(0).toUpperCase()}</div>
                <div class="patient-info">
                    <div class="patient-name">${Utils.escapeHtml(p.nombre)} ${Utils.escapeHtml(p.apellido_paterno)}</div>
                    <div class="patient-boleta">Boleta: ${p.boleta}</div>
                    <div class="patient-correo">${Utils.escapeHtml(p.correo)}</div>
                </div>
            </div>

            ${color ? `
            <div class="patient-mood">
                <span class="patient-mood__dot" style="background:${color}"></span>
                <span>Último estado: <strong>${moodLabel}</strong></span>
                ${ultimaFec ? `<span class="patient-mood__date">${ultimaFec}</span>` : ''}
            </div>` : `
            <div class="patient-mood">
                <span style="color:var(--color-text-muted);font-style:italic;font-size:0.85rem">Sin registros aún</span>
            </div>`}

            <div class="patient-since">Paciente desde: ${fechaAsig}</div>

            <div class="patient-actions">
                <button class="btn-view-calendar" onclick="openCalendarModal('${p.boleta}','${p.nombre} ${p.apellido_paterno}')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8"  y1="2" x2="8"  y2="6"/>
                        <line x1="3"  y1="10" x2="21" y2="10"/>
                    </svg>
                    Ver calendario
                </button>
                <button class="btn-remove-patient" onclick="removePatient('${p.boleta}','${p.nombre} ${p.apellido_paterno}')">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                    </svg>
                    Eliminar
                </button>
            </div>
        </div>`;
}

// ─── AGREGAR PACIENTE ─────────────────────────────────────────────────────────

function openAddPatientModal() {
    document.getElementById('modalAddPatient')?.classList.remove('hidden');
    document.getElementById('searchPatientInput').value = '';
    document.getElementById('searchResults').innerHTML  = '';
    document.getElementById('searchPatientInput')?.focus();
}

function closeAddPatientModal() {
    document.getElementById('modalAddPatient')?.classList.add('hidden');
}

function onSearchPatient(value) {
    clearTimeout(searchTimeout);
    if (value.trim().length < 3) {
        document.getElementById('searchResults').innerHTML = '';
        return;
    }
    searchTimeout = setTimeout(() => searchPatient(), 500);
}

async function searchPatient() {
    const q = document.getElementById('searchPatientInput')?.value.trim();
    if (!q || q.length < 3) return;

    const resultsEl = document.getElementById('searchResults');
    resultsEl.innerHTML = `<div class="search-no-results">Buscando...</div>`;

    try {
        const res  = await fetch(`/api/profesionales/buscar-alumno?q=${encodeURIComponent(q)}`, {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();

        if (!data.success || data.alumnos.length === 0) {
            resultsEl.innerHTML = `<div class="search-no-results">No se encontraron alumnos con ese dato.</div>`;
            return;
        }

        resultsEl.innerHTML = data.alumnos.map(a => {
            const isAssigned = !!a.cedula_profesional;
            const tagClass   = isAssigned ? 'search-result-tag--assigned' : 'search-result-tag--free';
            const tagText    = isAssigned ? 'Ya tiene profesional' : 'Disponible';
            const btnDisabled = isAssigned ? 'disabled style="opacity:0.5;cursor:not-allowed"' : '';

            return `
            <div class="search-result-item">
                <div class="search-result-info">
                    <div class="search-result-name">${Utils.escapeHtml(a.nombre)} ${Utils.escapeHtml(a.apellido_paterno)}</div>
                    <div class="search-result-meta">Boleta: ${a.boleta} · ${Utils.escapeHtml(a.correo)}</div>
                </div>
                <span class="search-result-tag ${tagClass}">${tagText}</span>
                <button class="btn btn-primary btn-sm" onclick="addPatient('${a.boleta}')" ${btnDisabled}>
                    Agregar
                </button>
            </div>`;
        }).join('');

    } catch {
        resultsEl.innerHTML = `<div class="search-no-results">Error al buscar. Intenta de nuevo.</div>`;
    }
}

async function addPatient(boleta) {
    try {
        const res  = await fetch('/api/profesionales/pacientes', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AuthSystem.getToken()}` },
            body:    JSON.stringify({ boleta_alumno: boleta })
        });
        const data = await res.json();

        if (data.success) {
            Utils.showToast('Paciente agregado ✅', 'success');
            closeAddPatientModal();
            await loadPatients();
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

// ─── ELIMINAR PACIENTE ────────────────────────────────────────────────────────

async function removePatient(boleta, nombre) {
    if (!confirm(`¿Eliminar a ${nombre} de tu lista de pacientes?`)) return;
    try {
        const res  = await fetch(`/api/profesionales/pacientes/${boleta}`, {
            method:  'DELETE',
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (data.success) { Utils.showToast('Paciente eliminado', 'info'); await loadPatients(); }
        else Utils.showToast(data.message, 'error');
    } catch {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

// ─── CALENDARIO DEL PACIENTE ──────────────────────────────────────────────────

function openCalendarModal(boleta, nombre) {
    calPatient  = { boleta, nombre };
    calYear     = new Date().getFullYear();
    calMonth    = new Date().getMonth() + 1;

    document.getElementById('calModalName').textContent   = nombre;
    document.getElementById('calModalBoleta').textContent = `Boleta: ${boleta}`;
    document.getElementById('calModalAvatar').textContent = nombre.charAt(0).toUpperCase();
    document.getElementById('modalCalendar')?.classList.remove('hidden');

    loadPatientCalendar(boleta);
}

function closeCalendarModal() {
    document.getElementById('modalCalendar')?.classList.add('hidden');
    calPatient = null;
}

async function loadPatientCalendar(boleta) {
    const mes = `${calYear}-${String(calMonth).padStart(2,'0')}`;
    try {
        const res  = await fetch(`/api/profesionales/pacientes/${boleta}/calendario?mes=${mes}`, {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }

        // Construir mapa de días
        const diasMap = {};
        data.dias.forEach(d => { diasMap[d.fecha] = { mood: d.sentimiento, mood2: d.sentimiento2 }; });

        renderPatientCalendar(diasMap);
    } catch {
        Utils.showToast('Error cargando calendario', 'error');
    }
}

function renderPatientCalendar(diasMap) {
    const grid  = document.getElementById('calModalGrid');
    const title = document.getElementById('calModalTitle');
    if (!grid || !title) return;

    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    title.textContent = `${MESES[calMonth - 1]} ${calYear}`;

    const firstWeekday = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth  = new Date(calYear, calMonth, 0).getDate();
    const today        = new Date().toLocaleDateString('en-CA');

    let html = '';
    for (let i = 0; i < firstWeekday; i++) html += `<div class="cal-day cal-day--empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayData = diasMap[dateStr];
        const mood    = dayData?.mood  ?? null;
        const mood2   = dayData?.mood2 ?? null;
        const isToday = dateStr === today;

        const cls = ['cal-day', isToday ? 'cal-day--today' : '', mood ? 'cal-day--has-diary' : ''].filter(Boolean).join(' ');

        const dot1 = mood  ? `<span class="cal-dot" style="background:${MOOD_COLORS[mood]  ?? '#ccc'}"></span>` : '';
        const dot2 = mood2 ? `<span class="cal-dot" style="background:${MOOD_COLORS[mood2] ?? '#ccc'}"></span>` : '';

        html += `
            <div class="${cls}" title="${mood ? MOOD_LABELS[mood] : ''}${mood2 ? ' + ' + MOOD_LABELS[mood2] : ''}">
                <span class="cal-day__num">${d}</span>
                <div class="cal-day__dots">${dot1}${dot2}</div>
            </div>`;
    }

    grid.innerHTML = html;
}

// ─── GLOBALES ─────────────────────────────────────────────────────────────────

window.openCalendarModal   = openCalendarModal;
window.closeCalendarModal  = closeCalendarModal;
window.closeAddPatientModal = closeAddPatientModal;
window.openAddPatientModal = openAddPatientModal;
window.searchPatient       = searchPatient;
window.onSearchPatient     = onSearchPatient;
window.addPatient          = addPatient;
window.removePatient       = removePatient;
