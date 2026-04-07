const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // Puedes acceder desde los controladores
    next();
  } catch (_err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware opcional de autenticación
 * Intenta parsear el token si está presente, pero NO falla si no hay token.
 * Útil para rutas públicas que pueden beneficiarse de saber quién es el usuario.
 */
function verificarTokenOpcional(req, res, next) {
  const authHeader = req.headers.authorization;

  // Si no hay header de autorización, continuar sin user
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
  } catch (_err) {
    // Token inválido, continuar sin user
    req.user = null;
  }

  next();
}

// VERSIÓN SIMULADA (para pruebas sin frontend/login)
// function verificarToken(req, res, next) {
//   req.user = { id: 1 };
//   next();
// }

module.exports = verificarToken;
module.exports.verificarTokenOpcional = verificarTokenOpcional;
