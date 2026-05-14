const API_URL = "/api";

// ─── DATA MANAGER ────────────────────────────────────────────────────────────

const DataManager = {
    PREFIX: 'lumencare_',
    save(key, data) { try { localStorage.setItem(this.PREFIX + key, JSON.stringify(data)); return true; } catch { return false; } },
    get(key, defaultValue = null) { try { const item = localStorage.getItem(this.PREFIX + key); return item ? JSON.parse(item) : defaultValue; } catch { return defaultValue; } },
    remove(key) { localStorage.removeItem(this.PREFIX + key); }
};

// ─── AUTH SYSTEM ──────────────────────────────────────────────────────────────

const AuthSystem = {

    async register(boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena) {
        if (!boleta || !nombre || !apellido_paterno || !apellido_materno || !correo || !contrasena)
            return { success: false, message: "Todos los campos son requeridos" };
        try {
            const response = await fetch(`${API_URL}/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena }) });
            return await response.json();
        } catch { return { success: false, message: "Error conectando con el servidor" }; }
    },

    async login(correo, contrasena) {
        if (!correo || !contrasena) return { success: false, message: "Correo y contraseña requeridos" };
        try {
            const response = await fetch(`${API_URL}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo, contrasena }) });
            const data = await response.json();
            if (!data.success) return data;
            DataManager.save("token", data.token);
            DataManager.save("user",  data.user);
            sessionStorage.removeItem('lumencare_inactivity_logout');
            window.dispatchEvent(new CustomEvent('authStateChanged'));
            return { success: true, message: "Sesión iniciada", user: data.user };
        } catch { return { success: false, message: "Error conectando con el servidor" }; }
    },

    logout() {
        InactivityManager.stop();
        DataManager.remove("token");
        DataManager.remove("user");
        window.dispatchEvent(new CustomEvent('authStateChanged'));
        return { success: true, message: "Sesión cerrada" };
    },

    getUser() {
        const user = DataManager.get("user");
        if (!user) return null;
        return { ...user, userId: user.userId || user.boleta || user.cedula || user.correo, name: user.name || `${user.nombre} ${user.apellido_paterno}`, avatar: user.avatar || (user.nombre ? user.nombre.charAt(0).toUpperCase() : "U") };
    },

    getSession()  { return this.getUser(); },
    getToken()    { return DataManager.get("token"); },

    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;
        try {
            const payload    = JSON.parse(atob(token.split('.')[1]));
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < nowSeconds) { this.logout(); return false; }
        } catch { this.logout(); return false; }
        return true;
    },

    requireAuth() {
        if (!this.isAuthenticated()) { window.location.href = "index.html"; return false; }
        InactivityManager.start();
        return true;
    },

    async fetchAuth(url, options = {}) {
        const token = this.getToken();
        const mergedOptions = { ...options, headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` } };
        let response;
        try { response = await fetch(url, mergedOptions); }
        catch (err) { throw err; }
        if (response.status === 401 || response.status === 403) { this.logout(); window.location.href = "index.html"; return null; }
        return response;
    }
};

// ─── ACTUALIZAR NAV SEGÚN ESTADO DE AUTH ─────────────────────────────────────

function updateAuthNav() {
    const isAuth = AuthSystem.isAuthenticated();
    document.body.classList.toggle('user-authenticated', isAuth);

    // Limpiar elementos inyectados previamente
    document.querySelector('.nav-link-pacientes')?.parentElement?.remove();
    document.querySelector('.prof-badge-injected')?.remove();
    document.querySelector('.mobile-nav-pacientes')?.remove();
    document.querySelector('.mobile-nav')?.classList.remove('mobile-nav--prof');

    if (!isAuth) return;

    const user = AuthSystem.getUser();
    if (!user || user.tipo_cuenta !== 'profesional') return;

    // ── Desktop nav: "Mis Pacientes" al inicio ──
    const navMenu = document.querySelector('.nav-menu');
    if (navMenu && !navMenu.querySelector('.nav-link-pacientes')) {
        const li = document.createElement('li');
        li.innerHTML = `<a href="profesional.html" class="nav-link nav-link-pacientes">Mis Pacientes</a>`;
        navMenu.insertBefore(li, navMenu.firstChild);
    }

    // ── Barra móvil: inyectar "Pacientes" si no existe ──
    const mobileNavInner = document.querySelector('.mobile-nav__inner');
    if (mobileNavInner && !mobileNavInner.querySelector('.mobile-nav-pacientes')) {
        const a = document.createElement('a');
        a.href = 'profesional.html';
        a.className = 'mobile-nav__link mobile-nav-pacientes';
        a.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Pacientes`;
        mobileNavInner.insertBefore(a, mobileNavInner.firstChild);
    }

    // ── Ocultar "Mi Diario" y "Asistente" en móvil y desktop ──
    document.querySelectorAll('.mobile-nav__link').forEach(link => {
        if (link.href?.includes('diario.html') || link.href?.includes('chatbot.html'))
            link.style.display = 'none';
    });

    document.querySelectorAll('.nav-menu .nav-link').forEach(link => {
        if (link.href?.includes('diario.html') || link.href?.includes('chatbot.html'))
            link.parentElement.style.display = 'none';
    });

    // ── Badge "Profesional" en userInfo ──
    const userInfo = document.getElementById('userInfo');
    if (userInfo && !userInfo.querySelector('.prof-badge')) {
        const badge = document.createElement('div');
        badge.className = 'prof-badge prof-badge-injected';
        badge.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>Profesional`;
        userInfo.insertBefore(badge, userInfo.firstChild);
    }
}

window.updateAuthNav = updateAuthNav;
window.addEventListener('authStateChanged', updateAuthNav);

// ─── INACTIVITY MANAGER ───────────────────────────────────────────────────────

const InactivityManager = {
    TOTAL_MS: 20 * 60 * 1000, WARNING_MS: 2 * 60 * 1000,
    _logoutTimer: null, _warningTimer: null, _countdownInterval: null,
    _boundActivity: null, _running: false,

    start() {
        if (this._running) return;
        this._running = true;
        this._injectStyles();
        this._bindActivityEvents();
        this._scheduleTimers();
    },

    stop() {
        this._running = false;
        clearTimeout(this._logoutTimer);
        clearTimeout(this._warningTimer);
        clearInterval(this._countdownInterval);
        this._removeActivityEvents();
        this._removeBanner();
    },

    _scheduleTimers() {
        clearTimeout(this._logoutTimer); clearTimeout(this._warningTimer);
        clearInterval(this._countdownInterval); this._removeBanner();
        this._warningTimer = setTimeout(() => { this._showBanner(); }, this.TOTAL_MS - this.WARNING_MS);
        this._logoutTimer  = setTimeout(() => { this._autoLogout(); }, this.TOTAL_MS);
    },

    _onActivity() { if (!this._running) return; this._scheduleTimers(); },

    _bindActivityEvents() {
        this._boundActivity = () => this._onActivity();
        ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(ev => document.addEventListener(ev, this._boundActivity, { passive: true }));
    },

    _removeActivityEvents() {
        if (!this._boundActivity) return;
        ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(ev => document.removeEventListener(ev, this._boundActivity));
        this._boundActivity = null;
    },

    _showBanner() {
        this._removeBanner();
        let secondsLeft = Math.floor(this.WARNING_MS / 1000);
        const banner = document.createElement('div');
        banner.id = 'inactivity-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML = `<div class="inactivity-banner__inner"><div class="inactivity-banner__message"><span class="inactivity-banner__clock">⏰</span><p>Tu sesión se cerrará en <strong><span id="inactivity-countdown">${secondsLeft}</span> segundos</strong>.</p></div><div class="inactivity-banner__buttons"><button class="inactivity-btn inactivity-btn--keep" id="btnKeepSession">Mantener sesión</button><button class="inactivity-btn inactivity-btn--logout" id="btnLogoutNow">Cerrar sesión</button></div></div>`;
        document.body.appendChild(banner);
        requestAnimationFrame(() => banner.classList.add('inactivity-banner--visible'));
        this._countdownInterval = setInterval(() => { secondsLeft = Math.max(0, secondsLeft - 1); const el = document.getElementById('inactivity-countdown'); if (el) el.textContent = secondsLeft; }, 1000);
        document.getElementById('btnKeepSession')?.addEventListener('click', () => { this._scheduleTimers(); });
        document.getElementById('btnLogoutNow')?.addEventListener('click',  () => { this._autoLogout(); });
    },

    _removeBanner() {
        clearInterval(this._countdownInterval); this._countdownInterval = null;
        const banner = document.getElementById('inactivity-banner');
        if (!banner) return;
        banner.classList.remove('inactivity-banner--visible');
        setTimeout(() => banner.remove(), 400);
    },

    _autoLogout() {
        this.stop();
        sessionStorage.setItem('lumencare_inactivity_logout', '1');
        AuthSystem.logout();
        window.location.href = 'index.html';
    },

    _injectStyles() {
        if (document.getElementById('inactivity-styles')) return;
        const style = document.createElement('style');
        style.id = 'inactivity-styles';
        style.textContent = `
            #inactivity-banner { position:fixed; bottom:0; left:0; right:0; z-index:9999; padding:0 1rem 1rem; transform:translateY(110%); transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1); pointer-events:none; }
            #inactivity-banner.inactivity-banner--visible { transform:translateY(0); pointer-events:auto; }
            .inactivity-banner__inner { max-width:700px; margin:0 auto; background:#1e293b; color:#f1f5f9; border-radius:16px; padding:1rem 1.5rem; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; box-shadow:0 -4px 30px rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.08); }
            .inactivity-banner__message { display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0; }
            .inactivity-banner__clock { font-size:1.5rem; flex-shrink:0; }
            .inactivity-banner__message p { margin:0; font-size:0.92rem; color:#cbd5e1; }
            .inactivity-banner__message strong { color:#fbbf24; }
            .inactivity-banner__buttons { display:flex; gap:0.5rem; flex-shrink:0; }
            .inactivity-btn { border:none; border-radius:10px; padding:0.55rem 1.1rem; font-size:0.85rem; font-weight:600; cursor:pointer; white-space:nowrap; }
            .inactivity-btn--keep   { background:#7c3aed; color:#fff; }
            .inactivity-btn--logout { background:rgba(255,255,255,0.1); color:#94a3b8; }`;
        document.head.appendChild(style);
    }
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

const Utils = {
    showToast(message, type = "info", duration = 3000) {
        const container = document.getElementById("toastContainer") || this.createToastContainer();
        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    },
    createToastContainer() { const c = document.createElement("div"); c.id = "toastContainer"; c.className = "toast-container"; document.body.appendChild(c); return c; },
    generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2, 8); },
    escapeHtml(text) { if (!text) return ''; const d = document.createElement('div'); d.appendChild(document.createTextNode(String(text))); return d.innerHTML; },
    formatDate(isoString) { if (!isoString) return ''; return new Date(isoString).toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' }); },
    debounce(fn, delay) { let t; return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); }; },
    animateIn(element, delayMs = 0) {
        element.style.opacity = '0'; element.style.transform = 'translateY(20px)';
        element.style.transition = `opacity 0.4s ease ${delayMs}ms, transform 0.4s ease ${delayMs}ms`;
        requestAnimationFrame(() => { requestAnimationFrame(() => { element.style.opacity = '1'; element.style.transform = 'translateY(0)'; }); });
    }
};

// ─── GLOBALES ─────────────────────────────────────────────────────────────────

window.AuthSystem        = AuthSystem;
window.InactivityManager = InactivityManager;
window.DataManager       = DataManager;
window.Utils             = Utils;

// ─── DOM READY ────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    updateAuthNav();

    if (sessionStorage.getItem('lumencare_inactivity_logout') === '1') {
        sessionStorage.removeItem('lumencare_inactivity_logout');
        setTimeout(() => { Utils.showToast('Tu sesión se cerró automáticamente por inactividad.', 'info', 6000); }, 500);
    }

    const authModal         = document.getElementById("authModal");
    const btnLogin          = document.getElementById("btnLogin");
    const btnRegister       = document.getElementById("btnRegister");
    const modalClose        = document.getElementById("modalClose");
    const modalOverlay      = document.querySelector(".modal-overlay");
    const loginContainer    = document.getElementById("loginForm");
    const registerContainer = document.getElementById("registerForm");

    if (!authModal) return;

    if (btnLogin)    btnLogin.addEventListener("click",    () => { authModal.classList.add("active"); loginContainer?.classList.remove("hidden"); registerContainer?.classList.add("hidden"); });
    if (btnRegister) btnRegister.addEventListener("click", () => { authModal.classList.add("active"); registerContainer?.classList.remove("hidden"); loginContainer?.classList.add("hidden"); });
    if (modalClose)   modalClose.addEventListener("click",   () => authModal.classList.remove("active"));
    if (modalOverlay) modalOverlay.addEventListener("click", () => authModal.classList.remove("active"));

    document.getElementById("switchToRegister")?.addEventListener("click",  (e) => { e.preventDefault(); loginContainer?.classList.add("hidden"); registerContainer?.classList.remove("hidden"); });
    document.getElementById("switchToLogin")?.addEventListener("click",     (e) => { e.preventDefault(); registerContainer?.classList.add("hidden"); loginContainer?.classList.remove("hidden"); });
    document.getElementById("switchToLoginProf")?.addEventListener("click", (e) => { e.preventDefault(); registerContainer?.classList.add("hidden"); loginContainer?.classList.remove("hidden"); });
});
