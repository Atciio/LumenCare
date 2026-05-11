# LumenCare - Plataforma de Acompañamiento Emocional
## Documentación Técnica Completa

---

## 📋 Descripción del Proyecto

LumenCare es una plataforma web de acompañamiento psicológico para estudiantes universitarios. Proporciona un espacio seguro de escucha activa con enfoque en estrés, ansiedad y depresión.

**IMPORTANTE**: Esta plataforma NO sustituye la terapia profesional. Es una herramienta complementaria de acompañamiento emocional.

---

## 🏗️ Arquitectura del Sistema

### Estructura de Archivos

```
lumencare/
├── index.html                 # Página principal
├── diario.html               # Página del diario personal
├── foro.html                 # Página del foro comunitario
├── css/
│   ├── global.css           # Estilos compartidos
│   ├── home.css             # Estilos de la página principal
│   ├── diario.css           # Estilos del diario
│   └── foro.css             # Estilos del foro
├── js/
│   ├── auth-system.js       # Sistema de autenticación y datos
│   ├── home.js              # Lógica de la página principal
│   ├── diario.js            # Lógica del diario
│   └── foro.js              # Lógica del foro
└── images/                   # (Opcional) Imágenes y recursos
```

---

## 💾 Sistema de Persistencia de Datos

### LocalStorage como Base de Datos Simulada

La plataforma utiliza **LocalStorage** del navegador como sistema de almacenamiento persistente. Los datos se organizan en colecciones con prefijo `lumencare_`:

#### Colecciones de Datos:

1. **`lumencare_users`** - Array de usuarios registrados
   ```javascript
   [
     {
       id: "user_1234567890_abc123",
       name: "María González",
       email: "maria.gonzalez@universidad.edu",
       password: "YWJjMTIzbHVtZW5jYXJlX3NlY3VyaXR5X3NhbHRfMjAyNA==",
       createdAt: "2024-02-14T12:00:00.000Z",
       avatar: "MG"
     }
   ]
   ```

2. **`lumencare_session`** - Sesión activa del usuario
   ```javascript
   {
     userId: "user_1234567890_abc123",
     name: "María González",
     email: "maria.gonzalez@universidad.edu",
     avatar: "MG",
     loginAt: "2024-02-14T14:30:00.000Z"
   }
   ```

3. **`lumencare_diaries`** - Entradas del diario (PRIVADAS)
   ```javascript
   [
     {
       id: "entry_1234567890_xyz789",
       userId: "user_1234567890_abc123",  // ← CRÍTICO para privacidad
       title: "Día difícil de exámenes",
       mood: "bad",
       content: "Hoy fue un día muy estresante...",
       createdAt: "2024-02-14T15:00:00.000Z",
       updatedAt: "2024-02-14T15:00:00.000Z"
     }
   ]
   ```

4. **`lumencare_forum_posts`** - Publicaciones del foro (PÚBLICAS)
   ```javascript
   [
     {
       id: "post_1234567890_abc456",
       userId: "user_1234567890_abc123",
       userName: "María González",
       userAvatar: "MG",
       title: "Consejos para manejar el estrés",
       category: "stress",
       content: "Quiero compartir lo que me ha funcionado...",
       likes: ["user_9876543210_def789"],
       comments: [
         {
           id: "comment_1234567890_xyz123",
           userId: "user_9876543210_def789",
           userName: "Juan Pérez",
           userAvatar: "JP",
           content: "¡Excelente consejo!",
           createdAt: "2024-02-14T16:00:00.000Z"
         }
       ],
       createdAt: "2024-02-14T15:30:00.000Z"
     }
   ]
   ```

### Funciones de Gestión de Datos

El módulo `DataManager` en `auth-system.js` proporciona:

```javascript
// Guardar datos
DataManager.save('users', arrayDeUsuarios);

// Obtener datos
const usuarios = DataManager.get('users', []);

// Eliminar datos
DataManager.remove('session');

// Limpiar todo
DataManager.clearAll();
```

---

## 🔐 Sistema de Autenticación

### Flujo de Autenticación

1. **Registro**:
   - Usuario proporciona: nombre, correo institucional (.edu), contraseña
   - Sistema valida formato de correo institucional
   - Contraseña se hashea (Base64 + salt)
   - Se crea objeto de usuario y se guarda en `lumencare_users`

2. **Login**:
   - Usuario proporciona: correo, contraseña
   - Sistema busca usuario en `lumencare_users`
   - Verifica contraseña hasheada
   - Si es correcto, crea sesión en `lumencare_session`

3. **Sesión Activa**:
   - Cada página verifica `lumencare_session` al cargar
   - Si no hay sesión, redirige a `index.html`
   - Si hay sesión, muestra UI con información del usuario

