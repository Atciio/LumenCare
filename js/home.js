// ============================================================
//  HOME — LumenCare
//  Maneja login (alumno o profesional) y registro de ambos tipos
// ============================================================

let currentAccountType = 'alumno';  // 'alumno' | 'profesional'

document.addEventListener('DOMContentLoaded', () => {
    initHomePage();
});

function initHomePage() {
    updateAuthUI();
    setupAuthEventListeners();
    setupActivityEventListeners();
    animatePageElements();
}

function updateAuthUI() {
    const session    = AuthSystem.getSession();
    const userInfo   = document.getElementById('userInfo');
    const authBtns   = document.getElementById('authButtons');
    const userName   = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    if (session) {
        userInfo?.classList.remove('hidden');
        authBtns?.classList.add('hidden');
        if (userName)   userName.textContent   = session.name.split(' ')[0];
        if (userAvatar) userAvatar.textContent = session.avatar;
    } else {
        userInfo?.classList.add('hidden');
        authBtns?.classList.remove('hidden');
    }
}

function setupAuthEventListeners() {
    document.getElementById('btnLogin')?.addEventListener('click',    () => showAuthModal('login'));
    document.getElementById('btnRegister')?.addEventListener('click', () => showAuthModal('register'));
    document.getElementById('btnStartJourney')?.addEventListener('click', handleStartJourney);
    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

    document.getElementById('modalClose')?.addEventListener('click', hideAuthModal);
    document.querySelector('.modal-overlay')?.addEventListener('click', hideAuthModal);

    document.getElementById('switchToRegister')?.addEventListener('click',   (e) => { e.preventDefault(); showAuthModal('register'); });
    document.getElementById('switchToLogin')?.addEventListener('click',      (e) => { e.preventDefault(); showAuthModal('login'); });
    document.getElementById('switchToLoginProf')?.addEventListener('click',  (e) => { e.preventDefault(); showAuthModal('login'); });

    document.getElementById('formLogin')?.addEventListener('submit', handleLogin);
    document.getElementById('formRegisterAlumno')?.addEventListener('submit', handleRegisterAlumno);
    document.getElementById('formRegisterProfesional')?.addEventListener('submit', handleRegisterProfesional);
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

function showAuthModal(type = 'login') {
    const modal       = document.getElementById('authModal');
    const loginForm   = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (!modal) return;

    if (type === 'login') {
        loginForm?.classList.remove('hidden');
        registerForm?.classList.add('hidden');
    } else {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
        switchAccountType('alumno');  // siempre empieza en alumno
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    document.getElementById('formLogin')?.reset();
    document.getElementById('formRegisterAlumno')?.reset();
    document.getElementById('formRegisterProfesional')?.reset();
}

// ─── SELECTOR DE TIPO DE CUENTA ──────────────────────────────────────────────

function switchAccountType(type) {
    currentAccountType = type;

    const btnAlumno      = document.getElementById('btnTypeAlumno');
    const btnProfesional = document.getElementById('btnTypeProfesional');
    const formAlumno     = document.getElementById('formRegisterAlumno');
    const formProf       = document.getElementById('formRegisterProfesional');

    if (type === 'alumno') {
        btnAlumno?.classList.add('active');
        btnProfesional?.classList.remove('active');
        formAlumno?.classList.remove('hidden');
        formProf?.classList.add('hidden');
    } else {
        btnAlumno?.classList.remove('active');
        btnProfesional?.classList.add('active');
        formAlumno?.classList.add('hidden');
        formProf?.classList.remove('hidden');
    }
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

async function handleLogin(e) {
    e.preventDefault();
    const correo   = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    const result = await AuthSystem.login(correo, password);

    if (result.success) {
        Utils.showToast('¡Bienvenido/a! ' + result.user.name.split(' ')[0], 'success');
        hideAuthModal();

        // Redirigir según tipo de cuenta
        if (result.user.tipo_cuenta === 'profesional') {
            window.location.href = 'profesional.html';
        } else {
            updateAuthUI();
        }
    } else {
        Utils.showToast(result.message, 'error');
    }
}

// ─── REGISTRO ALUMNO ─────────────────────────────────────────────────────────

async function handleRegisterAlumno(e) {
    e.preventDefault();

    const boleta           = document.getElementById('registerBoleta')?.value.trim();
    const nombre           = document.getElementById('registerName')?.value.trim();
    const apellido_paterno = document.getElementById('registerApPaterno')?.value.trim();
    const apellido_materno = document.getElementById('registerApMaterno')?.value.trim();
    const telefono         = document.getElementById('registerTelefono')?.value.trim();
    const correo           = document.getElementById('registerEmail')?.value.trim();
    const password         = document.getElementById('registerPassword')?.value;
    const confirmPassword  = document.getElementById('registerConfirmPassword')?.value;
    const acceptTerms      = document.getElementById('acceptTerms')?.checked;

    if (!boleta)                       { Utils.showToast('La boleta es requerida', 'error'); return; }
    if (password !== confirmPassword)  { Utils.showToast('Las contraseñas no coinciden', 'error'); return; }
    if (!acceptTerms)                  { Utils.showToast('Debes aceptar los términos', 'error'); return; }

    const result = await AuthSystem.register(boleta, nombre, apellido_paterno, apellido_materno, telefono || '', correo, password);

    if (result.success) {
        Utils.showToast(result.message + ' Ahora puedes iniciar sesión', 'success');
        showAuthModal('login');
        const loginEmailInput = document.getElementById('loginEmail');
        if (loginEmailInput) loginEmailInput.value = correo;
    } else {
        Utils.showToast(result.message, 'error');
    }
}

// ─── REGISTRO PROFESIONAL ────────────────────────────────────────────────────

async function handleRegisterProfesional(e) {
    e.preventDefault();

    const cedula           = document.getElementById('profCedula')?.value.trim();
    const nombre           = document.getElementById('profNombre')?.value.trim();
    const apellido_paterno = document.getElementById('profApPaterno')?.value.trim();
    const apellido_materno = document.getElementById('profApMaterno')?.value.trim();
    const especialidad     = document.getElementById('profEspecialidad')?.value;
    const telefono         = document.getElementById('profTelefono')?.value.trim();
    const correo           = document.getElementById('profEmail')?.value.trim();
    const password         = document.getElementById('profPassword')?.value;
    const confirmPassword  = document.getElementById('profConfirmPassword')?.value;

    if (!cedula)                      { Utils.showToast('La cédula profesional es requerida', 'error'); return; }
    if (!especialidad)                { Utils.showToast('Selecciona tu especialidad', 'error'); return; }
    if (password !== confirmPassword) { Utils.showToast('Las contraseñas no coinciden', 'error'); return; }

    try {
        const response = await fetch('/api/profesionales/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cedula, nombre, apellido_paterno, apellido_materno, especialidad, telefono: telefono || null, correo, contrasena: password })
        });
        const data = await response.json();

        if (data.success) {
            Utils.showToast(data.message + ' Ahora puedes iniciar sesión', 'success');
            showAuthModal('login');
            const loginEmailInput = document.getElementById('loginEmail');
            if (loginEmailInput) loginEmailInput.value = correo;
        } else {
            Utils.showToast(data.message, 'error');
        }
    } catch {
        Utils.showToast('Error conectando con el servidor', 'error');
    }
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

function handleLogout() {
    AuthSystem.logout();
    Utils.showToast('Sesión cerrada', 'info');
    updateAuthUI();
}

function handleStartJourney() {
    if (AuthSystem.isAuthenticated()) {
        const user = AuthSystem.getUser();
        window.location.href = user.tipo_cuenta === 'profesional' ? 'profesional.html' : 'diario.html';
    } else {
        Utils.showToast('Inicia sesión para comenzar', 'info');
        showAuthModal('login');
    }
}

// ─── ACTIVIDADES ──────────────────────────────────────────────────────────────

function setupActivityEventListeners() {
    document.querySelectorAll('.activity-card .btn').forEach((button, index) => {
        button.addEventListener('click', (e) => { e.stopPropagation(); handleActivityClick(index); });
    });
}

function handleActivityClick(index) {
    const activities = ['Respiración Consciente', 'Mindfulness', 'Pausa Activa'];
    Utils.showToast(`Actividad "${activities[index] || 'Actividad'}" próximamente disponible`, 'info');
}

function showActivities() {
    document.getElementById('activities')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─── ANIMACIONES ──────────────────────────────────────────────────────────────

function animatePageElements() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.feature-item, .activity-card, .resource-card, .stat-item').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `all 0.6s ease ${i * 0.1}s`;
        observer.observe(el);
    });
}

// ─── GLOBALES ─────────────────────────────────────────────────────────────────

window.showActivities    = showActivities;
window.switchAccountType = switchAccountType;
