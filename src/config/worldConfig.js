/**
 * worldConfig.js
 * Configuración para integración con World ID, Mini Kit SDK y World Pay
 */

module.exports = {
  // ID de la aplicación en el portal de desarrolladores de World
  WORLD_APP_ID: process.env.WORLD_APP_ID || 'app_default_test_id',
  
  // API Key para el portal de desarrolladores de World
  DEV_PORTAL_API_KEY: process.env.DEV_PORTAL_API_KEY || 'dev_portal_api_key',
  
  // Host de la API de World ID
  WORLD_API_HOST: 'https://developer.worldcoin.org',
  
  // Endpoint para verificar pruebas de World ID
  VERIFY_ENDPOINT: '/api/v1/verify',
  
  // Endpoint para verificar el estado de transacciones
  TRANSACTION_STATUS_ENDPOINT: '/api/v2/minikit/transaction',
  
  // Endpoint para obtener el precio actual de WLD
  WLD_PRICE_ENDPOINT: '/api/v1/wld/price',
  
  // Direcciones de contratos (opcional, para referencias)
  CONTRACTS: {
    WLD_TOKEN: '0x163f8c2956b2020ab3a335d2fb58b35875f88f25', // Dirección ejemplo en Worldchain
  },
  
  // Configuración para SIWE (Sign In With Ethereum)
  SIWE: {
    DOMAIN: process.env.SIWE_DOMAIN || 'marketplace.ejemplo.com',
    STATEMENT: 'Iniciar sesión en el Marketplace de Servicios con World ID',
    URI: process.env.FRONTEND_URL || 'https://marketplace.ejemplo.com',
    VERSION: '1',
    CHAIN_ID: 1 // Ethereum Mainnet
  },
  
  // Configuración para la SDK de Mini Kit
  MINIKIT: {
    // Acciones permitidas para verificación
    ACTIONS: {
      LOGIN: 'login',
      UNLOCK_SERVICE: 'unlock_service'
    },
    
    // Parámetros de verificación
    VERIFICATION: {
      APP_NAME: 'Marketplace de Servicios',
      ACTION_DESCRIPTION: 'Verificarse para acceder a servicios premium',
      MAX_CREDENTIAL_EXPIRATION_MINUTES: 60
    }
  },
  
  // Configuración para World Pay
  WORLD_PAY: {
    MIN_AMOUNT: 0.1, // Monto mínimo para pagos (WLD)
    MERCHANT_ID: process.env.WORLD_MERCHANT_ID || 'merchant_id',
    SERVICE_FEE_PERCENTAGE: 0, // World App no cobra tarifas por ahora
    CONFIRMATION_BLOCKS: 1 // Bloques para confirmar una transacción
  },
  
  // Para depuración en desarrollo
  SIMULATE_VERIFY: process.env.NODE_ENV !== 'production',
  SIMULATE_PAYMENT: process.env.NODE_ENV !== 'production'
};