4. **Logout**:
   - Elimina `lumencare_session`
   - Mantiene `lumencare_users` y datos del usuario
   - Redirige a `index.html`

### Seguridad Implementada

**NOTA IMPORTANTE**: Esta es una implementación educativa. En producción se debe usar:
- Backend con Node.js/Express
- Base de datos real (PostgreSQL/MongoDB)
- bcrypt para hash de contraseñas
- JWT tokens para sesiones
- HTTPS obligatorio

---

## 🔒 Privacidad Estricta del Diario

### Implementación de Privacidad

El diario personal implementa **privacidad estricta por usuario**:

#### 1. Al Crear Entrada:
```javascript
const newEntry = {
    id: Utils.generateId(),
    userId: currentUser.userId, // ← Asocia al usuario actual
    title,
    mood,
    content,
    createdAt: new Date().toISOString()
};
```

#### 2. Al Cargar Entradas:
```javascript
function loadUserEntries() {
    const allEntries = DataManager.get('diaries', []);
    
    // ← CRÍTICO: Filtrar SOLO entradas del usuario actual
    let userEntries = allEntries.filter(
        entry => entry.userId === currentUser.userId
    );
    
    // Aplicar filtros adicionales...
    renderEntries(userEntries);
}
```

#### 3. Al Editar/Eliminar:
```javascript
function updateEntry(entryId, ...) {
    const entries = DataManager.get('diaries', []);
    const entry = entries.find(e => e.id === entryId);
    
    // ← SEGURIDAD: Verificar propiedad
    if (entry.userId !== currentUser.userId) {
        Utils.showToast('No tienes permiso', 'error');
        return;
    }
    
    // Proceder con actualización...
}
```

### Garantías de Privacidad:

✅ Usuario 1 **SOLO** ve sus propias entradas
✅ Usuario 2 **NUNCA** puede ver entradas de Usuario 1
✅ Los filtros y búsquedas operan solo sobre entradas propias
✅ Verificación de propiedad en todas las operaciones

---

## 🌐 Foro Comunitario (Público)

### Diferencias con el Diario

El foro es **público entre usuarios autenticados**:

- ✅ Cualquier usuario puede ver todas las publicaciones
- ✅ Usuarios pueden dar "like" a publicaciones
- ✅ Usuarios pueden comentar en publicaciones
- ❌ El foro **NUNCA** muestra contenido del diario personal

### Separación de Datos

```javascript
// DIARIO: Datos privados por usuario
DataManager.get('diaries', []).filter(e => e.userId === currentUser.userId);

// FORO: Datos públicos para todos
DataManager.get('forum_posts', []); // Sin filtro de usuario
```

---

## 🎨 Decisiones de Diseño

### Paleta de Colores Terapéuticos

```css
--color-primary: #6B7FD7;      /* Azul calmante */
--color-secondary: #7BC9A6;    /* Verde natural */
--color-accent: #FF9B9B;       /* Coral suave */
--color-warning: #FFB84D;      /* Naranja cálido */
```

**Justificación**: Colores suaves que transmiten calma, confianza y calidez.

### Tipografía

```css
--font-display: 'Playfair Display', serif;  /* Títulos elegantes */
--font-body: 'Manrope', sans-serif;        /* Texto legible */
```

**Justificación**: Playfair Display aporta elegancia y seriedad, mientras que Manrope ofrece excelente legibilidad para contenido.

### Animaciones

- **Entrada gradual**: `fadeInUp` para elementos al cargar
- **Hover interactivo**: `transform: translateY(-8px)` para tarjetas
- **Float sutil**: `animation: float 3s` para elementos decorativos

**Justificación**: Animaciones sutiles que mejoran UX sin distraer.

---

## 📱 Responsive Design

La plataforma es completamente responsive:

```css
@media (max-width: 768px) {
    /* Adaptaciones para tablet */
}

@media (max-width: 480px) {
    /* Adaptaciones para móvil */
}
```

**Breakpoints**:
- Desktop: > 1024px
- Tablet: 768px - 1024px
- Móvil: < 768px

---

## 🚀 Instalación y Uso

### Instalación

1. Descarga todos los archivos del proyecto
2. Mantén la estructura de carpetas intacta
3. Abre `index.html` en un navegador moderno

**No requiere servidor** - Funciona directamente desde archivos locales.

### Navegadores Soportados

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Uso

1. **Registro**: Click en "Registrarse" → Completa formulario con correo .edu
2. **Login**: Ingresa con tu correo y contraseña
3. **Navegación**:
   - **Inicio**: Recursos y actividades de bienestar
   - **Mi Diario**: Escribe entradas privadas
   - **Comunidad**: Participa en el foro

