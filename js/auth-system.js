const API_URL = "/api";

// ─── DATA MANAGER ────────────────────────────────────────────────────────────

const DataManager = {
    PREFIX: 'lumencare_',

    save(key, data) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error("Error guardando datos:", error);
            return false;
        }
    },

    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.PREFIX + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error("Error obteniendo datos:", error);
            return defaultValue;
        }
    },

    remove(key) {
        localStorage.removeItem(this.PREFIX + key);
    }
};

// ─── AUTH SYSTEM ──────────────────────────────────────────────────────────────

const AuthSystem = {

    async register(boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena) {
        if (!boleta || !nombre || !apellido_paterno || !apellido_materno || !correo || !contrasena)
            return { success: false, message: "Todos los campos son requeridos" };
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena })
            });
            return await response.json();
        } catch {
            return { success: false, message: "Error conectando con el servidor" };
        }
    },

    async login(correo, contrasena) {
        if (!correo || !contrasena)
            return { success: false, message: "Correo y contraseña requeridos" };
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ correo, contrasena })
            });
            const data = await response.json();
            if (!data.success) return data;

            DataManager.save("token", data.token);
            DataManager.save("user",  data.user);

            // Limpiar bandera de cierre por inactividad
            sessionStorage.removeItem('lumencare_inactivity_logout');

            // Actualizar nav inmediatamente sin recargar
            window.dispatchEvent(new CustomEvent('authStateChanged'));

            return { success: true, message: "Sesión iniciada", user: data.user };
        } catch {
            return { success: false, message: "Error conectando con el servidor" };
        }
    },

    logout() {
        InactivityManager.stop();
        DataManager.remove("token");
        DataManager.remove("user");
        // Actualizar nav inmediatamente
        window.dispatchEvent(new CustomEvent('authStateChanged'));
        return { success: true, message: "Sesión cerrada" };
    },

    getUser() {
        const user = DataManager.get("user");
        if (!user) return null;
        return {
            ...user,
            userId: user.userId || user.boleta || user.correo,
            name:   user.name   || `${user.nombre} ${user.apellido_paterno}`,
            avatar: user.avatar || (user.nombre ? user.nombre.charAt(0).toUpperCase() : "U")
        };
    },

    getSession()  { return this.getUser(); },
    getToken()    { return DataManager.get("token"); },

    // Verifica si hay token Y no ha expirado (decodifica el JWT en cliente)
    isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;
        try {
            const payload     = JSON.parse(atob(token.split('.')[1]));
            const nowSeconds  = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < nowSeconds) {
                console.warn("⏰ Token expirado, cerrando sesión automáticamente");
                this.logout();
                return false;
            }
        } catch {
            console.warn("🔑 Token inválido, limpiando sesión");
            this.logout();
            return false;
        }
        return true;
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = "index.html";
            return false;
        }
        // Iniciar gestor de inactividad al entrar a una página protegida
        InactivityManager.start();
        return true;
    },

    // Fetch con manejo automático de 401/403
    async fetchAuth(url, options = {}) {
        const token = this.getToken();
        const mergedOptions = {
            ...options,
            headers: { ...(options.headers || {}), 'Authorization': `Bearer ${token}` }
        };
        let response;
        try {
            response = await fetch(url, mergedOptions);
        } catch (err) {
            console.error("❌ Error de red:", err);
            throw err;
        }
        if (response.status === 401 || response.status === 403) {
            console.warn("🔒 Sesión rechazada por el servidor, redirigiendo al login...");
            this.logout();
            window.location.href = "index.html";
            return null;
        }
        return response;
    }
};

// ─── INACTIVITY MANAGER ───────────────────────────────────────────────────────
//
//  20 minutos de inactividad total:
//    · 18 min → muestra el banner de aviso con cuenta regresiva de 2 min
//    · 20 min → cierra sesión automáticamente
//
//  Actividad detectada: mousemove, mousedown, keydown, scroll, touchstart, click
//  Cualquier actividad reinicia el contador.

