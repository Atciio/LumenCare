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
    
    const session = AuthSystem.getSession();
    const userInfo = document.getElementById('userInfo');
    const authButtons = document.getElementById('authButtons');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');

    if (session) {
        userInfo?.classList.remove('hidden');
        authButtons?.classList.add('hidden');
        if (userName) userName.textContent = session.name.split(' ')[0];
        if (userAvatar) userAvatar.textContent = session.avatar;
    } else {
        userInfo?.classList.add('hidden');
        authButtons?.classList.remove('hidden');
    }
}

function setupAuthEventListeners() {
    const btnLogin = document.getElementById('btnLogin');
    const btnRegister = document.getElementById('btnRegister');
    const btnStartJourney = document.getElementById('btnStartJourney');

    btnLogin?.addEventListener('click', () => showAuthModal('login'));
    btnRegister?.addEventListener('click', () => showAuthModal('register'));
    btnStartJourney?.addEventListener('click', handleStartJourney);

    document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

    document.getElementById('modalClose')?.addEventListener('click', hideAuthModal);
    document.querySelector('.modal-overlay')?.addEventListener('click', hideAuthModal);

    document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal('register');
    });

    document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal('login');
    });

    document.getElementById('formLogin')?.addEventListener('submit', handleLogin);
    document.getElementById('formRegister')?.addEventListener('submit', handleRegister);
}

function showAuthModal(type = 'login') {
    const modal = document.getElementById('authModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (!modal || !loginForm || !registerForm) return;

    if (type === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
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
    document.getElementById('formRegister')?.reset();
}

async function handleLogin(e) {
    e.preventDefault();

    const correo = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;

    const result = await AuthSystem.login(correo, password);

    if (result.success) {
        Utils.showToast(result.message, 'success');
        hideAuthModal();
        updateAuthUI();
    } else {
        Utils.showToast(result.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const boleta          = document.getElementById('registerBoleta')?.value.trim();
    const nombre          = document.getElementById('registerName')?.value.trim();
    const apellido_paterno = document.getElementById('registerApPaterno')?.value.trim();
    const apellido_materno = document.getElementById('registerApMaterno')?.value.trim();
    const telefono        = document.getElementById('registerTelefono')?.value.trim();
    const correo          = document.getElementById('registerEmail')?.value.trim();
    const password        = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
    const acceptTerms     = document.getElementById('acceptTerms')?.checked;

    if (!boleta) {
        Utils.showToast('La boleta es requerida', 'error');
        return;
    }

    if (password !== confirmPassword) {
        Utils.showToast('Las contraseñas no coinciden', 'error');
        return;
    }

    if (!acceptTerms) {
        Utils.showToast('Debes aceptar los términos y condiciones', 'error');
        return;
    }

    const result = await AuthSystem.register(
        boleta,
        nombre,
        apellido_paterno,
        apellido_materno,
        telefono || '',
        correo,
        password
    );

    if (result.success) {
        Utils.showToast(result.message + ' Ahora puedes iniciar sesión', 'success');
        showAuthModal('login');
        const loginEmailInput = document.getElementById('loginEmail');
        if (loginEmailInput) loginEmailInput.value = correo;
    } else {
        Utils.showToast(result.message, 'error');
    }
}

function handleLogout() {
    AuthSystem.logout();
    Utils.showToast('Sesión cerrada', 'info');
    updateAuthUI();
}

function handleStartJourney() {
    if (AuthSystem.isAuthenticated()) {
        window.location.href = 'diario.html';
    } else {
        Utils.showToast('Inicia sesión para comenzar', 'info');
        showAuthModal('login');
    }
}

function setupActivityEventListeners() {
    const activityButtons = document.querySelectorAll('.activity-card .btn');

    activityButtons.forEach((button, index) => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            handleActivityClick(index);
        });
    });
}

function handleActivityClick(index) {
    const activities = [
        'Respiración Consciente',
        'Mindfulness',
        'Pausa Activa'
    ];

    const activityName = activities[index] || 'Actividad';
    Utils.showToast(`Actividad "${activityName}" próximamente disponible`, 'info');
}

function showActivities() {
    document.getElementById('activities')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function animatePageElements() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const elements = document.querySelectorAll(`
        .feature-item,
        .activity-card,
        .resource-card,
        .stat-item
    `);

    elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(el);
    });
}

window.showActivities = showActivities;
