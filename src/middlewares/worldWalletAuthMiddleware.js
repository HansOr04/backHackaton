/**
 * worldWalletAuthMiddleware.js
 * Middleware para autenticación con World Wallet
 */

const jsonStore = require('../utils/jsonStore');
const tokenConfig = require('../config/tokenConfig');
const { error } = require('../utils/responseFormatter');

/**
 * Middleware para proteger rutas que requieren autenticación
 * Verifica el token JWT y añade la información del usuario a req.user
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const authGuard = async (req, res, next) => {
  try {
    let token;
    
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } 
    // O de la cookie si está disponible
    else if (req.cookies && req.cookies[tokenConfig.COOKIE_NAMES.AUTH_TOKEN]) {
      token = req.cookies[tokenConfig.COOKIE_NAMES.AUTH_TOKEN];
    }
    
    // Si no hay token, continuar pero sin usuario autenticado
    // Esto permite que algunas rutas funcionen sin autenticación
    if (!token) {
      return next();
    }
    
    // Verificar el token
    const decoded = tokenConfig.verifyToken(token);
    
    // Si el token es inválido o está expirado
    if (!decoded) {
      // Limpiar la cookie si existe
      if (req.cookies && req.cookies[tokenConfig.COOKIE_NAMES.AUTH_TOKEN]) {
        res.clearCookie(tokenConfig.COOKIE_NAMES.AUTH_TOKEN);
      }
      return next(); // Continuar sin usuario autenticado
    }
    
    // Buscar usuario en el almacenamiento
    const users = await jsonStore.find('users');
    const user = users.find(u => u.id === decoded.id);
    
    // Si no se encuentra el usuario
    if (!user) {
      return next(); // Continuar sin usuario autenticado
    }
    
    // Añadir información del usuario al objeto de solicitud
    req.user = {
      id: user.id,
      walletAddress: user.walletAddress,
      name: user.name,
      verificationLevel: user.verificationLevel,
      walletAuthorized: user.walletAuthorized
    };
    
    // Continuar con la siguiente función middleware
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    next(); // Continuar sin usuario autenticado
  }
};

/**
 * Middleware para rutas que requieren autenticación obligatoria
 * Si el usuario no está autenticado, devuelve un error 401
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const requireAuth = (req, res, next) => {
  // Asegurarse de que authGuard se ha ejecutado antes
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  next();
};

/**
 * Middleware para verificar si un usuario tiene un nivel de verificación específico
 * @param {string} level - Nivel de verificación requerido ('device', 'phone', 'orb')
 * @returns {Function} Middleware de Express
 */
const requireVerificationLevel = (level) => {
  return (req, res, next) => {
    // Asegurarse de que authGuard se ha ejecutado antes
    if (!req.user) {
      return error(res, 'Se requiere autenticación', 401);
    }
    
    const userLevel = req.user.verificationLevel;
    
    // Mapeo de niveles a valores numéricos para comparación
    const levelPriority = {
      'device': 1,
      'phone': 2,
      'orb': 3
    };
    
    if (levelPriority[userLevel] < levelPriority[level]) {
      return error(
        res, 
        `Se requiere nivel de verificación '${level}' o superior`, 
        403
      );
    }
    
    next();
  };
};

/**
 * Middleware para verificar que la wallet del usuario está autorizada
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const requireWalletAuthorization = (req, res, next) => {
  // Asegurarse de que authGuard se ha ejecutado antes
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  if (!req.user.walletAuthorized) {
    return error(res, 'Se requiere autorización de wallet', 403);
  }
  
  next();
};

module.exports = {
  authGuard,
  requireAuth,
  requireVerificationLevel,
  requireWalletAuthorization
};