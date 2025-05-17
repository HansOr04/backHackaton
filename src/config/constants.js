/**
 * Constants.js
 * Constantes globales para la aplicación
 */

module.exports = {
  // JWT
  JWT_EXPIRY: '7d',
  
  // Tokens soportados para pagos
  TOKENS: {
    WLD: 'WLD',
    USDCE: 'USDC.e'
  },
  
  // Redes blockchain
  NETWORKS: {
    WORLDCHAIN: 'worldchain'
  },
  
  // Estados de proyectos
  PROJECT_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  // Estados de transacciones
  TRANSACTION_STATUS: {
    PENDING: 'pending',
    MINED: 'mined',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  
  // Tipos de precio de servicios
  PRICE_TYPES: {
    FIXED: 'fixed',
    HOURLY: 'hourly',
    NEGOTIABLE: 'negotiable'
  },
  
  // Niveles de verificación de World ID
  VERIFICATION_LEVELS: {
    ORB: 'orb',
    PHONE: 'phone',
    DEVICE: 'device'
  }
};