const InactivityManager = {

    TOTAL_MS:   20 * 60 * 1000,   // 20 minutos → logout
    WARNING_MS:  2 * 60 * 1000,   // aviso 2 minutos antes del logout

    _logoutTimer:       null,
    _warningTimer:      null,
    _countdownInterval: null,
    _boundActivity:     null,
    _running:           false,

    // ── Iniciar ──────────────────────────────────────────────────────────────
    start() {
        if (this._running) return;   // ya está corriendo
        this._running = true;
        this._injectStyles();
        this._bindActivityEvents();
        this._scheduleTimers();
        console.log('⏱️  Sesión activa — se cerrará tras 20 min de inactividad');
    },

    // ── Detener y limpiar ─────────────────────────────────────────────────────
    stop() {
        this._running = false;
        clearTimeout(this._logoutTimer);
        clearTimeout(this._warningTimer);
        clearInterval(this._countdownInterval);
        this._removeActivityEvents();
        this._removeBanner();
    },

    // ── Programar los dos timers ──────────────────────────────────────────────
    _scheduleTimers() {
        clearTimeout(this._logoutTimer);
        clearTimeout(this._warningTimer);
        clearInterval(this._countdownInterval);
        this._removeBanner();

        // Aviso cuando faltan WARNING_MS para el cierre
        this._warningTimer = setTimeout(() => {
            this._showBanner();
        }, this.TOTAL_MS - this.WARNING_MS);

        // Cierre automático
        this._logoutTimer = setTimeout(() => {
            this._autoLogout();
        }, this.TOTAL_MS);
    },

    // ── Detectar actividad y reiniciar ────────────────────────────────────────
    _onActivity() {
        if (!this._running) return;
        this._scheduleTimers();
    },

    _bindActivityEvents() {
        this._boundActivity = () => this._onActivity();
        ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(ev =>
            document.addEventListener(ev, this._boundActivity, { passive: true })
        );
    },

    _removeActivityEvents() {
        if (!this._boundActivity) return;
        ['mousemove','mousedown','keydown','scroll','touchstart','click'].forEach(ev =>
            document.removeEventListener(ev, this._boundActivity)
        );
        this._boundActivity = null;
    },

    // ── Banner de aviso con cuenta regresiva ──────────────────────────────────
    _showBanner() {
        this._removeBanner();

        let secondsLeft = Math.floor(this.WARNING_MS / 1000);   // 120 s

        const banner = document.createElement('div');
        banner.id = 'inactivity-banner';
        banner.setAttribute('role', 'alert');
        banner.innerHTML = `
            <div class="inactivity-banner__inner">
                <div class="inactivity-banner__message">
                    <span class="inactivity-banner__clock" aria-hidden="true">⏰</span>
                    <p>
                        Tu sesión se cerrará por inactividad en
                        <strong><span id="inactivity-countdown">${secondsLeft}</span> segundos</strong>.
                    </p>
                </div>
                <div class="inactivity-banner__buttons">
                    <button class="inactivity-btn inactivity-btn--keep" id="btnKeepSession">
                        Mantener sesión
                    </button>
                    <button class="inactivity-btn inactivity-btn--logout" id="btnLogoutNow">
                        Cerrar sesión
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        // Animar entrada
        requestAnimationFrame(() => banner.classList.add('inactivity-banner--visible'));

        // Cuenta regresiva
        this._countdownInterval = setInterval(() => {
            secondsLeft = Math.max(0, secondsLeft - 1);
            const el = document.getElementById('inactivity-countdown');
            if (el) el.textContent = secondsLeft;
        }, 1000);

        // Botón: mantener sesión
        document.getElementById('btnKeepSession')?.addEventListener('click', () => {
            this._scheduleTimers();   // reinicia todo
        });

        // Botón: cerrar sesión ahora
        document.getElementById('btnLogoutNow')?.addEventListener('click', () => {
            this._autoLogout();
        });
    },

    _removeBanner() {
        clearInterval(this._countdownInterval);
        this._countdownInterval = null;
        const banner = document.getElementById('inactivity-banner');
        if (!banner) return;
        banner.classList.remove('inactivity-banner--visible');
        // Esperar la transición antes de eliminar del DOM
        setTimeout(() => banner.remove(), 400);
    },

    // ── Cierre automático ─────────────────────────────────────────────────────
    _autoLogout() {
        this.stop();
        sessionStorage.setItem('lumencare_inactivity_logout', '1');
        AuthSystem.logout();
        window.location.href = 'index.html';
    },

    // ── Inyectar CSS del banner dinámicamente ─────────────────────────────────
    _injectStyles() {
        if (document.getElementById('inactivity-styles')) return;   // ya inyectado

        const style = document.createElement('style');
        style.id = 'inactivity-styles';
        style.textContent = `
            #inactivity-banner {
                position: fixed;
                bottom: 0; left: 0; right: 0;
                z-index: 9999;
                padding: 0 1rem 1rem;
                transform: translateY(110%);
                transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                pointer-events: none;
            }
            #inactivity-banner.inactivity-banner--visible {
                transform: translateY(0);
                pointer-events: auto;
            }
            .inactivity-banner__inner {
                max-width: 700px;
                margin: 0 auto;
                background: #1e293b;
                color: #f1f5f9;
                border-radius: 16px;
                padding: 1rem 1.5rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                flex-wrap: wrap;
                box-shadow: 0 -4px 30px rgba(0,0,0,0.25);
                border: 1px solid rgba(255,255,255,0.08);
            }
            .inactivity-banner__message {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                flex: 1;
                min-width: 0;
            }
            .inactivity-banner__clock {
                font-size: 1.5rem;
                flex-shrink: 0;
            }
            .inactivity-banner__message p {
                margin: 0;
                font-size: 0.92rem;
                line-height: 1.5;
                color: #cbd5e1;
            }
            .inactivity-banner__message strong {
                color: #fbbf24;
                font-weight: 700;
            }
            .inactivity-banner__buttons {
                display: flex;
                gap: 0.5rem;
                flex-shrink: 0;
            }
            .inactivity-btn {
                border: none;
                border-radius: 10px;
                padding: 0.55rem 1.1rem;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                transition: opacity 0.2s, transform 0.15s;
                white-space: nowrap;
            }
            .inactivity-btn:hover { opacity: 0.85; transform: scale(0.97); }
            .inactivity-btn--keep   { background: #7c3aed; color: #fff; }
            .inactivity-btn--logout { background: rgba(255,255,255,0.1); color: #94a3b8; }
        `;
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

    createToastContainer() {
        const container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
        return container;
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    },

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    },

    formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleDateString('es-MX', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    },

    debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    animateIn(element, delayMs = 0) {
        element.style.opacity    = '0';
        element.style.transform  = 'translateY(20px)';
        element.style.transition = `opacity 0.4s ease ${delayMs}ms, transform 0.4s ease ${delayMs}ms`;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.opacity   = '1';
                element.style.transform = 'translateY(0)';
            });
        });
    }
};

// ─── EXPORTS GLOBALES ─────────────────────────────────────────────────────────

window.AuthSystem        = AuthSystem;
window.InactivityManager = InactivityManager;
window.DataManager       = DataManager;
window.Utils             = Utils;

// ─── ACTUALIZAR NAV SEGÚN ESTADO DE AUTH ─────────────────────────────────────
// Agrega/quita la clase .user-authenticated del body.
// El CSS usa esa clase para mostrar u ocultar los enlaces de nav protegidos.
// Se llama automáticamente al cargar, al iniciar sesión y al cerrar sesión.

function updateAuthNav() {
    const isAuth = AuthSystem.isAuthenticated();
    document.body.classList.toggle('user-authenticated', isAuth);
}

window.updateAuthNav = updateAuthNav;

// Escuchar el evento personalizado de cambio de auth
window.addEventListener('authStateChanged', updateAuthNav);



// ─── DOM READY ────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {

    // Actualizar nav al cargar la página
    updateAuthNav();

    // ── Mostrar aviso si la sesión anterior se cerró por inactividad ─────────
    if (sessionStorage.getItem('lumencare_inactivity_logout') === '1') {
        sessionStorage.removeItem('lumencare_inactivity_logout');
        // Esperar un momento a que el DOM del índice esté listo
        setTimeout(() => {
            Utils.showToast(
                'Tu sesión se cerró automáticamente por inactividad. Por favor inicia sesión de nuevo.',
                'info',
                6000
            );
        }, 500);
    }

    // ── Lógica del modal de autenticación ────────────────────────────────────
    const authModal         = document.getElementById("authModal");
    const btnLogin          = document.getElementById("btnLogin");
    const btnRegister       = document.getElementById("btnRegister");
    const modalClose        = document.getElementById("modalClose");
    const modalOverlay      = document.querySelector(".modal-overlay");
    const loginContainer    = document.getElementById("loginForm");
    const registerContainer = document.getElementById("registerForm");

    if (!authModal) return;

    if (btnLogin) {
        btnLogin.addEventListener("click", () => {
            authModal.classList.add("active");
            loginContainer?.classList.remove("hidden");
            registerContainer?.classList.add("hidden");
        });
    }

    if (btnRegister) {
        btnRegister.addEventListener("click", () => {
            authModal.classList.add("active");
            registerContainer?.classList.remove("hidden");
            loginContainer?.classList.add("hidden");
        });
    }

    if (modalClose)   modalClose.addEventListener("click",   () => authModal.classList.remove("active"));
    if (modalOverlay) modalOverlay.addEventListener("click", () => authModal.classList.remove("active"));

    const switchToRegister = document.getElementById("switchToRegister");
    const switchToLogin    = document.getElementById("switchToLogin");

    if (switchToRegister) {
        switchToRegister.addEventListener("click", (e) => {
            e.preventDefault();
            loginContainer?.classList.add("hidden");
            registerContainer?.classList.remove("hidden");
        });
    }

    if (switchToLogin) {
        switchToLogin.addEventListener("click", (e) => {
            e.preventDefault();
            registerContainer?.classList.add("hidden");
            loginContainer?.classList.remove("hidden");
        });
    }
});
