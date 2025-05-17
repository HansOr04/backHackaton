/**
 * worldAuthController.js
 * Controlador para manejar la autenticación con World Wallet (SIWE)
 */

const asyncHandler = require('../utils/asyncHandler');
const worldWalletAuthService = require('../services/worldWalletAuthService');
const { success, error } = require('../utils/responseFormatter');
const { SIWE } = require('../config/worldConfig');

/**
 * Completa el proceso de autenticación SIWE (Sign In With Ethereum)
 * Verifica el mensaje firmado y genera un token JWT
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.completeSiwe = asyncHandler(async (req, res) => {
  const { payload, nonce } = req.body;
  
  // Verificar que se recibió el payload y el nonce
  if (!payload || !nonce) {
    return error(res, 'Se requieren payload y nonce', 400);
  }
  
  // Obtener nonce almacenado en la cookie
  const storedNonce = req.cookies.world_nonce;
  
  // Verificar que el nonce coincide con el almacenado
  if (nonce !== storedNonce) {
    return error(res, 'Nonce inválido o expirado', 401);
  }
  
  try {
    // Verificar el payload con el servicio de autenticación
    const authResult = await worldWalletAuthService.verify(payload, nonce);
    
    // Limpiar el nonce usado
    res.clearCookie('world_nonce');
    
    // Retornar el resultado exitoso con el token JWT y datos del usuario
    return success(res, {
      message: 'Autenticación exitosa',
      token: authResult.token,
      user: authResult.user
    });
  } catch (err) {
    console.error('SIWE verification error:', err);
    return error(res, `Error de autenticación: ${err.message}`, 401);
  }
});

/**
 * Renueva un token JWT existente
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  // Obtener token de los headers
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Se requiere token de autorización', 401);
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Renovar el token con el servicio de autenticación
    const refreshResult = await worldWalletAuthService.refreshToken(token);
    
    return success(res, {
      message: 'Token renovado exitosamente',
      token: refreshResult.token,
      user: refreshResult.user
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    return error(res, `Error al renovar token: ${err.message}`, 401);
  }
});

/**
 * Verifica si un token JWT es válido
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.verifyToken = asyncHandler(async (req, res) => {
  // Obtener token de los headers
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Se requiere token de autorización', 401);
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verificar el token con el servicio de autenticación
    const isValid = await worldWalletAuthService.verifyToken(token);
    
    if (!isValid) {
      return error(res, 'Token inválido o expirado', 401);
    }
    
    return success(res, {
      valid: true,
      message: 'Token válido'
    });
  } catch (err) {
    return error(res, `Error al verificar token: ${err.message}`, 401);
  }
});

/**
 * Proporciona información para generar un mensaje SIWE personalizado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getSiweInfo = asyncHandler(async (req, res) => {
  // Obtener el nonce (debe haberse generado previamente)
  const storedNonce = req.cookies.world_nonce;
  
  if (!storedNonce) {
    return error(res, 'No se encontró nonce, genera uno primero', 400);
  }
  
  // Proporcionar información para construir el mensaje SIWE
  return success(res, {
    domain: SIWE.DOMAIN,
    statement: SIWE.STATEMENT,
    uri: SIWE.URI,
    version: SIWE.VERSION,
    chainId: SIWE.CHAIN_ID,
    nonce: storedNonce
  });
});

/**
 * Cierra la sesión del usuario
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.logout = asyncHandler(async (req, res) => {
  // En un sistema de autenticación basado en JWT, el cierre de sesión se maneja principalmente en el cliente
  // Sin embargo, podemos limpiar cookies o realizar otras acciones en el servidor
  
  // Limpiar cualquier cookie relacionada con la autenticación
  res.clearCookie('world_nonce');
  
  return success(res, {
    message: 'Sesión cerrada exitosamente'
  });
});