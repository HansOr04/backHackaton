/**
 * constants.js
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
  
  // Estados de transacciones
  TRANSACTION_STATUS: {
    PENDING: 'pending',
    MINED: 'mined',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },
  
  // Niveles de verificación de World ID
  VERIFICATION_LEVELS: {
    ORB: 'orb',
    PHONE: 'phone',
    DEVICE: 'device'
  },
  
  // Costo para desbloquear un servicio
  SERVICE_UNLOCK_COST: 1, // en WLD
  
  // Categorías disponibles
  CATEGORIES: [
    "web-development",
    "software-architecture",
    "mobile-app-development",
    "android",
    "ios-development",
    "machine-learning",
    "desktop-app",
    "game-development",
    "api",
    "database-development",
    "web-scraping",
    "article-writing",
    "content-writing",
    "ghostwriting",
    "copywriting",
    "research-writing",
    "graphic-design",
    "logo-design",
    "photoshop",
    "illustrator",
    "user-interface-ia",
    "website-design",
    "data-entry",
    "virtual-assistant",
    "customer-support",
    "excel",
    "web-search",
    "engineering",
    "electrical-engineering",
    "electronics",
    "mechanical-engineering",
    "cad-cam",
    "product-design",
    "accounting",
    "finance",
    "business-analysis",
    "project-management",
    "human-resources",
    "legal",
    "internet-marketing",
    "seo",
    "facebook-marketing",
    "social-media-marketing",
    "sales",
    "translation",
    "english-uk-translator",
    "english-us-translator",
    "spanish-translator",
    "french-translator",
    "general-labor",
    "handyman",
    "education-tutoring",
    "psychology",
    "nutrition",
    "health"
  ],
  
  // Categorías destacadas/populares
  POPULAR_CATEGORIES: [
    "web-development",
    "graphic-design",
    "content-writing",
    "mobile-app-development",
    "seo"
  ],
  
  // API endpoints
  API: {
    CATEGORIES: '/api/categories',
    SERVICES: '/api/services',
    WORLDVERIFY: '/api/worldverify',
    WALLETAUTH: '/api/walletauth',
    PAYMENT: '/api/payment',
    CHAT: '/api/chat'
  },
  
  // Duración de desbloqueo de servicio (en días)
  SERVICE_UNLOCK_DURATION: 30,
  
  // Límites de paginación
  PAGINATION: {
    DEFAULT_LIMIT: 10,
    MAX_LIMIT: 50
  }
};