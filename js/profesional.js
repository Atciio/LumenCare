// ============================================================
//  PANEL PROFESIONAL — LumenCare
//  Gestión de pacientes, calendario emocional y notas de consulta
// ============================================================

const MOOD_COLORS = {
    euforico:'#1DB954', contento:'#7BC9A6', tranquilo:'#C6DC6A', neutral:'#FFD93D',
    ansioso:'#FFB347', frustrado:'#FF7043', triste:'#3B82F6', solitario:'#9B59B6',
    agobiado:'#E74C3C', desesperado:'#2C3E50'
};
const MOOD_LABELS = {
    euforico:'Eufórico', contento:'Contento', tranquilo:'Tranquilo', neutral:'Neutral',
    ansioso:'Ansioso', frustrado:'Frustrado', triste:'Triste', solitario:'Solitario',
    agobiado:'Agobiado', desesperado:'Desesperado'
};

let currentUser   = null;
let activePaciente = null;  // { boleta, nombre }
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth() + 1;
let searchTimeout = null;
let editingNotaId = null;

// ─── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!AuthSystem.isAuthenticated()) { window.location.href = 'index.html'; return; }
    currentUser = AuthSystem.getUser();
    if (!currentUser || currentUser.tipo_cuenta !== 'profesional') { window.location.href = 'index.html'; return; }

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
    document.getElementById('btnLogout')?.addEventListener('click', () => { AuthSystem.logout(); window.location.href = 'index.html'; });
    document.getElementById('btnAddPatient')?.addEventListener('click', openAddPatientModal);

    // Navegación del calendario
    document.getElementById('calPrevMonth')?.addEventListener('click', () => {
        calMonth--; if (calMonth < 1) { calMonth = 12; calYear--; }
        if (activePaciente) loadPatientCalendar(activePaciente.boleta);
    });
    document.getElementById('calNextMonth')?.addEventListener('click', () => {
        calMonth++; if (calMonth > 12) { calMonth = 1; calYear++; }
        if (activePaciente) loadPatientCalendar(activePaciente.boleta);
    });
}

