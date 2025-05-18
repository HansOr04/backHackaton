/**
 * tokenConfig.js
 * Configuración relacionada con tokens, autenticación y JWT
 */

const jwt = require('jsonwebtoken');

// Configuración de tokens
const tokenConfig = {
  // Secreto para firmar JWTs
  JWT_SECRET: process.env.JWT_SECRET || 'marketplace_secret_key',
  
  // Opciones de JWT
  JWT_OPTIONS: {
    expiresIn: '7d', // 7 días de validez
    algorithm: 'HS256'
  },
  
  /**
   * Genera un token de acceso JWT
   * @param {string} userId - ID del usuario
   * @param {string} walletAddress - Dirección de wallet del usuario
   * @returns {string} Token JWT
   */
  generateAccessToken: (userId, walletAddress) => {
    return jwt.sign(
      { 
        id: userId, 
        walletAddress,
        timestamp: Date.now()
      },
      process.env.JWT_SECRET || 'marketplace_secret_key',
      { expiresIn: '7d' }
    );
  },
  
  /**
   * Verifica un token JWT
   * @param {string} token - Token a verificar
   * @returns {Object|null} Payload decodificado o null si es inválido
   */
  verifyToken: (token) => {
    try {
      return jwt.verify(
        token, 
        process.env.JWT_SECRET || 'marketplace_secret_key'
      );
    } catch (error) {
      return null;
    }
  },
  
  // Configuración de cookies
  COOKIE_OPTIONS: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
  },
  
  // Nombres de cookies
  COOKIE_NAMES: {
    AUTH_TOKEN: 'auth_token',
    WORLD_NONCE: 'world_nonce'
  },
  
  // Valores de tiempo para expiración
  EXPIRY: {
    NONCE: 3600, // 1 hora en segundos
    SESSION: 7 * 24 * 60 * 60, // 7 días en segundos
    SERVICE_UNLOCK: 30 * 24 * 60 * 60 * 1000 // 30 días en milisegundos
  },
  
  /**
   * Obtiene un nonce aleatorio para World Wallet
   * @returns {string} Nonce generado
   */
  generateNonce: () => {
    // Generar un valor aleatorio
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
};

module.exports = tokenConfig;