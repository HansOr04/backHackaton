/**
 * worldVerifyService.js
 * Servicio para verificar pruebas de World ID (verificación de humanidad)
 */

const { verifyCloudProof } = require('@worldcoin/minikit-js');
const { WORLD_APP_ID } = require('../config/worldConfig');
const User = require('../models/User');
const { VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Servicio para manejar la verificación de identidad con World ID
 */
const worldVerifyService = {
  /**
   * Verifica una prueba de World ID
   * @param {Object} payload - Payload recibido de World App
   * @param {string} action - Acción (ID de acción) que se está verificando
   * @param {string} signal - Señal opcional para la verificación
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verifyProof(payload, action, signal) {
    try {
      // Verificar la prueba con la API de World
      const verifyResult = await verifyCloudProof(
        payload,
        WORLD_APP_ID,
        action,
        signal
      );
      
      if (!verifyResult.success) {
        console.error('World ID verification failed:', verifyResult);
        return {
          success: false,
          message: verifyResult.error || 'Verification failed'
        };
      }
      
      return {
        success: true,
        verification_level: payload.verification_level,
        nullifier_hash: payload.nullifier_hash,
        action
      };
    } catch (error) {
      console.error('World ID verification error:', error);
      return {
        success: false,
        message: error.message || 'Verification error'
      };
    }
  },
  
  /**
   * Registra una verificación exitosa para un usuario
   * @param {string} userId - ID del usuario
   * @param {string} verification_level - Nivel de verificación
   * @returns {Promise<Object>} Usuario actualizado
   */
  async recordSuccessfulVerification(userId, verification_level) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Actualizar el nivel de verificación del usuario si es superior al actual
      const currentLevel = user.verificationLevel;
      
      // Determinar qué nivel es "más alto"
      const levelPriority = {
        [VERIFICATION_LEVELS.DEVICE]: 1,
        [VERIFICATION_LEVELS.PHONE]: 2,
        [VERIFICATION_LEVELS.ORB]: 3
      };
      
      if (levelPriority[verification_level] > levelPriority[currentLevel]) {
        user.verificationLevel = verification_level;
        await user.save();
        console.log(`User ${userId} verification level updated to ${verification_level}`);
      }
      
      return user;
    } catch (error) {
      console.error('Error recording verification:', error);
      throw error;
    }
  },
  
  /**
   * Verifica si un usuario tiene el nivel mínimo de verificación requerido
   * @param {string} userId - ID del usuario
   * @param {string} requiredLevel - Nivel de verificación requerido
   * @returns {Promise<boolean>} Si el usuario cumple el nivel requerido
   */
  async hasRequiredVerificationLevel(userId, requiredLevel) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return false;
      }
      
      const levelPriority = {
        [VERIFICATION_LEVELS.DEVICE]: 1,
        [VERIFICATION_LEVELS.PHONE]: 2,
        [VERIFICATION_LEVELS.ORB]: 3
      };
      
      return levelPriority[user.verificationLevel] >= levelPriority[requiredLevel];
    } catch (error) {
      console.error('Error checking verification level:', error);
      return false;
    }
  },
  
  /**
   * Genera un ID de acción específico para el contexto
   * @param {string} baseAction - Acción base registrada en el portal de World
   * @param {string} contextId - ID de contexto (ej: ID de proyecto)
   * @returns {string} ID de acción completo
   */
  generateContextSpecificActionId(baseAction, contextId) {
    return `${baseAction}:${contextId}`;
  }
};

module.exports = worldVerifyService;