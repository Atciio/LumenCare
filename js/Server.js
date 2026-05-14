require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
const bcrypt = require("bcrypt");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());
app.use(cors());

app.use("/css", express.static(path.join(__dirname, "../CSS")));
app.use("/js",  express.static(path.join(__dirname, "../js")));
app.use(express.static(path.join(__dirname, "..")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

const db = mysql.createPool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10
});

(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ Conectado a MariaDB correctamente");
    conn.release();
  } catch (err) {
    console.error("❌ Error conectando a MariaDB:", err.message);
  }
})();

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; 

  if (!token) {
    return res.status(401).json({ success: false, message: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; 
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: "Token inválido o expirado" });
  }
}

app.post("/api/register", async (req, res) => {
  try {
    const { boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena } = req.body;

    console.log("📥 Registro recibido:", { boleta, nombre, apellido_paterno, apellido_materno, correo });

    if (!boleta || !nombre || !apellido_paterno || !apellido_materno || !correo || !contrasena) {
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios" });
    }

    
    const [existingCorreo] = await db.query("SELECT boleta FROM usuarios WHERE correo = ?", [correo]);
    if (existingCorreo.length > 0) {
      return res.status(409).json({ success: false, message: "Este correo ya está registrado" });
    }

    
    const [existingBoleta] = await db.query("SELECT boleta FROM usuarios WHERE boleta = ?", [boleta]);
    if (existingBoleta.length > 0) {
      return res.status(409).json({ success: false, message: "Esta boleta ya está registrada" });
    }

    const hashedPassword = await bcrypt.hash(contrasena, 10);

    await db.query(
      `INSERT INTO usuarios (boleta, nombre, apellido_paterno, apellido_materno, telefono, correo, contrasena)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [boleta, nombre, apellido_paterno, apellido_materno, telefono || null, correo, hashedPassword]
    );

    console.log("✅ Usuario registrado con boleta:", boleta);
    return res.json({ success: true, message: "Usuario registrado correctamente" });

  } catch (error) {
    console.error("❌ Error en /api/register:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      return res.status(400).json({ success: false, message: "Correo y contraseña requeridos" });
    }

    const [users] = await db.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(contrasena, user.contrasena);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
    }

    
    const token = jwt.sign(
      { boleta: user.boleta, correo: user.correo },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.json({
      success: true,
      message: "Login exitoso",
      token,
      user: {
        userId:           user.boleta,          
        boleta:           user.boleta,
        name:             `${user.nombre} ${user.apellido_paterno}`,
        nombre:           user.nombre,
        apellido_paterno: user.apellido_paterno,
        apellido_materno: user.apellido_materno,
        correo:           user.correo,
        avatar:           user.nombre.charAt(0).toUpperCase()
      }
    });

  } catch (error) {
    console.error("❌ Error en /api/login:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.post("/api/diario", authMiddleware, async (req, res) => {
  try {
    const { registro_diario, sentimiento_predominante } = req.body;
    const boleta = req.user.boleta;

    if (!registro_diario || !sentimiento_predominante) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    const [result] = await db.query(
      `INSERT INTO diario (boleta, registro_diario, sentimiento_predominante)
       VALUES (?, ?, ?)`,
      [boleta, registro_diario, sentimiento_predominante]
    );

    console.log("✅ Entrada de diario creada, id_diario:", result.insertId);
    return res.json({ success: true, message: "Entrada guardada", id_diario: result.insertId });

  } catch (error) {
    console.error("❌ Error en POST /api/diario:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.get("/api/diario", authMiddleware, async (req, res) => {
  try {
    const boleta = req.user.boleta;

    const [entries] = await db.query(
      `SELECT id_diario, registro_diario, sentimiento_predominante, fecha_registro
       FROM diario
       WHERE boleta = ?
       ORDER BY fecha_registro DESC`,
      [boleta]
    );

    return res.json({ success: true, entries });

  } catch (error) {
    console.error("❌ Error en GET /api/diario:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.put("/api/diario/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { registro_diario, sentimiento_predominante } = req.body;
    const boleta = req.user.boleta;

    
    const [check] = await db.query(
      "SELECT id_diario FROM diario WHERE id_diario = ? AND boleta = ?",
      [id, boleta]
    );
    if (check.length === 0) {
      return res.status(403).json({ success: false, message: "No tienes permiso para editar esta entrada" });
    }

    await db.query(
      `UPDATE diario SET registro_diario = ?, sentimiento_predominante = ?
       WHERE id_diario = ? AND boleta = ?`,
      [registro_diario, sentimiento_predominante, id, boleta]
    );

    return res.json({ success: true, message: "Entrada actualizada" });

  } catch (error) {
    console.error("❌ Error en PUT /api/diario:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.delete("/api/diario/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;

    const [check] = await db.query(
      "SELECT id_diario FROM diario WHERE id_diario = ? AND boleta = ?",
      [id, boleta]
    );
    if (check.length === 0) {
      return res.status(403).json({ success: false, message: "No tienes permiso para eliminar esta entrada" });
    }

    await db.query("DELETE FROM diario WHERE id_diario = ? AND boleta = ?", [id, boleta]);

    return res.json({ success: true, message: "Entrada eliminada" });

  } catch (error) {
    console.error("❌ Error en DELETE /api/diario:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.get("/api/foro", authMiddleware, async (req, res) => {
  try {
    const autor_id = req.user.boleta || req.user.cedula;

    const [posts] = await db.query(`
      SELECT
        f.id_post,
        f.boleta,
        f.tipo_autor,
        f.nombre_autor,
        f.avatar_autor,
        f.titulo,
        f.categoria,
        f.contenido,
        f.fecha_post,
        COUNT(DISTINCT l.id_like)        AS total_likes,
        COUNT(DISTINCT c.id_comentario)  AS total_comentarios,
        MAX(CASE WHEN l.boleta = ? THEN 1 ELSE 0 END) AS yo_di_like
      FROM foro f
      LEFT JOIN likes_foro l  ON l.id_post = f.id_post
      LEFT JOIN comentarios c ON c.id_post = f.id_post
      GROUP BY f.id_post
      ORDER BY f.fecha_post DESC
    `, [autor_id]);

    return res.json({ success: true, posts });

  } catch (error) {
    console.error("❌ Error en GET /api/foro:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.post("/api/foro", authMiddleware, async (req, res) => {
  try {
    const { titulo, categoria, contenido } = req.body;

    // Solo profesionales pueden publicar en el foro
    if (req.user.tipo_cuenta !== 'profesional') {
      return res.status(403).json({ success: false, message: "Solo los profesionales pueden crear publicaciones" });
    }

    if (!titulo || !categoria || !contenido) {
      return res.status(400).json({ success: false, message: "Faltan campos requeridos" });
    }

    const cedula = req.user.cedula;
    const [profs] = await db.query("SELECT nombre, apellido_paterno FROM profesionales WHERE cedula = ?", [cedula]);
    if (profs.length === 0) {
      return res.status(404).json({ success: false, message: "Profesional no encontrado" });
    }
    const nombre_autor = `${profs[0].nombre} ${profs[0].apellido_paterno}`;
    const avatar_autor = profs[0].nombre.charAt(0).toUpperCase();

    const [result] = await db.query(
      `INSERT INTO foro (boleta, tipo_autor, nombre_autor, avatar_autor, titulo, categoria, contenido)
       VALUES (?, 'profesional', ?, ?, ?, ?, ?)`,
      [cedula, nombre_autor, avatar_autor, titulo, categoria, contenido]
    );

    console.log("✅ Post profesional creado, id_post:", result.insertId);
    return res.json({ success: true, message: "Publicación creada", id_post: result.insertId });

  } catch (error) {
    console.error("❌ Error en POST /api/foro:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.delete("/api/foro/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const autor_id = req.user.boleta || req.user.cedula;

    const [check] = await db.query("SELECT id_post FROM foro WHERE id_post = ? AND boleta = ?", [id, autor_id]);
    if (check.length === 0) {
      return res.status(403).json({ success: false, message: "No tienes permiso para eliminar este post" });
    }

    await db.query("DELETE FROM foro WHERE id_post = ?", [id]);
    return res.json({ success: true, message: "Publicación eliminada" });

  } catch (error) {
    console.error("❌ Error en DELETE /api/foro:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.post("/api/foro/:id/like", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const boleta = req.user.boleta;

    const [existing] = await db.query(
      "SELECT id_like FROM likes_foro WHERE id_post = ? AND boleta = ?",
      [id, boleta]
    );

    if (existing.length > 0) {
      
      await db.query("DELETE FROM likes_foro WHERE id_post = ? AND boleta = ?", [id, boleta]);
      return res.json({ success: true, liked: false });
    } else {
      
      await db.query("INSERT INTO likes_foro (id_post, boleta) VALUES (?, ?)", [id, boleta]);
      return res.json({ success: true, liked: true });
    }

  } catch (error) {
    console.error("❌ Error en POST /api/foro/:id/like:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.get("/api/foro/:id/comentarios", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [comentarios] = await db.query(
      `SELECT id_comentario, boleta, nombre_autor, avatar_autor, contenido, fecha_comentario
       FROM comentarios
       WHERE id_post = ?
       ORDER BY fecha_comentario ASC`,
      [id]
    );

    return res.json({ success: true, comentarios });

  } catch (error) {
    console.error("❌ Error en GET /api/foro/:id/comentarios:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

app.post("/api/foro/:id/comentarios", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    const boleta = req.user.boleta;

    if (!contenido || !contenido.trim()) {
      return res.status(400).json({ success: false, message: "El comentario no puede estar vacío" });
    }

    const [users] = await db.query("SELECT nombre, apellido_paterno FROM usuarios WHERE boleta = ?", [boleta]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }
    const nombre_autor = `${users[0].nombre} ${users[0].apellido_paterno}`;
    const avatar_autor = users[0].nombre.charAt(0).toUpperCase();

    const [result] = await db.query(
      `INSERT INTO comentarios (id_post, boleta, nombre_autor, avatar_autor, contenido)
       VALUES (?, ?, ?, ?, ?)`,
      [id, boleta, nombre_autor, avatar_autor, contenido.trim()]
    );

    return res.json({
      success: true,
      message: "Comentario agregado",
      comentario: {
        id_comentario:    result.insertId,
        nombre_autor,
        avatar_autor,
        contenido:        contenido.trim(),
        fecha_comentario: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error("❌ Error en POST /api/foro/:id/comentarios:", error.message);
    return res.status(500).json({ success: false, message: "Error del servidor: " + error.message });
  }
});

const PORT = process.env.PORT || 3030;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
