require("dotenv").config({ override: false });
const express      = require("express");
const mysql        = require("mysql2/promise");
const path         = require("path");
const bcrypt       = require("bcrypt");
const cors         = require("cors");
const jwt          = require("jsonwebtoken");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");
const compression  = require("compression");

const app = express();
const IS_PROD = process.env.NODE_ENV === "production";

// ─── SEGURIDAD ────────────────────────────────────────────────────────────────

// Cabeceras de seguridad HTTP (clickjacking, XSS, MIME sniffing, etc.)
app.use(helmet({
  contentSecurityPolicy: false   // desactivar CSP para no romper las fuentes de Google
}));

// Compresión gzip — respuestas más ligeras
app.use(compression());

// CORS — en producción solo acepta peticiones del propio dominio
const allowedOrigins = IS_PROD
  ? [process.env.APP_URL || "https://tu-app.railway.app"]
  : ["http://localhost:3030", "http://127.0.0.1:3030"];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir peticiones sin origen (Postman, curl) solo en desarrollo
    if (!origin && !IS_PROD) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("CORS: origen no permitido"));
  },
  credentials: true
}));

// Confiar en el proxy de Railway/Render para leer la IP real
app.set("trust proxy", 1);

// Rate limit general — 200 peticiones por 15 minutos por IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Demasiadas peticiones, intenta más tarde" }
}));

// Rate limit estricto para login/register — 10 intentos por 15 minutos
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Demasiados intentos. Espera 15 minutos antes de intentarlo de nuevo." }
});

app.use(express.json({ limit: "1mb" }));   // límite de tamaño en requests

// ─── ARCHIVOS ESTÁTICOS ───────────────────────────────────────────────────────

app.use("/css", express.static(path.join(__dirname, "../CSS")));
app.use("/js",  express.static(path.join(__dirname, "../js")));
app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../index.html")));

// ─── MARIADB / MYSQL ──────────────────────────────────────────────────────────

const db = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  port:               process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit:    10
});

(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ Conectado a MariaDB/MySQL correctamente");
    conn.release();
  } catch (err) {
    console.error("❌ Error conectando a la BD:", err.message);
    if (IS_PROD) process.exit(1);   // en producción, no arrancar sin BD
  }
})();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("⚠️  JWT_SECRET no está definido o es muy corto (mínimo 32 caracteres)");
  if (IS_PROD) process.exit(1);
}

const MOODS_VALIDOS = [
  "euforico","contento","tranquilo","neutral",
  "ansioso","frustrado","triste","solitario","agobiado","desesperado"
];

// ─── MIDDLEWARE DE AUTH ───────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, message: "Token requerido" });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return res.status(403).json({ success: false, message: "Tu sesión expiró, inicia sesión de nuevo" });
    console.warn("🔑 Token inválido:", err.message);
    return res.status(403).json({ success: false, message: "Token inválido" });
  }
}

// ─── AUTH (con rate limit estricto) ──────────────────────────────────────────

