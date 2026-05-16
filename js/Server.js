require("dotenv").config();
const express = require("express"),
  mysql = require("mysql2/promise"),
  path = require("path"),
  bcrypt = require("bcrypt"),
  cors = require("cors"),
  jwt = require("jsonwebtoken"),
  helmet = require("helmet"),
  rateLimit = require("express-rate-limit"),
  compression = require("compression");
const app = express(),
  IS_PROD = process.env.NODE_ENV === "production";
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.set("trust proxy", 1);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Demasiadas peticiones" },
  }),
);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Demasiados intentos. Espera 15 minutos.",
  },
});
app.use(express.json({ limit: "1mb" }));
app.use("/css", express.static(path.join(__dirname, "../CSS")));
app.use("/js", express.static(path.join(__dirname, "../js")));
app.use(express.static(path.join(__dirname, "..")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../index.html")));
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});
(async () => {
  try {
    const c = await db.getConnection();
    console.log("✅ Conectado a MariaDB/MySQL");
    c.release();
  } catch (e) {
    console.error("❌ Error BD:", e.message);
  }
})();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("⚠️  JWT_SECRET no configurado");
  if (IS_PROD) process.exit(1);
}
const MOODS = [
  "euforico",
  "contento",
  "tranquilo",
  "neutral",
  "ansioso",
  "frustrado",
  "triste",
  "solitario",
  "agobiado",
  "desesperado",
];

function authMiddleware(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token)
    return res.status(401).json({ success: false, message: "Token requerido" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res
      .status(403)
      .json({
        success: false,
        message:
          e.name === "TokenExpiredError"
            ? "Tu sesión expiró"
            : "Token inválido",
      });
  }
}
function profMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.tipo_cuenta !== "profesional")
      return res
        .status(403)
        .json({ success: false, message: "Acceso solo para profesionales" });
    next();
  });
}

