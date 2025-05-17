/**
 * worldConfig.js
 * Configuración para integración con World ID, Mini Kit SDK y World Pay
 */

module.exports = {
  // ID de la aplicación en el portal de desarrolladores de World
  WORLD_APP_ID: process.env.WORLD_APP_ID,
  
  // API Key para el portal de desarrolladores de World
  DEV_PORTAL_API_KEY: process.env.DEV_PORTAL_API_KEY,
  
  // Endpoint para verificar pruebas de World ID
  VERIFY_ENDPOINT: 'https://developer.worldcoin.org/api/v1/verify',
  
  // Endpoint para verificar el estado de transacciones
  TRANSACTION_STATUS_ENDPOINT: 'https://developer.worldcoin.org/api/v2/minikit/transaction',
  
  // Endpoint para obtener el precio actual de WLD
  WLD_PRICE_ENDPOINT: 'https://developer.worldcoin.org/api/v1/wld/price',
  
  // Direcciones de contratos (opcional, para referencias)
  CONTRACTS: {
    WLD_TOKEN: '0x163f8c2956b2020ab3a335d2fb58b35875f88f25', // Dirección en Worldchain
  },
  
  // Configuración para SIWE (Sign In With Ethereum)
  SIWE: {
    DOMAIN: process.env.SIWE_DOMAIN || 'service-marketplace.com',
    STATEMENT: 'Sign in to Service Marketplace using World ID',
    URI: process.env.FRONTEND_URL || 'https://service-marketplace.com',
    VERSION: '1',
    CHAIN_ID: 1, // Ethereum Mainnet
  }
};