# RESUMEN EJECUTIVO TÉCNICO - LUMENCARE

## 🎯 Arquitectura del Sistema

### Navegación entre Páginas

```
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│  index.html │ ────▶ │ diario.html  │       │  foro.html   │
│  (Inicio)   │       │  (Privado)   │       │  (Público)   │
└─────────────┘       └──────────────┘       └──────────────┘
       │                      │                      │
       └──────────────────────┴──────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  auth-system.js   │
                    │  (Autenticación)  │
                    └───────────────────┘
```

### Sistema de Persistencia de Datos

**ARQUITECTURA DE LOCALSTORAGE:**

```javascript
localStorage:
  ├─ lumencare_users          → [Array de usuarios]
  ├─ lumencare_session        → {Usuario autenticado}
  ├─ lumencare_diaries        → [Array de entradas PRIVADAS]
  └─ lumencare_forum_posts    → [Array de posts PÚBLICOS]
```

**FLUJO DE PRIVACIDAD DEL DIARIO:**

```
Usuario 1 crea entrada
        ↓
{ id, userId: "user_123", content: "..." }
        ↓
Guardado en lumencare_diaries
        ↓
Al cargar: FILTRAR entries.filter(e => e.userId === currentUser.userId)
        ↓
Usuario 1 ve SOLO sus entradas
Usuario 2 ve SOLO sus entradas
```

## 🔐 Seguridad y Validaciones

### Registro
```
1. Validar correo institucional (.edu)
2. Validar longitud de contraseña (≥6)
3. Hash contraseña (Base64 + salt)
4. Generar userId único
5. Guardar en lumencare_users
```

### Login
```
1. Buscar usuario por email
2. Verificar hash de contraseña
3. Crear sesión en lumencare_session
4. Actualizar UI con datos de usuario
```

### Protección de Rutas
```javascript
// En diario.html y foro.html
if (!AuthSystem.requireAuth()) {
    window.location.href = 'index.html'; // Redirige si no autenticado
    return;
}
```

## 📊 Flujo de Datos Completo

### Crear Entrada de Diario

```
1. Usuario autenticado va a diario.html
2. Click en "Nueva entrada"
3. Llena formulario (título, mood, contenido)
4. Submit → handleSaveEntry()
5. Crea objeto:
   {
     id: generateId(),
     userId: currentUser.userId,  ← CRÍTICO
     title, mood, content,
     createdAt: new Date()
   }
6. Obtiene array: DataManager.get('diaries', [])
7. Agrega nueva entrada: entries.unshift(newEntry)
8. Guarda: DataManager.save('diaries', entries)
9. Recarga entradas filtradas por userId
```

### Crear Publicación en Foro

```
1. Usuario autenticado va a foro.html
2. Click en "Nueva publicación"
3. Llena formulario (título, categoría, contenido)
4. Submit → handleCreatePost()
5. Crea objeto:
   {
     id: generateId(),
     userId, userName, userAvatar,
     title, category, content,
     likes: [], comments: [],
     createdAt: new Date()
   }
6. Obtiene: DataManager.get('forum_posts', [])
7. Agrega: posts.unshift(newPost)
8. Guarda: DataManager.save('forum_posts', posts)
9. Recarga TODAS las publicaciones (SIN filtro userId)
```

## 🎨 Interactividad Implementada

### Animaciones CSS
```css
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
}
```

### Efectos Hover
```css
.card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-xl);
}
```

### Notificaciones Toast
```javascript
Utils.showToast('Mensaje', 'success');
// Aparece en esquina superior derecha
// Auto-desaparece en 3 segundos
```

## 🔄 Sincronización de Estado

**Actualización de UI:**
```javascript
// Cuando cambia sesión:
function updateAuthUI() {
    const session = AuthSystem.getSession();
    if (session) {
        // Mostrar info de usuario
        userInfo.show();
        authButtons.hide();
        userName.text = session.name;
        userAvatar.text = session.avatar;
    } else {
        // Mostrar botones de auth
        userInfo.hide();
        authButtons.show();
    }
}
```

## 📱 Responsive Breakpoints

```css
/* Desktop: Default */
@media (max-width: 1024px) { /* Tablet */ }
@media (max-width: 768px)  { /* Móvil */ }
@media (max-width: 480px)  { /* Móvil pequeño */ }
```

## 🧪 Pruebas de Funcionalidad

### Test 1: Privacidad del Diario
```
✓ Usuario A crea 3 entradas
✓ Logout → Login como Usuario B
✓ Verificar diario vacío para Usuario B
✓ Usuario B crea 2 entradas
✓ Logout → Login como Usuario A
✓ Verificar que Usuario A ve solo sus 3 entradas
```

### Test 2: Foro Público
```
✓ Usuario A crea publicación
✓ Logout → Login como Usuario B
✓ Verificar que Usuario B ve publicación de A
✓ Usuario B da like y comenta
✓ Logout → Login como Usuario A
✓ Verificar que A ve like y comentario de B
```

### Test 3: Persistencia
```
✓ Usuario A crea 5 entradas en diario
✓ Cierra navegador completamente
✓ Abre navegador → Navega a diario.html
✓ Verificar que las 5 entradas persisten
```

## 🚀 Despliegue

### Requisitos Mínimos
- Navegador moderno (Chrome 90+, Firefox 88+, Safari 14+)
- Conexión a internet (para cargar Google Fonts)
- LocalStorage habilitado

### Instalación
```bash
1. Descargar carpeta lumencare/
2. Abrir index.html en navegador
3. ¡Listo! No requiere servidor
```

### Estructura de Archivos Requerida
```
lumencare/
├── index.html
├── diario.html
├── foro.html
├── css/
│   ├── global.css
│   ├── home.css
│   ├── diario.css
│   └── foro.css
└── js/
    ├── auth-system.js
    ├── home.js
    ├── diario.js
    └── foro.js
```

## 💡 Explicación para Presentación

**"¿Cómo funciona la privacidad del diario?"**
> Cada entrada de diario tiene un campo `userId` que la asocia al usuario que la creó. Al cargar las entradas, filtramos el array completo para mostrar SOLO las que tienen el `userId` del usuario actual. Así, aunque todos los datos están en LocalStorage, cada usuario solo ve lo suyo.

**"¿Cómo se guardan los datos?"**
> Usamos LocalStorage como base de datos simulada. Cada colección (users, diaries, forum_posts) se guarda como un array en formato JSON. Al modificar datos, obtenemos el array, lo modificamos en JavaScript, y lo volvemos a guardar.

**"¿Por qué páginas HTML separadas?"**
> Facilita la navegación, permite URLs claras, y hace que el código sea más modular y fácil de mantener. Cada página es independiente pero comparte el sistema de autenticación.

**"¿Qué pasa con la seguridad?"**
> Esta es una implementación educativa. En producción usaríamos un backend real con Node.js, base de datos PostgreSQL, bcrypt para contraseñas, y autenticación JWT.

---

## 📈 Métricas del Proyecto

- **Líneas de código**: ~3,500+
- **Archivos HTML**: 3
- **Archivos CSS**: 4
- **Archivos JS**: 4
- **Funcionalidades**: 15+
- **Animaciones**: 10+

---

**Proyecto academico completamente funcional y listo para presentación** ✅