app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const { boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena } = req.body;

    if (!boleta || !nombre || !apellido_paterno || !apellido_materno || !correo || !contrasena)
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });

    // Validaciones básicas de formato
    if (contrasena.length < 8)
      return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 8 caracteres" });

    const [ec] = await db.query("SELECT boleta FROM usuarios WHERE correo = ?", [correo]);
    if (ec.length > 0) return res.status(409).json({ success: false, message: "Este correo ya está registrado" });

    const [eb] = await db.query("SELECT boleta FROM usuarios WHERE boleta = ?", [boleta]);
    if (eb.length > 0) return res.status(409).json({ success: false, message: "Esta boleta ya está registrada" });

    const hash = await bcrypt.hash(contrasena, 12);   // 12 rondas en producción
    await db.query(
      `INSERT INTO usuarios (boleta,nombre,apellido_paterno,apellido_materno,telefono,correo,contrasena)
       VALUES (?,?,?,?,?,?,?)`,
      [boleta, nombre.trim(), apellido_paterno.trim(), apellido_materno.trim(), telefono || null, correo.toLowerCase().trim(), hash]
    );

    console.log(`✅ Nuevo usuario registrado: ${boleta}`);
    return res.json({ success: true, message: "Usuario registrado correctamente" });
  } catch (err) {
    console.error("❌ /api/register:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena)
      return res.status(400).json({ success: false, message: "Correo y contraseña requeridos" });

    const [users] = await db.query("SELECT * FROM usuarios WHERE correo = ?", [correo.toLowerCase().trim()]);
    if (users.length === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    const user = users[0];
    if (!await bcrypt.compare(contrasena, user.contrasena))
      return res.status(401).json({ success: false, message: "Contraseña incorrecta" });

    const token = jwt.sign(
      { boleta: user.boleta, correo: user.correo },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    console.log(`✅ Login: ${user.boleta}`);
    return res.json({
      success: true, message: "Login exitoso", token,
      user: {
        userId: user.boleta, boleta: user.boleta,
        name: `${user.nombre} ${user.apellido_paterno}`,
        nombre: user.nombre, apellido_paterno: user.apellido_paterno,
        apellido_materno: user.apellido_materno, correo: user.correo,
        avatar: user.nombre.charAt(0).toUpperCase()
      }
    });
  } catch (err) {
    console.error("❌ /api/login:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// ─── DIARIO ───────────────────────────────────────────────────────────────────

app.post("/api/diario", authMiddleware, async (req, res) => {
  try {
    const { registro_diario, sentimiento_predominante, sentimiento_secundario, fecha_registro } = req.body;
    const boleta = req.user.boleta;

    if (!registro_diario?.trim() || !sentimiento_predominante)
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    if (!MOODS_VALIDOS.includes(sentimiento_predominante))
      return res.status(400).json({ success: false, message: "Estado de ánimo principal no válido" });
    if (sentimiento_secundario && !MOODS_VALIDOS.includes(sentimiento_secundario))
      return res.status(400).json({ success: false, message: "Estado de ánimo secundario no válido" });

    const secund = sentimiento_secundario || null;
    let result;

    if (fecha_registro && /^\d{4}-\d{2}-\d{2}$/.test(fecha_registro)) {
      [result] = await db.query(
        `INSERT INTO diario (boleta,registro_diario,sentimiento_predominante,sentimiento_secundario,fecha_registro)
         VALUES (?,?,?,?,?)`,
        [boleta, registro_diario.trim(), sentimiento_predominante, secund, `${fecha_registro} 12:00:00`]
      );
    } else {
      [result] = await db.query(
        `INSERT INTO diario (boleta,registro_diario,sentimiento_predominante,sentimiento_secundario)
         VALUES (?,?,?,?)`,
        [boleta, registro_diario.trim(), sentimiento_predominante, secund]
      );
    }
    return res.json({ success: true, message: "Entrada guardada", id_diario: result.insertId });
  } catch (err) {
    console.error("❌ POST /api/diario:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.get("/api/diario", authMiddleware, async (req, res) => {
  try {
    const [entries] = await db.query(
      `SELECT id_diario,registro_diario,sentimiento_predominante,sentimiento_secundario,fecha_registro
       FROM diario WHERE boleta=? ORDER BY fecha_registro DESC`,
      [req.user.boleta]
    );
    return res.json({ success: true, entries });
  } catch (err) {
    console.error("❌ GET /api/diario:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.put("/api/diario/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { registro_diario, sentimiento_predominante, sentimiento_secundario } = req.body;
    const boleta = req.user.boleta;

    if (!MOODS_VALIDOS.includes(sentimiento_predominante))
      return res.status(400).json({ success: false, message: "Estado de ánimo no válido" });

    const [check] = await db.query(
      "SELECT id_diario FROM diario WHERE id_diario=? AND boleta=?", [id, boleta]
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso para editar esta entrada" });

    await db.query(
      `UPDATE diario SET registro_diario=?,sentimiento_predominante=?,sentimiento_secundario=?
       WHERE id_diario=? AND boleta=?`,
      [registro_diario?.trim(), sentimiento_predominante, sentimiento_secundario || null, id, boleta]
    );
    return res.json({ success: true, message: "Entrada actualizada" });
  } catch (err) {
    console.error("❌ PUT /api/diario:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.delete("/api/diario/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query(
      "SELECT id_diario FROM diario WHERE id_diario=? AND boleta=?", [id, boleta]
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso para eliminar esta entrada" });
    await db.query("DELETE FROM diario WHERE id_diario=? AND boleta=?", [id, boleta]);
    return res.json({ success: true, message: "Entrada eliminada" });
  } catch (err) {
    console.error("❌ DELETE /api/diario:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// ─── AGENDA ───────────────────────────────────────────────────────────────────

app.post("/api/agenda", authMiddleware, async (req, res) => {
  try {
    const { titulo, descripcion, fecha_evento } = req.body;
    const boleta = req.user.boleta;
    if (!titulo?.trim() || !fecha_evento)
      return res.status(400).json({ success: false, message: "Título y fecha son obligatorios" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_evento))
      return res.status(400).json({ success: false, message: "Formato de fecha inválido" });

    const [result] = await db.query(
      `INSERT INTO agenda (boleta,titulo,descripcion,fecha_evento) VALUES (?,?,?,?)`,
      [boleta, titulo.trim(), descripcion?.trim() || null, fecha_evento]
    );
    return res.json({ success: true, message: "Evento guardado", evento: { id_agenda: result.insertId, titulo: titulo.trim(), descripcion: descripcion?.trim() || null, fecha_evento } });
  } catch (err) {
    console.error("❌ POST /api/agenda:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.get("/api/agenda", authMiddleware, async (req, res) => {
  try {
    const { mes } = req.query;
    let query = `SELECT id_agenda,titulo,descripcion,fecha_evento,fecha_creacion FROM agenda WHERE boleta=?`;
    const params = [req.user.boleta];
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [y, m] = mes.split("-");
      query += ` AND YEAR(fecha_evento)=? AND MONTH(fecha_evento)=?`;
      params.push(parseInt(y), parseInt(m));
    }
    query += ` ORDER BY fecha_evento ASC, fecha_creacion ASC`;
    const [eventos] = await db.query(query, params);
    return res.json({ success: true, eventos });
  } catch (err) {
    console.error("❌ GET /api/agenda:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.delete("/api/agenda/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query("SELECT id_agenda FROM agenda WHERE id_agenda=? AND boleta=?", [id, boleta]);
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso para eliminar este evento" });
    await db.query("DELETE FROM agenda WHERE id_agenda=? AND boleta=?", [id, boleta]);
    return res.json({ success: true, message: "Evento eliminado" });
  } catch (err) {
    console.error("❌ DELETE /api/agenda:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// ─── CALENDARIO ───────────────────────────────────────────────────────────────

app.get("/api/diario/calendario", authMiddleware, async (req, res) => {
  try {
    const boleta = req.user.boleta;
    const { mes } = req.query;

    let qDiario = `SELECT DATE(fecha_registro) AS fecha, sentimiento_predominante, sentimiento_secundario FROM diario WHERE boleta=?`;
    const pDiario = [boleta];
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [y, m] = mes.split("-");
      qDiario += ` AND YEAR(fecha_registro)=? AND MONTH(fecha_registro)=?`;
      pDiario.push(parseInt(y), parseInt(m));
    }
    qDiario += ` ORDER BY fecha_registro DESC`;

    const [rowsDiario] = await db.query(qDiario, pDiario);
    const diasMap = {};
    for (const row of rowsDiario) {
      const f = row.fecha instanceof Date ? row.fecha.toISOString().split("T")[0] : String(row.fecha);
      if (!diasMap[f]) diasMap[f] = { sentimiento: row.sentimiento_predominante, sentimiento2: row.sentimiento_secundario || null };
    }
    const dias = Object.entries(diasMap).map(([fecha, v]) => ({ fecha, sentimiento: v.sentimiento, sentimiento2: v.sentimiento2 }));

    let qAgenda = `SELECT id_agenda,titulo,descripcion,fecha_evento FROM agenda WHERE boleta=?`;
    const pAgenda = [boleta];
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [y, m] = mes.split("-");
      qAgenda += ` AND YEAR(fecha_evento)=? AND MONTH(fecha_evento)=?`;
      pAgenda.push(parseInt(y), parseInt(m));
    }
    qAgenda += ` ORDER BY fecha_evento ASC`;

    const [rowsAgenda] = await db.query(qAgenda, pAgenda);
    const eventos = rowsAgenda.map(r => ({
      id_agenda: r.id_agenda, titulo: r.titulo, descripcion: r.descripcion,
      fecha: r.fecha_evento instanceof Date ? r.fecha_evento.toISOString().split("T")[0] : String(r.fecha_evento)
    }));

    return res.json({ success: true, dias, eventos });
  } catch (err) {
    console.error("❌ GET /api/diario/calendario:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// ─── FORO ─────────────────────────────────────────────────────────────────────

app.get("/api/foro", authMiddleware, async (req, res) => {
  try {
    const [posts] = await db.query(`
      SELECT f.id_post,f.boleta,f.nombre_autor,f.avatar_autor,f.titulo,f.categoria,f.contenido,f.fecha_post,
        COUNT(DISTINCT l.id_like) AS total_likes, COUNT(DISTINCT c.id_comentario) AS total_comentarios,
        MAX(CASE WHEN l.boleta=? THEN 1 ELSE 0 END) AS yo_di_like
      FROM foro f
      LEFT JOIN likes_foro l  ON l.id_post=f.id_post
      LEFT JOIN comentarios c ON c.id_post=f.id_post
      GROUP BY f.id_post ORDER BY f.fecha_post DESC`, [req.user.boleta]);
    return res.json({ success: true, posts });
  } catch (err) {
    console.error("❌ GET /api/foro:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.post("/api/foro", authMiddleware, async (req, res) => {
  try {
    const { titulo, categoria, contenido } = req.body;
    const boleta = req.user.boleta;
    if (!titulo?.trim() || !categoria || !contenido?.trim())
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    const [users] = await db.query("SELECT nombre,apellido_paterno FROM usuarios WHERE boleta=?", [boleta]);
    if (users.length === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    const nombre_autor = `${users[0].nombre} ${users[0].apellido_paterno}`;
    const avatar_autor = users[0].nombre.charAt(0).toUpperCase();
    const [result] = await db.query(
      `INSERT INTO foro (boleta,nombre_autor,avatar_autor,titulo,categoria,contenido) VALUES (?,?,?,?,?,?)`,
      [boleta, nombre_autor, avatar_autor, titulo.trim(), categoria, contenido.trim()]
    );
    return res.json({ success: true, message: "Publicación creada", id_post: result.insertId });
  } catch (err) {
    console.error("❌ POST /api/foro:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.delete("/api/foro/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query("SELECT id_post FROM foro WHERE id_post=? AND boleta=?", [id, boleta]);
    if (check.length === 0) return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query("DELETE FROM foro WHERE id_post=?", [id]);
    return res.json({ success: true, message: "Publicación eliminada" });
  } catch (err) {
    console.error("❌ DELETE /api/foro:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.post("/api/foro/:id/like", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [ex] = await db.query("SELECT id_like FROM likes_foro WHERE id_post=? AND boleta=?", [id, boleta]);
    if (ex.length > 0) {
      await db.query("DELETE FROM likes_foro WHERE id_post=? AND boleta=?", [id, boleta]);
      return res.json({ success: true, liked: false });
    }
    await db.query("INSERT INTO likes_foro (id_post,boleta) VALUES (?,?)", [id, boleta]);
    return res.json({ success: true, liked: true });
  } catch (err) {
    console.error("❌ like:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.get("/api/foro/:id/comentarios", authMiddleware, async (req, res) => {
  try {
    const [comentarios] = await db.query(
      `SELECT id_comentario,boleta,nombre_autor,avatar_autor,contenido,fecha_comentario
       FROM comentarios WHERE id_post=? ORDER BY fecha_comentario ASC`, [req.params.id]
    );
    return res.json({ success: true, comentarios });
  } catch (err) {
    console.error("❌ GET comentarios:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

app.post("/api/foro/:id/comentarios", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    const boleta = req.user.boleta;
    if (!contenido?.trim()) return res.status(400).json({ success: false, message: "Comentario vacío" });
    const [users] = await db.query("SELECT nombre,apellido_paterno FROM usuarios WHERE boleta=?", [boleta]);
    if (users.length === 0) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    const nombre_autor = `${users[0].nombre} ${users[0].apellido_paterno}`;
    const avatar_autor = users[0].nombre.charAt(0).toUpperCase();
    const [result] = await db.query(
      `INSERT INTO comentarios (id_post,boleta,nombre_autor,avatar_autor,contenido) VALUES (?,?,?,?,?)`,
      [id, boleta, nombre_autor, avatar_autor, contenido.trim()]
    );
    return res.json({
      success: true, message: "Comentario agregado",
      comentario: { id_comentario: result.insertId, nombre_autor, avatar_autor, contenido: contenido.trim(), fecha_comentario: new Date().toISOString() }
    });
  } catch (err) {
    console.error("❌ POST comentarios:", err.message);
    return res.status(500).json({ success: false, message: "Error del servidor" });
  }
});

// ─── MANEJO GLOBAL DE ERRORES ─────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error("❌ Error no manejado:", err.message);
  // En producción no revelar detalles internos
  const message = IS_PROD ? "Error del servidor" : err.message;
  res.status(500).json({ success: false, message });
});

// ─── SERVER ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`🚀 LumenCare corriendo en http://localhost:${PORT}`);
  console.log(`   Modo: ${IS_PROD ? "PRODUCCIÓN" : "DESARROLLO"}`);
});
