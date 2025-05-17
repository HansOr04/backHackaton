/**
 * worldWalletAuthService.js
 * Servicio para autenticación con World Wallet (SIWE - Sign In With Ethereum)
 */

const { verifySiweMessage } = require('@worldcoin/minikit-js');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Servicio para manejar la autenticación de World Wallet (SIWE)
 */
const worldWalletAuthService = {
  /**
   * Verifica un mensaje SIWE y autentica o registra al usuario
   * @param {Object} payload - Payload recibido de World App
   * @param {string} nonce - Nonce utilizado para generar el mensaje SIWE
   * @returns {Promise<Object>} Resultado de la autenticación
   */
  async verify(payload, nonce) {
    try {
      // Verificar el mensaje SIWE con la biblioteca de World
      const validationResult = await verifySiweMessage(payload, nonce);
      
      if (!validationResult.isValid) {
        throw new Error('SIWE validation failed');
      }
      
      // Extraer la dirección de wallet del payload
      const walletAddress = payload.address.toLowerCase();
      
      // Buscar o crear usuario basado en la dirección de wallet
      let user = await User.findOne({ walletAddress });
      
      if (!user) {
        // Crear nuevo usuario si no existe
        user = new User({
          walletAddress,
          worldUsername: payload.worldUsername || null, // Si está disponible en el payload
          name: payload.worldUsername || `User-${walletAddress.slice(0, 6)}` // Nombre temporal basado en la dirección
        });
        
        await user.save();
        console.log(`New user registered: ${walletAddress}`);
      } else {
        // Actualizar worldUsername si ha cambiado
        if (payload.worldUsername && user.worldUsername !== payload.worldUsername) {
          user.worldUsername = payload.worldUsername;
          await user.save();
        }
      }
      
      // Generar JWT para autenticación futura
      const token = jwt.sign(
        { 
          id: user._id, 
          walletAddress: user.walletAddress 
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: '7d' // Token válido por 7 días
        }
      );
      
      // Devolver información de autenticación
      return {
        token,
        user: user.getPublicProfile()
      };
    } catch (error) {
      console.error('SIWE verification error:', error);
      throw error;
    }
  },
  
  /**
   * Revalida un token JWT existente
   * @param {string} token - Token JWT a revalidar
   * @returns {Promise<Object>} Nuevo token JWT
   */
  async refreshToken(token) {
    try {
      // Verificar token actual
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario
      const user = await User.findById(decoded.id);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generar nuevo token
      const newToken = jwt.sign(
        { 
          id: user._id, 
          walletAddress: user.walletAddress 
        },
        process.env.JWT_SECRET,
        { 
          expiresIn: '7d'
        }
      );
      
      return {
        token: newToken,
        user: user.getPublicProfile()
      };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },
  
  /**
   * Verifica la validez de un token JWT
   * @param {string} token - Token JWT a verificar
   * @returns {Promise<boolean>} Resultado de la verificación
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar que el usuario sigue existiendo
      const user = await User.findById(decoded.id);
      
      return !!user;
    } catch (error) {
      return false;
    }
  }
};

module.exports = worldWalletAuthService;