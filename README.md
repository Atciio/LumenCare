# LumenCare 💜

> Plataforma de acompañamiento emocional para estudiantes del Instituto Politécnico Nacional

**LumenCare** es una aplicación web full-stack diseñada para apoyar el bienestar emocional de los estudiantes universitarios del IPN. Ofrece un espacio seguro, empático y confidencial donde los alumnos pueden expresar sus emociones, llevar un diario personal, interactuar con una comunidad y recibir acompañamiento a través de un asistente de IA.

> ⚠️ **LumenCare no reemplaza la atención psicológica profesional.** Si estás en crisis llama a la **Línea de la Vida: 800 290 0024** (gratuita, 24h).

---

## Índice

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Base de datos](#base-de-datos)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [API Endpoints](#api-endpoints)
- [Seguridad](#seguridad)
- [Despliegue](#despliegue)
- [Recursos de emergencia](#recursos-de-emergencia)

---

## Características

### Para alumnos
- **Diario emocional** — Registra entradas con hasta 2 estados de ánimo simultáneos (10 emociones disponibles). La fecha se guarda en hora local para evitar desfases UTC.
- **Calendario emocional** — Visualización mensual con puntos de color según el estado de ánimo registrado cada día.
- **Agenda personal** — Agrega y gestiona eventos directamente en el calendario.
- **Foro comunitario** — Lee publicaciones de profesionales de salud, comenta y da likes.
- **Asistente IA** — Chat de acompañamiento emocional powered by Groq (Llama 3.1), con historial persistente de conversaciones y personalización por usuario.
- **Mi Profesional** — Visualiza el profesional asignado y puede desvincularse cuando lo desee.

### Para profesionales
- **Panel de pacientes** — Gestión de alumnos asignados con visualización de su último estado emocional.
- **Calendario del paciente** — Vista del historial emocional del alumno (solo puntos de color, sin acceso al texto).
- **Notas de consulta** — CRUD completo de notas clínicas por paciente, con número de cita autoincrementado.
- **Resumen IA** — Genera automáticamente un resumen del estado emocional del paciente basado en su diario y conversaciones, usando Groq. No se guarda en BD.
- **Publicaciones en foro** — Solo los profesionales pueden crear publicaciones con imágenes opcionales (Cloudinary).

### Sistema de cuentas
- Dos tipos de cuenta: **Alumno** y **Profesional**
- Login unificado que detecta automáticamente el tipo de cuenta
- Redirección inteligente post-login según rol
- Navegación diferenciada (alumnos: Inicio, Mi Diario, Comunidad, Asistente / profesionales: Inicio, Mis Pacientes, Comunidad)
- Cierre automático de sesión por inactividad (20 minutos)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Vanilla JS + HTML5 + CSS3 |
| Backend | Node.js + Express |
| Base de datos | MariaDB / MySQL |
| Autenticación | JWT (8h) + bcrypt (12 rondas) |
| IA / Chatbot | Groq API — Llama 3.1 8b Instant |
| Imágenes | Cloudinary (Unsigned preset) |
| Despliegue | Railway |

---

## Arquitectura

```
lumencare/
├── Server.js                  # API REST completa (Express)
├── bot.js                     # Bot de respaldo (sin IA, basado en reglas)
├── package.json
├── .env                       # Variables de entorno (no se sube a git)
│
├── index.html                 # Landing + modal de login/registro dual
├── diario.html                # Diario emocional + calendario + agenda
├── foro.html                  # Foro comunitario
├── chatbot.html               # Asistente IA
├── profesional.html           # Panel del profesional
│
├── css/
│   ├── global.css             # Estilos globales, nav, variables
│   ├── home.css               # Estilos landing
│   ├── diario.css             # Estilos diario y calendario
│   ├── foro.css               # Estilos foro
│   ├── chatbot.css            # Estilos chat
│   └── profesional.css        # Estilos panel profesional
│
└── js/
    ├── auth-system.js         # AuthSystem, InactivityManager, nav dinámico
    ├── home.js                # Login, registro, redirección por rol
    ├── diario.js              # Diario, calendario, agenda, mi-profesional
    ├── foro.js                # Foro, Cloudinary, mood-sorting
    ├── chatbot.js             # Chat UI, historial, integración Groq
    └── profesional.js         # Panel profesional, pacientes, notas, resumen IA
```

---

## Base de datos

### Tablas

```sql
-- Alumnos
usuarios            (boleta PK, nombre, apellidos, telefono, correo UNIQUE, contrasena)

-- Profesionales de salud
profesionales       (cedula PK, nombre, apellidos, especialidad, telefono, correo UNIQUE, contrasena)

-- Relación alumno-profesional (un alumno solo puede tener un profesional)
pacientes           (id_relacion PK, cedula_profesional FK, boleta_alumno FK UNIQUE)

-- Diario emocional
diario              (id_diario PK, boleta FK, registro_diario, sentimiento_predominante,
                     sentimiento_secundario NULL, fecha_registro TIMESTAMP)

-- Foro comunitario (publicado solo por profesionales)
foro                (id_post PK, boleta, tipo_autor, nombre_autor, avatar_autor,
                     titulo, categoria, contenido, imagen_url NULL, fecha_post)

-- Comentarios del foro (solo alumnos)
comentarios         (id_comentario PK, id_post FK, boleta FK, nombre_autor,
                     avatar_autor, contenido, fecha_comentario)

-- Likes del foro (solo alumnos, UNIQUE por post+boleta)
likes_foro          (id_like PK, id_post FK, boleta FK)

-- Agenda personal del alumno
agenda              (id_agenda PK, boleta FK, titulo, descripcion NULL,
                     fecha_evento DATE)

-- Historial de conversaciones del asistente
conversaciones      (id_conversacion PK, boleta FK, titulo, fecha_creacion, fecha_update)
mensajes            (id_mensaje PK, id_conversacion FK, rol ENUM(user/bot),
                     contenido, fecha_mensaje)

-- Notas de consulta del profesional
notas_consulta      (id_nota PK, cedula_profesional FK, boleta_alumno FK,
                     numero_cita INT, nota TEXT, fecha_consulta DATE, fecha_creacion)

-- Preferencias del asistente IA (nombre y edad del usuario)
preferencias_chat   (boleta PK FK, nombre_chat VARCHAR(50), edad INT, fecha_update)

-- Lista negra de tokens (cierre de sesión real)
tokens_revocados    (id PK, token_hash VARCHAR(64) UNIQUE, expira_en DATETIME)
```

---

## Instalación local

### Requisitos
- Node.js 18+
- MariaDB o MySQL 8+

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Atciio/LumenCare.git
cd LumenCare

# 2. Instalar dependencias
npm install

# 3. Crear base de datos local
# Ejecutar el SQL de creación de tablas en tu MariaDB/MySQL

# 4. Configurar variables de entorno
cp _env .env
# Editar .env con tus datos locales

# 5. Iniciar el servidor
npm start
# → http://localhost:3030
```

---

## Variables de entorno

```env
# Base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=logindb
DB_PORT=3306

# JWT
JWT_SECRET=clave_secreta_minimo_32_caracteres

# Entorno
NODE_ENV=development
PORT=3030

# Groq AI (obtener en console.groq.com)
GROQ_API_KEY=gsk_...

# Cloudinary (para imágenes del foro)
# No se necesita en .env — el preset es Unsigned y se configura en foro.js
```

---

## API Endpoints

### Autenticación
```
POST /api/register                          Registro de alumno
POST /api/profesionales/register            Registro de profesional
POST /api/login                             Login unificado (alumno + profesional)
POST /api/logout                            Cierre de sesión (revoca token en BD)
```

### Diario y Agenda
```
GET    /api/diario                          Entradas del diario del alumno
POST   /api/diario                          Nueva entrada
PUT    /api/diario/:id                      Editar entrada
DELETE /api/diario/:id                      Eliminar entrada
GET    /api/diario/calendario?mes=YYYY-MM   Datos del calendario mensual

GET    /api/agenda?mes=YYYY-MM              Eventos de agenda
POST   /api/agenda                          Nuevo evento
DELETE /api/agenda/:id                      Eliminar evento
```

### Foro
```
GET    /api/foro                            Listado de posts (con likes y comentarios)
POST   /api/foro                            Crear post (solo profesionales)
DELETE /api/foro/:id                        Eliminar post (solo el autor)
POST   /api/foro/:id/like                   Toggle like (solo alumnos)
GET    /api/foro/:id/comentarios            Comentarios de un post
POST   /api/foro/:id/comentarios            Agregar comentario (solo alumnos)
```

### Panel del profesional
```
GET    /api/profesionales/pacientes                          Lista de pacientes
GET    /api/profesionales/buscar-alumno?q=                   Buscar alumno por boleta/correo
POST   /api/profesionales/pacientes                          Asignar paciente
DELETE /api/profesionales/pacientes/:boleta                  Desasignar paciente
GET    /api/profesionales/pacientes/:boleta/calendario       Calendario emocional del paciente
GET    /api/profesionales/pacientes/:boleta/notas            Notas de consulta
POST   /api/profesionales/pacientes/:boleta/notas            Nueva nota
PUT    /api/profesionales/notas/:id                          Editar nota
DELETE /api/profesionales/notas/:id                          Eliminar nota
GET    /api/profesionales/pacientes/:boleta/resumen          Resumen IA del paciente (Groq)
```

### Alumno
```
GET    /api/alumno/mi-profesional           Profesional asignado
DELETE /api/alumno/mi-profesional           Desvincularse del profesional
GET    /api/alumno/ultimo-mood              Último estado de ánimo registrado
```

### Asistente IA
```
GET    /api/conversaciones                  Historial de conversaciones
POST   /api/conversaciones                  Nueva conversación
PUT    /api/conversaciones/:id              Renombrar conversación
DELETE /api/conversaciones/:id              Eliminar conversación
GET    /api/conversaciones/:id/mensajes     Mensajes de una conversación
POST   /api/conversaciones/:id/mensajes     Guardar mensaje
POST   /api/chat/bot                        Enviar mensaje al asistente IA (Groq)
GET    /api/chat/status                     Estado de la conexión con Groq
```

---

## Seguridad

### Implementado
- **JWT** con expiración de 8h y verificación en cada request
- **Lista negra de tokens** — el logout revoca el token en la BD (hash SHA-256), invalidándolo aunque no haya expirado
- **bcrypt** con 12 rondas para almacenamiento de contraseñas
- **Rate limiting** — 10 intentos de login / 15 min · 200 requests generales / 15 min
- **Helmet.js** para headers HTTP seguros
- **Verificación de ownership** en todos los endpoints (no puedes acceder a datos de otro usuario)
- **CORS** configurado
- **Validación de URLs de Cloudinary** — solo se aceptan URLs del dominio oficial
- **Cierre automático por inactividad** — banner a los 18 min, logout a los 20 min

### Roles y restricciones
- Los **profesionales** no pueden usar el diario ni el asistente
- Solo los **profesionales** pueden publicar en el foro
- Solo los **alumnos** pueden comentar, dar likes y usar el chat
- Un alumno solo puede tener **un** profesional asignado
- El profesional solo ve el **calendario** del paciente (no el texto de las entradas)

---

## Asistente IA

El asistente usa **Groq API con Llama 3.1 8b Instant** como motor principal, con `bot.js` como fallback automático si Groq no está disponible.

### Características
- Pide nombre y edad en la primera conversación y los recuerda permanentemente
- Historial de conversación persistente en BD (tabla `mensajes`)
- Contexto del último estado emocional del diario
- Preferencias guardadas en `preferencias_chat` para personalización entre sesiones
- Directorio oficial de líneas de ayuda (crisis, violencia, emergencias)
- Prohibición estricta de inventar datos de contacto

### Directorio de emergencias integrado
| Situación | Línea | Disponibilidad |
|---|---|---|
| Crisis / suicidio | Línea de la Vida: 800 290 0024 | 24h gratuita |
| Violencia / abuso | CNDH: 800 202 0068 | 24h gratuita |
| Violencia de género | INMUJERES: 800 911 2511 | 24h gratuita |
| Violencia en CDMX | Línea Mujeres: 55 5658 1111 | 24h gratuita |
| Crisis emocional | SAPTEL: 55 5259 8121 | 24h |
| Emergencia | 911 | 24h |

---

## Despliegue

El proyecto está desplegado en **Railway**:

🌐 https://lumencare-copy-production.up.railway.app

### Variables necesarias en Railway
Todas las de la sección [Variables de entorno](#variables-de-entorno) más:
```env
DB_HOST=     # Host de Railway MySQL
DB_NAME=railway
NODE_ENV=production
APP_URL=https://lumencare-copy-production.up.railway.app
```

---

## Recursos de emergencia

Si eres estudiante y estás pasando por un momento difícil:

📞 **Línea de la Vida:** 800 290 0024 — Gratuita, 24 horas, confidencial  
📞 **SAPTEL:** 55 5259 8121 — Apoyo emocional, 24 horas  
📞 **CNDH:** 800 202 0068 — Derechos humanos y violencia, 24 horas  
📞 **Emergencias:** 911  

---

## Acerca del proyecto

Proyecto Terminal — Instituto Politécnico Nacional (IPN)  
Unidad: UPIICSA  
Stack: Node.js + Express + MariaDB + Vanilla JS  
IA: Groq API (Llama 3.1 8b Instant)  
Año: 2025-2026

---

*LumenCare — Iluminando el camino hacia el bienestar emocional* ✨
