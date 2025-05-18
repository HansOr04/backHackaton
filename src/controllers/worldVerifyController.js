/**
 * worldVerifyController.js
 * Controlador para verificación de identidad con World ID
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const { success, error } = require('../utils/responseFormatter');
const { VERIFICATION_LEVELS } = require('../config/constants');
const { WORLD_APP_ID, SIMULATE_VERIFY } = require('../config/worldConfig');

/**
 * Verifica una prueba de World ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.verifyProof = asyncHandler(async (req, res) => {
  const { payload, action } = req.body;
  
  // Verificar que se proporcionaron los parámetros necesarios
  if (!payload || !action) {
    return error(res, 'Se requieren payload y action', 400);
  }
  
  try {
    // Si estamos en entorno de desarrollo y la simulación está habilitada
    if (SIMULATE_VERIFY && process.env.NODE_ENV !== 'production') {
      // Simular una verificación exitosa
      const nullifier_hash = `simulated_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const verification_level = payload.verification_level || VERIFICATION_LEVELS.DEVICE;
      
      // Si el usuario está autenticado, actualizar su nivel de verificación
      if (req.user) {
        const userId = req.user.id;
        
        // Cargar usuarios
        const users = await jsonStore.find('users');
        const userIndex = users.findIndex(user => user.id === userId);
        
        if (userIndex !== -1) {
          // Actualizar nivel de verificación si el nuevo es superior
          const currentLevel = users[userIndex].verificationLevel;
          const levelPriority = {
            [VERIFICATION_LEVELS.DEVICE]: 1,
            [VERIFICATION_LEVELS.PHONE]: 2,
            [VERIFICATION_LEVELS.ORB]: 3
          };
          
          if (!currentLevel || levelPriority[verification_level] > levelPriority[currentLevel]) {
            users[userIndex].verificationLevel = verification_level;
            users[userIndex].updatedAt = new Date().toISOString();
            await jsonStore.writeData('users', users);
          }
        }
      }
      
      return success(res, {
        verified: true,
        verification_level,
        nullifier_hash,
        action,
        simulated: true
      });
    }
    
    // En un entorno real, aquí se verificaría con la API de World ID
    // Código para verificar el payload con la API de World ID
    
    // Ejemplo de integración real (pseudocódigo):
    /*
    const response = await fetch(`${WORLD_API_HOST}${VERIFY_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEV_PORTAL_API_KEY}`
      },
      body: JSON.stringify({
        app_id: WORLD_APP_ID,
        action,
        nullifier_hash: payload.nullifier_hash,
        proof: payload.proof,
        merkle_root: payload.merkle_root,
        verification_level: payload.verification_level
      })
    });
    
    const verificationResult = await response.json();
    
    if (!verificationResult.success) {
      return error(res, verificationResult.error || 'Verificación fallida', 400);
    }
    */
    
    // Para este ejemplo, simulamos una respuesta exitosa
    const verification_level = payload.verification_level || VERIFICATION_LEVELS.DEVICE;
    const nullifier_hash = payload.nullifier_hash || `nh_${Date.now()}`;
    
    // Si el usuario está autenticado, actualizar su nivel de verificación
    if (req.user) {
      const userId = req.user.id;
      
      // Cargar usuarios
      const users = await jsonStore.find('users');
      const userIndex = users.findIndex(user => user.id === userId);
      
      if (userIndex !== -1) {
        // Actualizar nivel de verificación si el nuevo es superior
        const currentLevel = users[userIndex].verificationLevel;
        const levelPriority = {
          [VERIFICATION_LEVELS.DEVICE]: 1,
          [VERIFICATION_LEVELS.PHONE]: 2,
          [VERIFICATION_LEVELS.ORB]: 3
        };
        
        if (!currentLevel || levelPriority[verification_level] > levelPriority[currentLevel]) {
          users[userIndex].verificationLevel = verification_level;
          users[userIndex].updatedAt = new Date().toISOString();
          await jsonStore.writeData('users', users);
        }
      }
    }
    
    return success(res, {
      verified: true,
      verification_level,
      nullifier_hash,
      action
    });
  } catch (err) {
    console.error('World ID verification error:', err);
    return error(res, `Error de verificación: ${err.message}`, 500);
  }
});

/**
 * Verifica el nivel de verificación del usuario actual
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.checkVerificationLevel = asyncHandler(async (req, res) => {
  // Requiere autenticación
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { level } = req.query;
  
  // Si no se especifica un nivel, solo devolver el nivel actual
  if (!level) {
    return success(res, {
      currentLevel: req.user.verificationLevel || VERIFICATION_LEVELS.DEVICE
    });
  }
  
  // Verificar si el nivel solicitado es válido
  if (!Object.values(VERIFICATION_LEVELS).includes(level)) {
    return error(res, `Nivel de verificación inválido: ${level}`, 400);
  }
  
  // Determinar si el usuario tiene el nivel requerido
  const levelPriority = {
    [VERIFICATION_LEVELS.DEVICE]: 1,
    [VERIFICATION_LEVELS.PHONE]: 2,
    [VERIFICATION_LEVELS.ORB]: 3
  };
  
  const currentLevel = req.user.verificationLevel || VERIFICATION_LEVELS.DEVICE;
  const hasRequiredLevel = levelPriority[currentLevel] >= levelPriority[level];
  
  return success(res, {
    currentLevel,
    requiredLevel: level,
    verified: hasRequiredLevel,
    // Información adicional para guiar al usuario
    nextSteps: !hasRequiredLevel ? [
      level === VERIFICATION_LEVELS.PHONE ? 'Verifica tu número de teléfono en World App' : null,
      level === VERIFICATION_LEVELS.ORB ? 'Verifica tu identidad con un Orb de World ID' : null
    ].filter(Boolean) : []
  });
});

/**
 * Obtiene información de configuración para el proceso de verificación
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getVerificationInfo = asyncHandler(async (req, res) => {
  return success(res, {
    app_id: WORLD_APP_ID,
    action: 'login',
    verification_levels: Object.values(VERIFICATION_LEVELS),
    description: 'Inicia sesión para acceder a todos los servicios',
    simulation_enabled: SIMULATE_VERIFY && process.env.NODE_ENV !== 'production'
  });
});