// REGISTRO ALUMNO
app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const {
      boleta,
      nombre,
      apellido_paterno,
      apellido_materno,
      telefono,
      correo,
      contrasena,
    } = req.body;
    if (
      !boleta ||
      !nombre ||
      !apellido_paterno ||
      !apellido_materno ||
      !correo ||
      !contrasena
    )
      return res
        .status(400)
        .json({ success: false, message: "Faltan campos obligatorios" });
    if (contrasena.length < 8)
      return res
        .status(400)
        .json({ success: false, message: "Contraseña muy corta" });
    const [ec] = await db.query("SELECT boleta FROM usuarios WHERE correo=?", [
      correo.toLowerCase().trim(),
    ]);
    if (ec.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Este correo ya está registrado" });
    const [eb] = await db.query("SELECT boleta FROM usuarios WHERE boleta=?", [
      boleta,
    ]);
    if (eb.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Esta boleta ya está registrada" });
    const [ep] = await db.query(
      "SELECT cedula FROM profesionales WHERE correo=?",
      [correo.toLowerCase().trim()],
    );
    if (ep.length > 0)
      return res
        .status(409)
        .json({
          success: false,
          message: "Correo registrado como profesional",
        });
    const hash = await bcrypt.hash(contrasena, 12);
    await db.query(
      "INSERT INTO usuarios (boleta,nombre,apellido_paterno,apellido_materno,telefono,correo,contrasena) VALUES (?,?,?,?,?,?,?)",
      [
        boleta,
        nombre.trim(),
        apellido_paterno.trim(),
        apellido_materno.trim(),
        telefono || null,
        correo.toLowerCase().trim(),
        hash,
      ],
    );
    return res.json({
      success: true,
      message: "Cuenta de alumno creada correctamente",
    });
  } catch (e) {
    console.error("❌ /api/register:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// REGISTRO PROFESIONAL
app.post("/api/profesionales/register", authLimiter, async (req, res) => {
  try {
    const {
      cedula,
      nombre,
      apellido_paterno,
      apellido_materno,
      especialidad,
      telefono,
      correo,
      contrasena,
    } = req.body;
    if (
      !cedula ||
      !nombre ||
      !apellido_paterno ||
      !apellido_materno ||
      !especialidad ||
      !correo ||
      !contrasena
    )
      return res
        .status(400)
        .json({ success: false, message: "Faltan campos obligatorios" });
    if (contrasena.length < 8)
      return res
        .status(400)
        .json({ success: false, message: "Contraseña muy corta" });
    const [ec] = await db.query(
      "SELECT cedula FROM profesionales WHERE correo=?",
      [correo.toLowerCase().trim()],
    );
    if (ec.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Este correo ya está registrado" });
    const [eced] = await db.query(
      "SELECT cedula FROM profesionales WHERE cedula=?",
      [cedula],
    );
    if (eced.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Esta cédula ya está registrada" });
    const [ea] = await db.query("SELECT boleta FROM usuarios WHERE correo=?", [
      correo.toLowerCase().trim(),
    ]);
    if (ea.length > 0)
      return res
        .status(409)
        .json({ success: false, message: "Correo registrado como alumno" });
    const hash = await bcrypt.hash(contrasena, 12);
    await db.query(
      "INSERT INTO profesionales (cedula,nombre,apellido_paterno,apellido_materno,especialidad,telefono,correo,contrasena) VALUES (?,?,?,?,?,?,?,?)",
      [
        cedula,
        nombre.trim(),
        apellido_paterno.trim(),
        apellido_materno.trim(),
        especialidad.trim(),
        telefono || null,
        correo.toLowerCase().trim(),
        hash,
      ],
    );
    console.log("✅ Profesional registrado:", cedula);
    return res.json({
      success: true,
      message: "Cuenta profesional creada correctamente",
    });
  } catch (e) {
    console.error("❌ /api/profesionales/register:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// LOGIN UNIFICADO
app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const { correo, contrasena } = req.body;
    if (!correo || !contrasena)
      return res
        .status(400)
        .json({ success: false, message: "Correo y contraseña requeridos" });
    const n = correo.toLowerCase().trim();
    const [alumnos] = await db.query("SELECT * FROM usuarios WHERE correo=?", [
      n,
    ]);
    if (alumnos.length > 0) {
      const u = alumnos[0];
      if (!(await bcrypt.compare(contrasena, u.contrasena)))
        return res
          .status(401)
          .json({ success: false, message: "Contraseña incorrecta" });
      const token = jwt.sign(
        { boleta: u.boleta, correo: u.correo, tipo_cuenta: "alumno" },
        JWT_SECRET,
        { expiresIn: "8h" },
      );
      return res.json({
        success: true,
        message: "Login exitoso",
        token,
        user: {
          tipo_cuenta: "alumno",
          userId: u.boleta,
          boleta: u.boleta,
          name: `${u.nombre} ${u.apellido_paterno}`,
          nombre: u.nombre,
          apellido_paterno: u.apellido_paterno,
          apellido_materno: u.apellido_materno,
          correo: u.correo,
          avatar: u.nombre.charAt(0).toUpperCase(),
        },
      });
    }
    const [profs] = await db.query(
      "SELECT * FROM profesionales WHERE correo=?",
      [n],
    );
    if (profs.length > 0) {
      const p = profs[0];
      if (!(await bcrypt.compare(contrasena, p.contrasena)))
        return res
          .status(401)
          .json({ success: false, message: "Contraseña incorrecta" });
      const token = jwt.sign(
        { cedula: p.cedula, correo: p.correo, tipo_cuenta: "profesional" },
        JWT_SECRET,
        { expiresIn: "8h" },
      );
      return res.json({
        success: true,
        message: "Login exitoso",
        token,
        user: {
          tipo_cuenta: "profesional",
          userId: p.cedula,
          cedula: p.cedula,
          name: `${p.nombre} ${p.apellido_paterno}`,
          nombre: p.nombre,
          apellido_paterno: p.apellido_paterno,
          apellido_materno: p.apellido_materno,
          especialidad: p.especialidad,
          correo: p.correo,
          avatar: p.nombre.charAt(0).toUpperCase(),
        },
      });
    }
    return res
      .status(404)
      .json({ success: false, message: "Usuario no encontrado" });
  } catch (e) {
    console.error("❌ /api/login:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// DIARIO
app.post("/api/diario", authMiddleware, async (req, res) => {
  try {
    const {
      registro_diario,
      sentimiento_predominante,
      sentimiento_secundario,
      fecha_registro,
    } = req.body;
    const boleta = req.user.boleta;
    if (!boleta)
      return res
        .status(403)
        .json({
          success: false,
          message: "Solo alumnos pueden usar el diario",
        });
    if (!registro_diario?.trim() || !sentimiento_predominante)
      return res
        .status(400)
        .json({ success: false, message: "Faltan campos requeridos" });
    if (!MOODS.includes(sentimiento_predominante))
      return res
        .status(400)
        .json({ success: false, message: "Estado de ánimo no válido" });
    const sec =
      sentimiento_secundario && MOODS.includes(sentimiento_secundario)
        ? sentimiento_secundario
        : null;
    let result;
    if (fecha_registro && /^\d{4}-\d{2}-\d{2}$/.test(fecha_registro)) {
      [result] = await db.query(
        "INSERT INTO diario (boleta,registro_diario,sentimiento_predominante,sentimiento_secundario,fecha_registro) VALUES (?,?,?,?,?)",
        [
          boleta,
          registro_diario.trim(),
          sentimiento_predominante,
          sec,
          `${fecha_registro} 12:00:00`,
        ],
      );
    } else {
      [result] = await db.query(
        "INSERT INTO diario (boleta,registro_diario,sentimiento_predominante,sentimiento_secundario) VALUES (?,?,?,?)",
        [boleta, registro_diario.trim(), sentimiento_predominante, sec],
      );
    }
    return res.json({
      success: true,
      message: "Entrada guardada",
      id_diario: result.insertId,
    });
  } catch (e) {
    console.error("❌ POST /api/diario:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get("/api/diario", authMiddleware, async (req, res) => {
  try {
    const [entries] = await db.query(
      "SELECT id_diario,registro_diario,sentimiento_predominante,sentimiento_secundario,fecha_registro FROM diario WHERE boleta=? ORDER BY fecha_registro DESC",
      [req.user.boleta],
    );
    return res.json({ success: true, entries });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.put("/api/diario/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      registro_diario,
      sentimiento_predominante,
      sentimiento_secundario,
    } = req.body;
    const boleta = req.user.boleta;
    if (!MOODS.includes(sentimiento_predominante))
      return res
        .status(400)
        .json({ success: false, message: "Estado de ánimo no válido" });
    const [check] = await db.query(
      "SELECT id_diario FROM diario WHERE id_diario=? AND boleta=?",
      [id, boleta],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query(
      "UPDATE diario SET registro_diario=?,sentimiento_predominante=?,sentimiento_secundario=? WHERE id_diario=? AND boleta=?",
      [
        registro_diario?.trim(),
        sentimiento_predominante,
        sentimiento_secundario || null,
        id,
        boleta,
      ],
    );
    return res.json({ success: true, message: "Entrada actualizada" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.delete("/api/diario/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query(
      "SELECT id_diario FROM diario WHERE id_diario=? AND boleta=?",
      [id, boleta],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query("DELETE FROM diario WHERE id_diario=? AND boleta=?", [
      id,
      boleta,
    ]);
    return res.json({ success: true, message: "Entrada eliminada" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// AGENDA
app.post("/api/agenda", authMiddleware, async (req, res) => {
  try {
    const { titulo, descripcion, fecha_evento } = req.body;
    const boleta = req.user.boleta;
    if (!titulo?.trim() || !fecha_evento)
      return res
        .status(400)
        .json({ success: false, message: "Título y fecha obligatorios" });
    const [result] = await db.query(
      "INSERT INTO agenda (boleta,titulo,descripcion,fecha_evento) VALUES (?,?,?,?)",
      [boleta, titulo.trim(), descripcion?.trim() || null, fecha_evento],
    );
    return res.json({
      success: true,
      message: "Evento guardado",
      evento: {
        id_agenda: result.insertId,
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        fecha_evento,
      },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get("/api/agenda", authMiddleware, async (req, res) => {
  try {
    const { mes } = req.query;
    const boleta = req.user.boleta;
    let q =
      "SELECT id_agenda,titulo,descripcion,fecha_evento,fecha_creacion FROM agenda WHERE boleta=?";
    const p = [boleta];
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [y, m] = mes.split("-");
      q += ` AND YEAR(fecha_evento)=? AND MONTH(fecha_evento)=?`;
      p.push(parseInt(y), parseInt(m));
    }
    const [eventos] = await db.query(q + " ORDER BY fecha_evento ASC", p);
    return res.json({ success: true, eventos });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.delete("/api/agenda/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query(
      "SELECT id_agenda FROM agenda WHERE id_agenda=? AND boleta=?",
      [id, boleta],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query("DELETE FROM agenda WHERE id_agenda=? AND boleta=?", [
      id,
      boleta,
    ]);
    return res.json({ success: true, message: "Evento eliminado" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// CALENDARIO
app.get("/api/diario/calendario", authMiddleware, async (req, res) => {
  try {
    const boleta = req.user.boleta;
    const { mes } = req.query;
    let qD =
      "SELECT DATE(fecha_registro) AS fecha,sentimiento_predominante,sentimiento_secundario FROM diario WHERE boleta=?";
    const pD = [boleta];
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [y, m] = mes.split("-");
      qD += ` AND YEAR(fecha_registro)=? AND MONTH(fecha_registro)=?`;
      pD.push(parseInt(y), parseInt(m));
    }
    const [rowsD] = await db.query(qD + " ORDER BY fecha_registro DESC", pD);
    const diasMap = {};
    for (const r of rowsD) {
      const f =
        r.fecha instanceof Date
          ? r.fecha.toISOString().split("T")[0]
          : String(r.fecha);
      if (!diasMap[f])
        diasMap[f] = {
          sentimiento: r.sentimiento_predominante,
          sentimiento2: r.sentimiento_secundario || null,
        };
    }
    let qA =
      "SELECT id_agenda,titulo,descripcion,fecha_evento FROM agenda WHERE boleta=?";
    const pA = [boleta];
    if (mes && /^\d{4}-\d{2}$/.test(mes)) {
      const [y, m] = mes.split("-");
      qA += ` AND YEAR(fecha_evento)=? AND MONTH(fecha_evento)=?`;
      pA.push(parseInt(y), parseInt(m));
    }
    const [rowsA] = await db.query(qA + " ORDER BY fecha_evento ASC", pA);
    const eventos = rowsA.map((r) => ({
      id_agenda: r.id_agenda,
      titulo: r.titulo,
      descripcion: r.descripcion,
      fecha:
        r.fecha_evento instanceof Date
          ? r.fecha_evento.toISOString().split("T")[0]
          : String(r.fecha_evento),
    }));
    return res.json({
      success: true,
      dias: Object.entries(diasMap).map(([fecha, v]) => ({
        fecha,
        sentimiento: v.sentimiento,
        sentimiento2: v.sentimiento2,
      })),
      eventos,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// FORO
app.get("/api/foro", authMiddleware, async (req, res) => {
  try {
    const aid = req.user.boleta || req.user.cedula;
    const [posts] = await db.query(
      `SELECT f.id_post,f.boleta,f.tipo_autor,f.nombre_autor,f.avatar_autor,f.titulo,f.categoria,f.contenido,f.imagen_url,f.fecha_post,COUNT(DISTINCT l.id_like) AS total_likes,COUNT(DISTINCT c.id_comentario) AS total_comentarios,MAX(CASE WHEN l.boleta=? THEN 1 ELSE 0 END) AS yo_di_like FROM foro f LEFT JOIN likes_foro l ON l.id_post=f.id_post LEFT JOIN comentarios c ON c.id_post=f.id_post GROUP BY f.id_post ORDER BY f.fecha_post DESC`,
      [aid],
    );
    return res.json({ success: true, posts });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.post("/api/foro", authMiddleware, async (req, res) => {
  try {
    const { titulo, categoria, contenido, imagen_url } = req.body;
    if (req.user.tipo_cuenta !== "profesional")
      return res
        .status(403)
        .json({
          success: false,
          message: "Solo los profesionales pueden crear publicaciones",
        });
    if (!titulo?.trim() || !categoria || !contenido?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Faltan campos requeridos" });
    if (
      imagen_url &&
      (!imagen_url.startsWith("https://res.cloudinary.com/") ||
        imagen_url.length > 500)
    )
      return res
        .status(400)
        .json({ success: false, message: "URL de imagen no válida" });
    const cedula = req.user.cedula;
    const [profs] = await db.query(
      "SELECT nombre,apellido_paterno FROM profesionales WHERE cedula=?",
      [cedula],
    );
    if (profs.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Profesional no encontrado" });
    const nombre_autor = `${profs[0].nombre} ${profs[0].apellido_paterno}`;
    const avatar_autor = profs[0].nombre.charAt(0).toUpperCase();
    const [result] = await db.query(
      "INSERT INTO foro (boleta,tipo_autor,nombre_autor,avatar_autor,titulo,categoria,contenido,imagen_url) VALUES (?,?,?,?,?,?,?,?)",
      [
        cedula,
        "profesional",
        nombre_autor,
        avatar_autor,
        titulo.trim(),
        categoria,
        contenido.trim(),
        imagen_url || null,
      ],
    );
    return res.json({
      success: true,
      message: "Publicación creada",
      id_post: result.insertId,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.delete("/api/foro/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const aid = req.user.boleta || req.user.cedula;
    const [check] = await db.query(
      "SELECT id_post FROM foro WHERE id_post=? AND boleta=?",
      [id, aid],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query("DELETE FROM foro WHERE id_post=?", [id]);
    return res.json({ success: true, message: "Publicación eliminada" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.post("/api/foro/:id/like", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    if (!boleta)
      return res
        .status(403)
        .json({ success: false, message: "Solo alumnos pueden dar like" });
    const [ex] = await db.query(
      "SELECT id_like FROM likes_foro WHERE id_post=? AND boleta=?",
      [id, boleta],
    );
    if (ex.length > 0) {
      await db.query("DELETE FROM likes_foro WHERE id_post=? AND boleta=?", [
        id,
        boleta,
      ]);
      return res.json({ success: true, liked: false });
    }
    await db.query("INSERT INTO likes_foro (id_post,boleta) VALUES (?,?)", [
      id,
      boleta,
    ]);
    return res.json({ success: true, liked: true });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get("/api/foro/:id/comentarios", authMiddleware, async (req, res) => {
  try {
    const [comentarios] = await db.query(
      "SELECT id_comentario,boleta,nombre_autor,avatar_autor,contenido,fecha_comentario FROM comentarios WHERE id_post=? ORDER BY fecha_comentario ASC",
      [req.params.id],
    );
    return res.json({ success: true, comentarios });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.post("/api/foro/:id/comentarios", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    const boleta = req.user.boleta;
    if (!boleta)
      return res
        .status(403)
        .json({ success: false, message: "Solo alumnos pueden comentar" });
    if (!contenido?.trim())
      return res
        .status(400)
        .json({ success: false, message: "Comentario vacío" });
    const [users] = await db.query(
      "SELECT nombre,apellido_paterno FROM usuarios WHERE boleta=?",
      [boleta],
    );
    if (users.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Usuario no encontrado" });
    const nombre_autor = `${users[0].nombre} ${users[0].apellido_paterno}`;
    const avatar_autor = users[0].nombre.charAt(0).toUpperCase();
    const [result] = await db.query(
      "INSERT INTO comentarios (id_post,boleta,nombre_autor,avatar_autor,contenido) VALUES (?,?,?,?,?)",
      [id, boleta, nombre_autor, avatar_autor, contenido.trim()],
    );
    return res.json({
      success: true,
      message: "Comentario agregado",
      comentario: {
        id_comentario: result.insertId,
        nombre_autor,
        avatar_autor,
        contenido: contenido.trim(),
        fecha_comentario: new Date().toISOString(),
      },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// PACIENTES
app.get("/api/profesionales/pacientes", profMiddleware, async (req, res) => {
  try {
    const [pacientes] = await db.query(
      `SELECT u.boleta,u.nombre,u.apellido_paterno,u.apellido_materno,u.correo,p.fecha_asignacion,(SELECT sentimiento_predominante FROM diario WHERE boleta=u.boleta ORDER BY fecha_registro DESC LIMIT 1) AS ultima_emocion,(SELECT fecha_registro FROM diario WHERE boleta=u.boleta ORDER BY fecha_registro DESC LIMIT 1) AS ultima_fecha FROM pacientes p INNER JOIN usuarios u ON u.boleta=p.boleta_alumno WHERE p.cedula_profesional=? ORDER BY p.fecha_asignacion DESC`,
      [req.user.cedula],
    );
    return res.json({ success: true, pacientes });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get(
  "/api/profesionales/buscar-alumno",
  profMiddleware,
  async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || q.trim().length < 3)
        return res
          .status(400)
          .json({ success: false, message: "Mínimo 3 caracteres" });
      const [rows] = await db.query(
        "SELECT u.boleta,u.nombre,u.apellido_paterno,u.apellido_materno,u.correo,p.cedula_profesional FROM usuarios u LEFT JOIN pacientes p ON p.boleta_alumno=u.boleta WHERE u.boleta LIKE ? OR u.correo LIKE ? LIMIT 5",
        [`%${q}%`, `%${q}%`],
      );
      return res.json({ success: true, alumnos: rows });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);
app.post("/api/profesionales/pacientes", profMiddleware, async (req, res) => {
  try {
    const { boleta_alumno } = req.body;
    const cedula = req.user.cedula;
    if (!boleta_alumno)
      return res
        .status(400)
        .json({ success: false, message: "Boleta requerida" });
    const [alumno] = await db.query(
      "SELECT boleta FROM usuarios WHERE boleta=?",
      [boleta_alumno],
    );
    if (alumno.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Alumno no encontrado" });
    const [ex] = await db.query(
      "SELECT id_relacion,cedula_profesional FROM pacientes WHERE boleta_alumno=?",
      [boleta_alumno],
    );
    if (ex.length > 0) {
      if (ex[0].cedula_profesional === cedula)
        return res
          .status(409)
          .json({ success: false, message: "Ya es tu paciente" });
      return res
        .status(409)
        .json({
          success: false,
          message: "El alumno ya tiene un profesional asignado",
        });
    }
    await db.query(
      "INSERT INTO pacientes (cedula_profesional,boleta_alumno) VALUES (?,?)",
      [cedula, boleta_alumno],
    );
    return res.json({ success: true, message: "Paciente agregado" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.delete(
  "/api/profesionales/pacientes/:boleta",
  profMiddleware,
  async (req, res) => {
    try {
      const { boleta } = req.params;
      const cedula = req.user.cedula;
      const [check] = await db.query(
        "SELECT id_relacion FROM pacientes WHERE cedula_profesional=? AND boleta_alumno=?",
        [cedula, boleta],
      );
      if (check.length === 0)
        return res
          .status(404)
          .json({ success: false, message: "Relación no encontrada" });
      await db.query(
        "DELETE FROM pacientes WHERE cedula_profesional=? AND boleta_alumno=?",
        [cedula, boleta],
      );
      return res.json({ success: true, message: "Paciente eliminado" });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);
app.get(
  "/api/profesionales/pacientes/:boleta/calendario",
  profMiddleware,
  async (req, res) => {
    try {
      const { boleta } = req.params;
      const { mes } = req.query;
      const cedula = req.user.cedula;
      const [check] = await db.query(
        "SELECT id_relacion FROM pacientes WHERE cedula_profesional=? AND boleta_alumno=?",
        [cedula, boleta],
      );
      if (check.length === 0)
        return res
          .status(403)
          .json({ success: false, message: "No es tu paciente" });
      let q =
        "SELECT DATE(fecha_registro) AS fecha,sentimiento_predominante,sentimiento_secundario FROM diario WHERE boleta=?";
      const p = [boleta];
      if (mes && /^\d{4}-\d{2}$/.test(mes)) {
        const [y, m] = mes.split("-");
        q += ` AND YEAR(fecha_registro)=? AND MONTH(fecha_registro)=?`;
        p.push(parseInt(y), parseInt(m));
      }
      const [rows] = await db.query(q + " ORDER BY fecha_registro DESC", p);
      const diasMap = {};
      for (const r of rows) {
        const f =
          r.fecha instanceof Date
            ? r.fecha.toISOString().split("T")[0]
            : String(r.fecha);
        if (!diasMap[f])
          diasMap[f] = {
            sentimiento: r.sentimiento_predominante,
            sentimiento2: r.sentimiento_secundario || null,
          };
      }
      return res.json({
        success: true,
        dias: Object.entries(diasMap).map(([fecha, v]) => ({
          fecha,
          sentimiento: v.sentimiento,
          sentimiento2: v.sentimiento2,
        })),
      });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);

// ─── NOTAS DE CONSULTA ────────────────────────────────────────────────────────
app.get(
  "/api/profesionales/pacientes/:boleta/notas",
  profMiddleware,
  async (req, res) => {
    try {
      const { boleta } = req.params;
      const cedula = req.user.cedula;
      const [check] = await db.query(
        "SELECT id_relacion FROM pacientes WHERE cedula_profesional=? AND boleta_alumno=?",
        [cedula, boleta],
      );
      if (check.length === 0)
        return res
          .status(403)
          .json({ success: false, message: "No es tu paciente" });
      const [notas] = await db.query(
        "SELECT id_nota,numero_cita,nota,fecha_consulta,fecha_creacion FROM notas_consulta WHERE cedula_profesional=? AND boleta_alumno=? ORDER BY numero_cita DESC",
        [cedula, boleta],
      );
      return res.json({ success: true, notas });
    } catch (e) {
      console.error("❌ GET notas:", e.message);
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);

app.post(
  "/api/profesionales/pacientes/:boleta/notas",
  profMiddleware,
  async (req, res) => {
    try {
      const { boleta } = req.params;
      const { nota, fecha_consulta } = req.body;
      const cedula = req.user.cedula;
      if (!nota?.trim() || !fecha_consulta)
        return res
          .status(400)
          .json({ success: false, message: "Nota y fecha son requeridas" });
      const [check] = await db.query(
        "SELECT id_relacion FROM pacientes WHERE cedula_profesional=? AND boleta_alumno=?",
        [cedula, boleta],
      );
      if (check.length === 0)
        return res
          .status(403)
          .json({ success: false, message: "No es tu paciente" });
      const [ultima] = await db.query(
        "SELECT MAX(numero_cita) AS ultimo FROM notas_consulta WHERE cedula_profesional=? AND boleta_alumno=?",
        [cedula, boleta],
      );
      const numero_cita = (ultima[0].ultimo || 0) + 1;
      const [result] = await db.query(
        "INSERT INTO notas_consulta (cedula_profesional,boleta_alumno,numero_cita,nota,fecha_consulta) VALUES (?,?,?,?,?)",
        [cedula, boleta, numero_cita, nota.trim(), fecha_consulta],
      );
      return res.json({
        success: true,
        message: "Nota agregada",
        id_nota: result.insertId,
        numero_cita,
      });
    } catch (e) {
      console.error("❌ POST notas:", e.message);
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);

app.put("/api/profesionales/notas/:id", profMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { nota, fecha_consulta } = req.body;
    const cedula = req.user.cedula;
    if (!nota?.trim() || !fecha_consulta)
      return res
        .status(400)
        .json({ success: false, message: "Nota y fecha son requeridas" });
    const [check] = await db.query(
      "SELECT id_nota FROM notas_consulta WHERE id_nota=? AND cedula_profesional=?",
      [id, cedula],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query(
      "UPDATE notas_consulta SET nota=?,fecha_consulta=? WHERE id_nota=? AND cedula_profesional=?",
      [nota.trim(), fecha_consulta, id, cedula],
    );
    return res.json({ success: true, message: "Nota actualizada" });
  } catch (e) {
    console.error("❌ PUT nota:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

app.delete("/api/profesionales/notas/:id", profMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const cedula = req.user.cedula;
    const [check] = await db.query(
      "SELECT id_nota FROM notas_consulta WHERE id_nota=? AND cedula_profesional=?",
      [id, cedula],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query(
      "DELETE FROM notas_consulta WHERE id_nota=? AND cedula_profesional=?",
      [id, cedula],
    );
    return res.json({ success: true, message: "Nota eliminada" });
  } catch (e) {
    console.error("❌ DELETE nota:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// ALUMNO
app.get("/api/alumno/mi-profesional", authMiddleware, async (req, res) => {
  try {
    if (req.user.tipo_cuenta !== "alumno")
      return res.status(403).json({ success: false, message: "Solo alumnos" });
    const [rows] = await db.query(
      "SELECT p.nombre,p.apellido_paterno,p.apellido_materno,p.especialidad,p.correo,pa.fecha_asignacion FROM pacientes pa INNER JOIN profesionales p ON p.cedula=pa.cedula_profesional WHERE pa.boleta_alumno=?",
      [req.user.boleta],
    );
    if (rows.length === 0)
      return res.json({ success: true, profesional: null });
    const p = rows[0];
    return res.json({
      success: true,
      profesional: {
        nombre: `${p.nombre} ${p.apellido_paterno} ${p.apellido_materno}`,
        especialidad: p.especialidad,
        correo: p.correo,
        fecha_asignacion: p.fecha_asignacion,
      },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.delete("/api/alumno/mi-profesional", authMiddleware, async (req, res) => {
  try {
    if (req.user.tipo_cuenta !== "alumno")
      return res.status(403).json({ success: false, message: "Solo alumnos" });
    const [check] = await db.query(
      "SELECT id_relacion FROM pacientes WHERE boleta_alumno=?",
      [req.user.boleta],
    );
    if (check.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "Sin profesional asignado" });
    await db.query("DELETE FROM pacientes WHERE boleta_alumno=?", [
      req.user.boleta,
    ]);
    return res.json({ success: true, message: "Desvinculado correctamente" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get("/api/alumno/ultimo-mood", authMiddleware, async (req, res) => {
  try {
    if (!req.user.boleta) return res.json({ success: true, mood: null });
    const [rows] = await db.query(
      "SELECT sentimiento_predominante FROM diario WHERE boleta=? ORDER BY fecha_registro DESC LIMIT 1",
      [req.user.boleta],
    );
    return res.json({
      success: true,
      mood: rows.length > 0 ? rows[0].sentimiento_predominante : null,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

// CONVERSACIONES
app.post("/api/conversaciones", authMiddleware, async (req, res) => {
  try {
    const boleta = req.user.boleta;
    if (!boleta)
      return res
        .status(403)
        .json({ success: false, message: "Solo alumnos pueden usar el chat" });
    const [result] = await db.query(
      "INSERT INTO conversaciones (boleta,titulo) VALUES (?,?)",
      [boleta, req.body.titulo?.trim() || "Nueva conversación"],
    );
    return res.json({ success: true, id_conversacion: result.insertId });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get("/api/conversaciones", authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_conversacion,titulo,fecha_creacion,fecha_update FROM conversaciones WHERE boleta=? ORDER BY fecha_update DESC",
      [req.user.boleta],
    );
    return res.json({ success: true, conversaciones: rows });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.put("/api/conversaciones/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query(
      "SELECT id_conversacion FROM conversaciones WHERE id_conversacion=? AND boleta=?",
      [id, boleta],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query(
      "UPDATE conversaciones SET titulo=? WHERE id_conversacion=? AND boleta=?",
      [req.body.titulo?.trim(), id, boleta],
    );
    return res.json({ success: true });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.delete("/api/conversaciones/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;
    const [check] = await db.query(
      "SELECT id_conversacion FROM conversaciones WHERE id_conversacion=? AND boleta=?",
      [id, boleta],
    );
    if (check.length === 0)
      return res.status(403).json({ success: false, message: "Sin permiso" });
    await db.query(
      "DELETE FROM conversaciones WHERE id_conversacion=? AND boleta=?",
      [id, boleta],
    );
    return res.json({ success: true, message: "Eliminada" });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});
app.get(
  "/api/conversaciones/:id/mensajes",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const boleta = req.user.boleta;
      const [check] = await db.query(
        "SELECT id_conversacion FROM conversaciones WHERE id_conversacion=? AND boleta=?",
        [id, boleta],
      );
      if (check.length === 0)
        return res.status(403).json({ success: false, message: "Sin permiso" });
      const [mensajes] = await db.query(
        "SELECT id_mensaje,rol,contenido,fecha_mensaje FROM mensajes WHERE id_conversacion=? ORDER BY fecha_mensaje ASC",
        [id],
      );
      return res.json({ success: true, mensajes });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);
app.post(
  "/api/conversaciones/:id/mensajes",
  authMiddleware,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { rol, contenido } = req.body;
      const boleta = req.user.boleta;
      if (!["user", "bot"].includes(rol) || !contenido?.trim())
        return res
          .status(400)
          .json({ success: false, message: "Datos inválidos" });
      const [check] = await db.query(
        "SELECT id_conversacion FROM conversaciones WHERE id_conversacion=? AND boleta=?",
        [id, boleta],
      );
      if (check.length === 0)
        return res.status(403).json({ success: false, message: "Sin permiso" });
      const [result] = await db.query(
        "INSERT INTO mensajes (id_conversacion,rol,contenido) VALUES (?,?,?)",
        [id, rol, contenido.trim()],
      );
      return res.json({ success: true, id_mensaje: result.insertId });
    } catch (e) {
      return res
        .status(500)
        .json({ success: false, message: "Error del servidor" });
    }
  },
);

// ─── BOTPRESS PROXY ───────────────────────────────────────────────────────────
app.post("/api/chat/botpress", authMiddleware, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message?.trim())
      return res.status(400).json({ success: false, message: "Mensaje vacío" });

    const BOTPRESS_URL =
      "https://webhook.botpress.cloud/eb5d8a0b-2a1a-47b0-894e-2e7c780fd788";
    const BOTPRESS_TOKEN = process.env.BOTPRESS_TOKEN;
    if (!BOTPRESS_TOKEN)
      return res
        .status(500)
        .json({ success: false, message: "Token de Botpress no configurado" });

    const bpRes = await fetch(BOTPRESS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BOTPRESS_TOKEN}`,
      },
      body: JSON.stringify({
        message,
        userId: req.user.boleta || req.user.cedula,
        conversationId: conversationId || undefined,
      }),
    });

    if (!bpRes.ok) {
      const errText = await bpRes.text();
      console.error("❌ Botpress HTTP error:", bpRes.status, errText);
      return res
        .status(502)
        .json({ success: false, message: "Error al contactar el asistente" });
    }

    // Leer como texto primero para evitar error si el body está vacío
    const rawText = await bpRes.text();
    console.log("🤖 Botpress raw response:", rawText);

    let reply = "Lo siento, no pude procesar tu mensaje en este momento.";

    if (rawText && rawText.trim().length > 0) {
      try {
        const bpData = JSON.parse(rawText);
        reply =
          bpData?.responses?.[0]?.text ||
          bpData?.output?.[0]?.text ||
          bpData?.reply?.text ||
          bpData?.text ||
          bpData?.message ||
          bpData?.answer ||
          reply;
      } catch {
        // Si no es JSON, usar el texto directamente
        reply = rawText.trim();
      }
    }

    return res.json({ success: true, reply });
  } catch (e) {
    console.error("❌ /api/chat/botpress:", e.message);
    return res
      .status(500)
      .json({ success: false, message: "Error del servidor" });
  }
});

app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res
    .status(500)
    .json({
      success: false,
      message: IS_PROD ? "Error del servidor" : err.message,
    });
});
const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(
    `🚀 LumenCare en http://localhost:${PORT}\n   Modo: ${IS_PROD ? "PRODUCCIÓN" : "DESARROLLO"}`,
  );
});
