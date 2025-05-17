/**
 * nonceController.js
 * Controlador para la generación y validación de nonces para SIWE (Sign In With Ethereum)
 */

const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const { success, error } = require('../utils/responseFormatter');

/**
 * Genera un nuevo nonce para autenticación SIWE
 * El nonce es un valor aleatorio único que se usa para prevenir ataques de repetición
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.generateNonce = asyncHandler(async (req, res) => {
  // Generar nonce aleatorio con UUID y eliminar guiones para cumplir con requisitos de World ID
  const nonce = crypto.randomUUID().replace(/-/g, '');
  
  // Almacenar el nonce en una cookie segura
  // Esta cookie se usará más tarde para verificar el mensaje SIWE
  res.cookie('world_nonce', nonce, { 
    httpOnly: true, // No accesible desde JavaScript del cliente
    secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
    sameSite: 'strict', // Previene CSRF
    maxAge: 3600000 // Expiración de 1 hora
  });
  
  // Registrar en consola para depuración (remover en producción)
  console.log(`Nonce generado: ${nonce} para IP: ${req.ip}`);
  
  // Enviar el nonce al cliente
  return success(res, { nonce });
});

/**
 * Verifica si un nonce es válido comparándolo con el almacenado en la cookie
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.verifyNonce = asyncHandler(async (req, res) => {
  const { nonce } = req.body;
  
  // Obtener nonce almacenado en la cookie
  const storedNonce = req.cookies.world_nonce;
  
  // Verificar si existe el nonce almacenado
  if (!storedNonce) {
    return error(res, 'No se encontró nonce almacenado, genera uno nuevo', 400);
  }
  
  // Verificar si el nonce proporcionado coincide con el almacenado
  if (nonce !== storedNonce) {
    return error(res, 'Nonce inválido', 401);
  }
  
  // Si el nonce es válido, indicarlo en la respuesta
  return success(res, { valid: true });
});

/**
 * Limpia el nonce almacenado en la cookie
 * Se debe llamar después de usar el nonce para autenticación
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.clearNonce = asyncHandler(async (req, res) => {
  // Eliminar la cookie de nonce
  res.clearCookie('world_nonce');
  
  return success(res, { message: 'Nonce eliminado correctamente' });
});

/**
 * Genera un nonce con un tiempo de expiración específico para casos especiales
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.generateTimedNonce = asyncHandler(async (req, res) => {
  // Duración en segundos (por defecto 1 hora)
  const duration = parseInt(req.query.duration) || 3600;
  
  // Generar nonce aleatorio
  const nonce = crypto.randomUUID().replace(/-/g, '');
  
  // Crear timestamp de expiración
  const expiresAt = Date.now() + (duration * 1000);
  
  // Almacenar el nonce en una cookie con tiempo de expiración específico
  res.cookie('world_nonce', nonce, { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: duration * 1000 // Convertir segundos a milisegundos
  });
  
  // Enviar el nonce y su tiempo de expiración al cliente
  return success(res, { 
    nonce,
    expiresAt,
    expiresIn: `${duration} segundos`
  });
});