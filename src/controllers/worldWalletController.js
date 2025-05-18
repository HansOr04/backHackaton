/**
 * worldWalletController.js
 * Controlador para autorización de uso de wallet
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const { success, error } = require('../utils/responseFormatter');
const tokenConfig = require('../config/tokenConfig');
const { VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Solicita autorización para usar la wallet
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.requestWalletAuthorization = asyncHandler(async (req, res) => {
  const { walletAddress } = req.body;
  
  if (!walletAddress) {
    return error(res, 'Dirección de wallet requerida', 400);
  }
  
  // Generar nonce para la solicitud
  const nonce = tokenConfig.generateNonce();
  
  // Almacenar nonce en cookie segura
  res.cookie(tokenConfig.COOKIE_NAMES.WORLD_NONCE, nonce, {
    ...tokenConfig.COOKIE_OPTIONS,
    maxAge: tokenConfig.EXPIRY.NONCE * 1000 // Convertir segundos a milisegundos
  });
  
  // Obtener o crear usuario basado en la dirección de wallet
  const users = await jsonStore.find('users');
  let user = users.find(u => 
    u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (!user) {
    // Crear nuevo usuario
    user = {
      id: jsonStore.generateId(),
      walletAddress: walletAddress.toLowerCase(),
      name: `Usuario-${walletAddress.substring(0, 6)}`,
      verificationLevel: VERIFICATION_LEVELS.DEVICE,
      walletAuthorized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    users.push(user);
    await jsonStore.writeData('users', users);
  }
  
  // Generar ID de solicitud
  const requestId = `req_${Date.now()}`;
  
  // En una implementación real, aquí se almacenaría la solicitud pendiente
  
  return success(res, {
    requestId,
    nonce,
    message: 'Por favor autoriza el uso de tu wallet en World App',
    walletAddress,
    userId: user.id
  });
});

/**
 * Completa la autorización de wallet
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.completeWalletAuthorization = asyncHandler(async (req, res) => {
  const { requestId, signature, walletAddress } = req.body;
  
  if (!requestId || !signature || !walletAddress) {
    return error(res, 'Datos de autorización incompletos', 400);
  }
  
  // En una implementación real, aquí se verificaría la firma criptográfica
  
  // Recuperar nonce de la cookie
  const nonce = req.cookies[tokenConfig.COOKIE_NAMES.WORLD_NONCE];
  
  if (!nonce) {
    return error(res, 'Sesión expirada o inválida', 401);
  }
  
  // Limpiar cookie de nonce
  res.clearCookie(tokenConfig.COOKIE_NAMES.WORLD_NONCE);
  
  // Buscar usuario por dirección de wallet
  const users = await jsonStore.find('users');
  const userIndex = users.findIndex(u => 
    u.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
  
  if (userIndex === -1) {
    return error(res, 'Usuario no encontrado', 404);
  }
  
  // Actualizar usuario para marcar la wallet como autorizada
  users[userIndex].walletAuthorized = true;
  users[userIndex].updatedAt = new Date().toISOString();
  
  await jsonStore.writeData('users', users);
  
  // Generar token JWT para autenticación
  const token = tokenConfig.generateAccessToken(
    users[userIndex].id, 
    users[userIndex].walletAddress
  );
  
  // Almacenar token en cookie si se desea
  res.cookie(tokenConfig.COOKIE_NAMES.AUTH_TOKEN, token, tokenConfig.COOKIE_OPTIONS);
  
  return success(res, {
    authorized: true,
    walletAddress: users[userIndex].walletAddress,
    userId: users[userIndex].id,
    token,
    user: {
      id: users[userIndex].id,
      name: users[userIndex].name,
      verificationLevel: users[userIndex].verificationLevel
    }
  });
});

/**
 * Verifica si la wallet está autorizada
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.checkWalletAuthorization = asyncHandler(async (req, res) => {
  // Verificar autenticación
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { walletAddress } = req.query;
  
  // Si no se especifica dirección, usar la del usuario autenticado
  const addressToCheck = walletAddress || req.user.walletAddress;
  
  // Buscar usuario con esta wallet
  const users = await jsonStore.find('users');
  const user = users.find(u => 
    u.walletAddress.toLowerCase() === addressToCheck.toLowerCase()
  );
  
  if (!user) {
    return error(res, 'Wallet no registrada', 404);
  }
  
  return success(res, {
    walletAddress: user.walletAddress,
    authorized: !!user.walletAuthorized,
    userId: user.id,
    verificationLevel: user.verificationLevel
  });
});

/**
 * Desconecta la wallet actual (cierre de sesión)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.disconnectWallet = asyncHandler(async (req, res) => {
  // Verificar autenticación
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Limpiar cookie de autenticación
  res.clearCookie(tokenConfig.COOKIE_NAMES.AUTH_TOKEN);
  
  return success(res, {
    message: 'Wallet desconectada exitosamente',
    walletAddress: req.user.walletAddress
  });
});