---

## 🧪 Pruebas de Privacidad

### Prueba de Usuario 1 vs Usuario 2:

1. Registra Usuario 1 (usuario1@universidad.edu)
2. Crea 3 entradas en el diario
3. Cierra sesión
4. Registra Usuario 2 (usuario2@universidad.edu)
5. Ve al diario → **Debe estar vacío**
6. Crea 2 entradas en el diario de Usuario 2
7. Cierra sesión e inicia con Usuario 1
8. Ve al diario → **Solo debe ver sus 3 entradas originales**

**✅ Si esto funciona, la privacidad es correcta**

---

## 🔧 Decisiones Técnicas Clave

### 1. LocalStorage vs Backend

**Decisión**: LocalStorage
**Justificación**:
- ✅ Proyecto académico/prototipo
- ✅ No requiere servidor
- ✅ Funciona offline
- ✅ Fácil de demostrar
- ❌ En producción: usar backend real

### 2. Vanilla JavaScript vs Frameworks

**Decisión**: Vanilla JS (ES6+)
**Justificación**:
- ✅ Cumple requisitos del proyecto
- ✅ No hay dependencias externas
- ✅ Control total del código
- ✅ Mejor para aprendizaje

### 3. Páginas HTML Independientes vs SPA Total

**Decisión**: Páginas HTML separadas
**Justificación**:
- ✅ Facilita navegación y debugging
- ✅ Código más modular
- ✅ Mejor separación de responsabilidades
- ✅ URLs claras (diario.html, foro.html)

### 4. CSS Variables

**Decisión**: Usar CSS Custom Properties
**Justificación**:
- ✅ Mantenimiento centralizado
- ✅ Temas consistentes
- ✅ Fácil de modificar

---

## 🎯 Características Implementadas

### ✅ Completadas

- [x] Sistema de registro y autenticación
- [x] Persistencia de datos en LocalStorage
- [x] Diario personal 100% privado por usuario
- [x] Foro comunitario con likes y comentarios
- [x] Diseño responsivo
- [x] Animaciones interactivas
- [x] Navegación entre páginas
- [x] Filtros y búsqueda en diario
- [x] Categorización de publicaciones en foro
- [x] Sistema de notificaciones Toast
- [x] Validación de formularios
- [x] Protección de rutas privadas

### 🔮 Mejoras Futuras Sugeridas

- [ ] Backend con Node.js + Express
- [ ] Base de datos PostgreSQL/MongoDB
- [ ] Autenticación OAuth 2.0
- [ ] Integración con IA real para chat
- [ ] Encriptación end-to-end
- [ ] Exportar entradas del diario (PDF)
- [ ] Notificaciones push
- [ ] PWA (Progressive Web App)
- [ ] Testing automatizado

---

## 📚 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Estilos modernos con variables, flexbox, grid
- **JavaScript ES6+**: Clases, arrow functions, template literals
- **LocalStorage API**: Persistencia de datos
- **Google Fonts**: Tipografía personalizada

---

## 🤝 Uso Académico

Este proyecto es ideal para:
- ✅ Proyectos terminales de programación web
- ✅ Demostración de conceptos de frontend
- ✅ Estudio de arquitectura de aplicaciones web
- ✅ Aprendizaje de UX/UI en plataformas de salud

---

## ⚠️ Limitaciones y Consideraciones

### Seguridad

- ⚠️ Las contraseñas usan hash simple (NO usar en producción)
- ⚠️ Los datos están en texto plano en LocalStorage
- ⚠️ No hay protección contra XSS avanzado
- ⚠️ No hay rate limiting

### Escalabilidad

- ⚠️ LocalStorage tiene límite de ~5-10MB
- ⚠️ No soporta usuarios concurrentes
- ⚠️ No hay sincronización entre dispositivos

### Funcionalidad

- ⚠️ El chat usa respuestas predefinidas (no IA real)
- ⚠️ Las actividades de bienestar son placeholders
- ⚠️ No hay moderación automática en el foro

---

## 📞 Recursos de Emergencia

**IMPORTANTE**: Siempre recordar a los usuarios:

- Línea de la Vida (México): 800 911 2000
- SAPTEL (México): (55) 5259-8121
- Emergencias: 911
- Servicios de salud mental universitarios

---

## 👨‍💻 Desarrollo

**Proyecto desarrollado para fines educativos**

Fecha: Febrero 2024
Stack: HTML5 + CSS3 + JavaScript ES6
Propósito: Proyecto Terminal Académico

---

**LumenCare - Iluminando el camino hacia el bienestar emocional** ✨