// ─── PACIENTES ────────────────────────────────────────────────────────────────
async function loadPatients() {
    try {
        const res  = await fetch('/api/profesionales/pacientes', { headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` } });
        const data = await res.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }
        renderPatients(data.pacientes);
    } catch { Utils.showToast('Error cargando pacientes', 'error'); }
}

function renderPatients(pacientes) {
    const grid  = document.getElementById('patientsGrid');
    const empty = document.getElementById('emptyState');
    const total = document.getElementById('statTotal');
    if (!grid || !empty) return;

    if (total) total.textContent = pacientes.length;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const recent  = pacientes.filter(p => p.ultima_fecha && new Date(p.ultima_fecha) > weekAgo).length;
    const statRec = document.getElementById('statRecent');
    if (statRec) statRec.textContent = recent;

    if (pacientes.length === 0) { grid.innerHTML = ''; grid.classList.add('hidden'); empty.classList.remove('hidden'); return; }
    grid.classList.remove('hidden'); empty.classList.add('hidden');
    grid.innerHTML = pacientes.map(p => createPatientCard(p)).join('');
}

function createPatientCard(p) {
    const color     = p.ultima_emocion ? (MOOD_COLORS[p.ultima_emocion] ?? '#ccc') : null;
    const moodLabel = p.ultima_emocion ? (MOOD_LABELS[p.ultima_emocion] ?? p.ultima_emocion) : null;
    const fechaAsig = new Date(p.fecha_asignacion).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
    const ultimaFec = p.ultima_fecha ? new Date(p.ultima_fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : null;

    return `
    <div class="patient-card" data-boleta="${p.boleta}" onclick="openPacienteModal('${p.boleta}','${p.nombre} ${p.apellido_paterno}')">
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
        <div class="patient-mood"><span style="color:var(--color-text-muted);font-style:italic;font-size:0.85rem">Sin registros aún</span></div>`}
        <div class="patient-since">Paciente desde: ${fechaAsig}</div>
        <div class="patient-actions" onclick="event.stopPropagation()">
            <button class="btn-view-calendar" onclick="openPacienteModal('${p.boleta}','${p.nombre} ${p.apellido_paterno}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Ver detalle
            </button>
            <button class="btn-remove-patient" onclick="removePatient('${p.boleta}','${p.nombre} ${p.apellido_paterno}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                Eliminar
            </button>
        </div>
        <!-- Resumen IA — se genera bajo demanda, no se guarda en BD -->
        <div class="patient-resumen" id="resumen-${p.boleta}" onclick="event.stopPropagation()">
            <button class="btn-resumen-ia" onclick="generarResumen('${p.boleta}', this)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
                Resumen IA
            </button>
            <div class="resumen-ia-content hidden" id="resumen-content-${p.boleta}"></div>
        </div>
    </div>`;
}

async function removePatient(boleta, nombre) {
    if (!confirm(`¿Eliminar a ${nombre} de tu lista de pacientes?`)) return;
    try {
        const res  = await fetch(`/api/profesionales/pacientes/${boleta}`, { method:'DELETE', headers:{'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data = await res.json();
        if (data.success) { Utils.showToast('Paciente eliminado', 'info'); await loadPatients(); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

// ─── MODAL DETALLE DEL PACIENTE ───────────────────────────────────────────────
function openPacienteModal(boleta, nombre) {
    activePaciente = { boleta, nombre };
    calYear  = new Date().getFullYear();
    calMonth = new Date().getMonth() + 1;

    document.getElementById('pacienteModalNombre').textContent = nombre;
    document.getElementById('pacienteModalBoleta').textContent = `Boleta: ${boleta}`;
    document.getElementById('pacienteModalAvatar').textContent = nombre.charAt(0).toUpperCase();
    document.getElementById('modalPaciente')?.classList.remove('hidden');

    switchTab('calendario');
}

function closePacienteModal() {
    document.getElementById('modalPaciente')?.classList.add('hidden');
    activePaciente = null;
    cancelarEdicionNota();
}

function switchTab(tab) {
    const tabCal   = document.getElementById('tabCalendario');
    const tabNot   = document.getElementById('tabNotas');
    const panelCal = document.getElementById('panelCalendario');
    const panelNot = document.getElementById('panelNotas');

    if (tab === 'calendario') {
        tabCal?.classList.add('active'); tabNot?.classList.remove('active');
        panelCal?.classList.remove('hidden'); panelNot?.classList.add('hidden');
        if (activePaciente) loadPatientCalendar(activePaciente.boleta);
    } else {
        tabNot?.classList.add('active'); tabCal?.classList.remove('active');
        panelNot?.classList.remove('hidden'); panelCal?.classList.add('hidden');
        if (activePaciente) loadNotas(activePaciente.boleta);
        // Poner fecha de hoy por defecto
        const input = document.getElementById('notaFecha');
        if (input && !input.value) input.value = new Date().toLocaleDateString('en-CA');
    }
}

// ─── CALENDARIO ───────────────────────────────────────────────────────────────
async function loadPatientCalendar(boleta) {
    const mes = `${calYear}-${String(calMonth).padStart(2,'0')}`;
    try {
        const res  = await fetch(`/api/profesionales/pacientes/${boleta}/calendario?mes=${mes}`, { headers: {'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data = await res.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }
        const diasMap = {};
        data.dias.forEach(d => { diasMap[d.fecha] = { mood: d.sentimiento, mood2: d.sentimiento2 }; });
        renderPatientCalendar(diasMap);
    } catch { Utils.showToast('Error cargando calendario', 'error'); }
}

function renderPatientCalendar(diasMap) {
    const grid  = document.getElementById('calModalGrid');
    const title = document.getElementById('calModalTitle');
    if (!grid || !title) return;

    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    title.textContent = `${MESES[calMonth-1]} ${calYear}`;

    const firstWeekday = new Date(calYear, calMonth-1, 1).getDay();
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
        const cls = ['cal-day', isToday?'cal-day--today':'', mood?'cal-day--has-diary':''].filter(Boolean).join(' ');
        const dot1 = mood  ? `<span class="cal-dot" style="background:${MOOD_COLORS[mood] ??'#ccc'}"></span>` : '';
        const dot2 = mood2 ? `<span class="cal-dot" style="background:${MOOD_COLORS[mood2]??'#ccc'}"></span>` : '';
        html += `<div class="${cls}" title="${mood?MOOD_LABELS[mood]:''}${mood2?' + '+MOOD_LABELS[mood2]:''}">
            <span class="cal-day__num">${d}</span>
            <div class="cal-day__dots">${dot1}${dot2}</div>
        </div>`;
    }
    grid.innerHTML = html;
}

// ─── NOTAS DE CONSULTA ────────────────────────────────────────────────────────
async function loadNotas(boleta) {
    const listEl  = document.getElementById('notasList');
    const emptyEl = document.getElementById('notasEmpty');
    if (!listEl) return;
    try {
        const res  = await fetch(`/api/profesionales/pacientes/${boleta}/notas`, { headers: {'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data = await res.json();
        if (!data.success) { Utils.showToast(data.message, 'error'); return; }
        renderNotas(data.notas);
    } catch { Utils.showToast('Error cargando notas', 'error'); }
}

function renderNotas(notas) {
    const listEl  = document.getElementById('notasList');
    const emptyEl = document.getElementById('notasEmpty');
    if (!listEl || !emptyEl) return;

    if (notas.length === 0) { listEl.innerHTML = ''; emptyEl.classList.remove('hidden'); return; }
    emptyEl.classList.add('hidden');

    listEl.innerHTML = notas.map(n => {
        const fecha = new Date(n.fecha_consulta+'T12:00:00').toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
        const creada = new Date(n.fecha_creacion).toLocaleDateString('es-MX', { day:'numeric', month:'short', year:'numeric' });
        return `
        <div class="nota-card" data-id="${n.id_nota}">
            <div class="nota-card__header">
                <div class="nota-card__meta">
                    <span class="nota-badge">Cita #${n.numero_cita}</span>
                    <span class="nota-fecha">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        ${fecha}
                    </span>
                </div>
                <div class="nota-card__actions">
                    <button class="nota-btn nota-btn--edit" onclick="editarNota(${n.id_nota},'${n.fecha_consulta}',${JSON.stringify(n.nota).replace(/'/g,"&#39;")})" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="nota-btn nota-btn--delete" onclick="eliminarNota(${n.id_nota})" title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                </div>
            </div>
            <p class="nota-card__texto">${Utils.escapeHtml(n.nota)}</p>
            <p class="nota-card__created">Registrada el ${creada}</p>
        </div>`;
    }).join('');
}

async function guardarNota() {
    if (!activePaciente) return;
    const nota          = document.getElementById('notaContenido')?.value.trim();
    const fecha_consulta = document.getElementById('notaFecha')?.value;

    if (!nota || !fecha_consulta) { Utils.showToast('Completa la fecha y la nota', 'error'); return; }

    try {
        let res, data;
        if (editingNotaId) {
            res  = await fetch(`/api/profesionales/notas/${editingNotaId}`, { method:'PUT', headers:{'Content-Type':'application/json','Authorization':`Bearer ${AuthSystem.getToken()}`}, body:JSON.stringify({nota,fecha_consulta}) });
        } else {
            res  = await fetch(`/api/profesionales/pacientes/${activePaciente.boleta}/notas`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${AuthSystem.getToken()}`}, body:JSON.stringify({nota,fecha_consulta}) });
        }
        data = await res.json();
        if (data.success) {
            Utils.showToast(editingNotaId ? 'Nota actualizada ✅' : `Nota de cita #${data.numero_cita} guardada ✅`, 'success');
            cancelarEdicionNota();
            await loadNotas(activePaciente.boleta);
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

function editarNota(id, fecha, nota) {
    editingNotaId = id;
    document.getElementById('notaFecha').value      = fecha;
    document.getElementById('notaContenido').value  = nota;
    document.getElementById('notaFormTitle').textContent = 'Editar nota de consulta';
    document.getElementById('notaForm')?.scrollIntoView({ behavior:'smooth' });
}

function cancelarEdicionNota() {
    editingNotaId = null;
    const f = document.getElementById('notaFecha');
    const c = document.getElementById('notaContenido');
    const t = document.getElementById('notaFormTitle');
    if (f) f.value = new Date().toLocaleDateString('en-CA');
    if (c) c.value = '';
    if (t) t.textContent = 'Nueva nota de consulta';
}

async function eliminarNota(id) {
    if (!confirm('¿Eliminar esta nota de consulta? Esta acción no se puede deshacer.')) return;
    try {
        const res  = await fetch(`/api/profesionales/notas/${id}`, { method:'DELETE', headers:{'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data = await res.json();
        if (data.success) { Utils.showToast('Nota eliminada', 'info'); await loadNotas(activePaciente.boleta); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}

// ─── AGREGAR PACIENTE ─────────────────────────────────────────────────────────
function openAddPatientModal() {
    document.getElementById('modalAddPatient')?.classList.remove('hidden');
    document.getElementById('searchPatientInput').value = '';
    document.getElementById('searchResults').innerHTML  = '';
    setTimeout(() => document.getElementById('searchPatientInput')?.focus(), 100);
}

function closeAddPatientModal() { document.getElementById('modalAddPatient')?.classList.add('hidden'); }

function onSearchPatient(value) {
    clearTimeout(searchTimeout);
    if (value.trim().length < 3) { document.getElementById('searchResults').innerHTML = ''; return; }
    searchTimeout = setTimeout(() => searchPatient(), 500);
}

async function searchPatient() {
    const q = document.getElementById('searchPatientInput')?.value.trim();
    if (!q || q.length < 3) return;
    const resultsEl = document.getElementById('searchResults');
    resultsEl.innerHTML = `<div class="search-no-results">Buscando...</div>`;
    try {
        const res  = await fetch(`/api/profesionales/buscar-alumno?q=${encodeURIComponent(q)}`, { headers:{'Authorization':`Bearer ${AuthSystem.getToken()}`} });
        const data = await res.json();
        if (!data.success || data.alumnos.length === 0) { resultsEl.innerHTML = `<div class="search-no-results">No se encontraron alumnos.</div>`; return; }
        resultsEl.innerHTML = data.alumnos.map(a => {
            const isAssigned = !!a.cedula_profesional;
            return `
            <div class="search-result-item">
                <div class="search-result-info">
                    <div class="search-result-name">${Utils.escapeHtml(a.nombre)} ${Utils.escapeHtml(a.apellido_paterno)}</div>
                    <div class="search-result-meta">Boleta: ${a.boleta} · ${Utils.escapeHtml(a.correo)}</div>
                </div>
                <span class="search-result-tag ${isAssigned?'search-result-tag--assigned':'search-result-tag--free'}">${isAssigned?'Ya tiene profesional':'Disponible'}</span>
                <button class="btn btn-primary btn-sm" onclick="addPatient('${a.boleta}')" ${isAssigned?'disabled style="opacity:0.5;cursor:not-allowed"':''}>Agregar</button>
            </div>`;
        }).join('');
    } catch { resultsEl.innerHTML = `<div class="search-no-results">Error al buscar.</div>`; }
}

async function addPatient(boleta) {
    try {
        const res  = await fetch('/api/profesionales/pacientes', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${AuthSystem.getToken()}`}, body:JSON.stringify({boleta_alumno:boleta}) });
        const data = await res.json();
        if (data.success) { Utils.showToast('Paciente agregado ✅', 'success'); closeAddPatientModal(); await loadPatients(); }
        else Utils.showToast(data.message, 'error');
    } catch { Utils.showToast('Error conectando con el servidor', 'error'); }
}


// ─── RESUMEN IA ────────────────────────────────────────────────────────────────

async function generarResumen(boleta, btn) {
    const contenedor = document.getElementById(`resumen-content-${boleta}`);
    if (!contenedor) return;

    // Si ya está visible, ocultarlo (toggle)
    if (!contenedor.classList.contains('hidden')) {
        contenedor.classList.add('hidden');
        btn.querySelector('span') && (btn.querySelector('span').textContent = 'Resumen IA');
        return;
    }

    // Mostrar loading
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Generando...`;

    try {
        const res  = await fetch(`/api/profesionales/pacientes/${boleta}/resumen`, {
            headers: { 'Authorization': `Bearer ${AuthSystem.getToken()}` }
        });
        const data = await res.json();

        contenedor.innerHTML = data.success
            ? `<p class="resumen-ia-text">${Utils.escapeHtml(data.resumen)}</p>
               <span class="resumen-ia-badge">✨ Generado por IA · No guardado</span>`
            : `<p class="resumen-ia-error">${data.message}</p>`;

        contenedor.classList.remove('hidden');
    } catch {
        contenedor.innerHTML = `<p class="resumen-ia-error">Error al conectar con el servidor.</p>`;
        contenedor.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg> Resumen IA`;
    }
}

// ─── GLOBALES ─────────────────────────────────────────────────────────────────
window.openPacienteModal    = openPacienteModal;
window.closePacienteModal   = closePacienteModal;
window.switchTab            = switchTab;
window.closeAddPatientModal = closeAddPatientModal;
window.openAddPatientModal  = openAddPatientModal;
window.searchPatient        = searchPatient;
window.onSearchPatient      = onSearchPatient;
window.addPatient           = addPatient;
window.removePatient        = removePatient;
window.guardarNota          = guardarNota;
window.editarNota           = editarNota;
window.eliminarNota         = eliminarNota;
window.cancelarEdicionNota  = cancelarEdicionNota;
window.generarResumen       = generarResumen;
