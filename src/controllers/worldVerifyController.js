/**
 * worldVerifyController.js
 * Controlador para verificación de identidad con World ID
 */

const asyncHandler = require('../utils/asyncHandler');
const worldVerifyService = require('../services/worldVerifyService');
const { success, error } = require('../utils/responseFormatter');
const { VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Verifica una prueba de World ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.verifyProof = asyncHandler(async (req, res) => {
  const { payload, action, signal } = req.body;
  
  // Verificar que se proporcionaron los parámetros necesarios
  if (!payload || !action) {
    return error(res, 'Se requieren payload y action', 400);
  }
  
  try {
    // Verificar la prueba con World ID
    const verifyResult = await worldVerifyService.verifyProof(payload, action, signal);
    
    if (!verifyResult.success) {
      return error(res, verifyResult.message || 'Verificación fallida', 400);
    }
    
    // Si el usuario está autenticado, actualizar su nivel de verificación
    if (req.user) {
      await worldVerifyService.recordSuccessfulVerification(
        req.user.id,
        verifyResult.verification_level
      );
    }
    
    // Retornar el resultado exitoso
    return success(res, {
      verified: true,
      verification_level: verifyResult.verification_level,
      nullifier_hash: verifyResult.nullifier_hash,
      action: verifyResult.action
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
  // Requiere que el middleware de autenticación se haya ejecutado
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { level } = req.query;
  
  // Si no se especifica un nivel, solo devolver el nivel actual
  if (!level) {
    return success(res, {
      currentLevel: req.user.verificationLevel
    });
  }
  
  // Verificar si el nivel solicitado es válido
  if (!Object.values(VERIFICATION_LEVELS).includes(level)) {
    return error(res, `Nivel de verificación inválido: ${level}`, 400);
  }
  
  // Comprobar si el usuario cumple con el nivel requerido
  const hasRequiredLevel = await worldVerifyService.hasRequiredVerificationLevel(
    req.user.id,
    level
  );
  
  return success(res, {
    currentLevel: req.user.verificationLevel,
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
 * Genera un ID de acción específico para un contexto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.generateActionId = asyncHandler(async (req, res) => {
  const { baseAction, contextId } = req.body;
  
  if (!baseAction || !contextId) {
    return error(res, 'Se requieren baseAction y contextId', 400);
  }
  
  const actionId = worldVerifyService.generateContextSpecificActionId(
    baseAction,
    contextId
  );
  
  return success(res, { actionId });
});

/**
 * Obtiene los requisitos de verificación para una acción específica
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getVerificationRequirements = asyncHandler(async (req, res) => {
  const { action } = req.params;
  
  // Definir los requisitos para diferentes acciones
  // Esto podría venir de una base de datos en una implementación más compleja
  const requirements = {
    'create_proposal': {
      level: VERIFICATION_LEVELS.DEVICE,
      description: 'Para crear propuestas, se requiere verificación de dispositivo'
    },
    'accept_proposal': {
      level: VERIFICATION_LEVELS.PHONE,
      description: 'Para aceptar propuestas, se requiere verificación de teléfono'
    },
    'withdraw_funds': {
      level: VERIFICATION_LEVELS.ORB,
      description: 'Para retirar fondos, se requiere verificación de Orb'
    },
    'default': {
      level: VERIFICATION_LEVELS.DEVICE,
      description: 'Para esta acción, se requiere verificación de dispositivo'
    }
  };
  
  // Obtener los requisitos para la acción solicitada o usar los predeterminados
  const actionRequirements = requirements[action] || requirements.default;
  
  return success(res, {
    action,
    ...actionRequirements
  });
});