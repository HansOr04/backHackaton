/**
 * worldWalletAuthMiddleware.js
 * Middleware para validar la autenticación con World Wallet
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { error } = require('../utils/responseFormatter');

/**
 * Middleware para proteger rutas que requieren autenticación
 * Verifica el token JWT y agrega la información del usuario al objeto de solicitud
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const authGuard = async (req, res, next) => {
  try {
    // Obtener token de los headers
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(res, 'Se requiere autenticación', 401);
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return error(res, 'Token de autenticación no proporcionado', 401);
    }
    
    try {
      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario en la base de datos
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return error(res, 'Usuario no encontrado', 404);
      }
      
      // Agregar información del usuario al objeto de solicitud
      req.user = {
        id: user._id,
        walletAddress: user.walletAddress,
        verificationLevel: user.verificationLevel
      };
      
      // Continuar con la siguiente función middleware
      next();
    } catch (jwtError) {
      // Manejar errores específicos de JWT
      if (jwtError.name === 'TokenExpiredError') {
        return error(res, 'Token expirado', 401);
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return error(res, 'Token inválido', 401);
      }
      
      throw jwtError;
    }
  } catch (err) {
    console.error('Auth middleware error:', err);
    return error(res, 'Error de autenticación', 500);
  }
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
 * Middleware para verificar que el usuario autenticado es el propietario del recurso
 * @param {Function} getResourceUserId - Función para obtener el ID de usuario del recurso
 * @returns {Function} Middleware de Express
 */
const isResourceOwner = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      // Asegurarse de que authGuard se ha ejecutado antes
      if (!req.user) {
        return error(res, 'Se requiere autenticación', 401);
      }
      
      // Obtener ID del propietario del recurso
      const resourceUserId = await getResourceUserId(req);
      
      if (!resourceUserId) {
        return error(res, 'Recurso no encontrado', 404);
      }
      
      // Verificar si el usuario autenticado es el propietario
      if (resourceUserId.toString() !== req.user.id.toString()) {
        return error(res, 'No tienes permiso para acceder a este recurso', 403);
      }
      
      next();
    } catch (err) {
      console.error('Resource owner check error:', err);
      return error(res, 'Error al verificar permisos', 500);
    }
  };
};

module.exports = {
  authGuard,
  requireVerificationLevel,
  isResourceOwner
};