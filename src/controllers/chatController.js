/**
 * chatController.js
 * Controlador para el chat con respuestas automáticas
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const { success, error } = require('../utils/responseFormatter');
const aiChatConfig = require('../config/aiChatConfig');
const textMatcher = require('../utils/textMatcher');

/**
 * Envía un mensaje al chat y obtiene respuesta automática
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;
  
  if (!message || typeof message !== 'string') {
    return error(res, 'Se requiere un mensaje válido', 400);
  }
  
  // Normalizar mensaje
  const normalizedMessage = normalizeText(message);
  
  // Cargar datos necesarios
  const categories = await jsonStore.find('categories');
  const services = await jsonStore.find('services');
  const chatResponses = await jsonStore.find('chatResponses') || [];
  
  // 1. Verificar si es un saludo
  if (isGreeting(normalizedMessage)) {
    return success(res, {
      type: 'text',
      message: getRandomGreeting(),
      suggestions: aiChatConfig.DEFAULT_SUGGESTIONS
    });
  }
  
  // 2. Buscar categorías relacionadas
  const matchedCategories = categories.filter(category => {
    // Si la categoría tiene keywords, buscar coincidencias
    if (category.keywords && category.keywords.length > 0) {
      return textMatcher.hasKeywords(normalizedMessage, category.keywords);
    }
    
    // Si no tiene keywords, buscar en el nombre y descripción
    return (
      normalizedMessage.includes(normalizeText(category.name)) ||
      (category.description && normalizedMessage.includes(normalizeText(category.description)))
    );
  });
  
  // 3. Buscar servicios relacionados
  const matchedServices = services.filter(service => {
    // Solo considerar servicios activos
    if (service.active === false) return false;
    
    // Si el servicio tiene keywords, buscar coincidencias
    if (service.keywords && service.keywords.length > 0) {
      return textMatcher.hasKeywords(normalizedMessage, service.keywords);
    }
    
    // Si no tiene keywords, buscar en el título y descripción
    return (
      normalizedMessage.includes(normalizeText(service.title)) ||
      (service.description && normalizedMessage.includes(normalizeText(service.description)))
    );
  });
  
  // 4. Si hay categorías o servicios coincidentes, devolver resultados
  if (matchedCategories.length > 0 || matchedServices.length > 0) {
    // Limitar cantidad de resultados
    const limitedCategories = matchedCategories.slice(0, aiChatConfig.MAX_RESULTS.CATEGORIES);
    const limitedServices = matchedServices.slice(0, aiChatConfig.MAX_RESULTS.SERVICES);
    
    // Obtener información adicional para servicios
    const servicesWithDetails = [];
    
    for (const service of limitedServices) {
      const category = categories.find(cat => cat.id === service.category);
      const users = await jsonStore.find('users');
      const provider = users.find(user => user.id === service.provider);
      
      servicesWithDetails.push({
        id: service.id,
        title: service.title,
        description: service.description,
        price: service.price,
        category: category ? {
          id: category.id,
          name: category.name
        } : null,
        provider: provider ? {
          id: provider.id,
          name: provider.name
        } : null
      });
    }
    
    return success(res, {
      type: 'search_results',
      message: '¡He encontrado algunas opciones que podrían interesarte!',
      categories: limitedCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        icon: cat.icon
      })),
      services: servicesWithDetails
    });
  }
  
  // 5. Buscar en respuestas predefinidas
  for (const response of chatResponses) {
    if (textMatcher.hasKeywords(normalizedMessage, response.keywords)) {
      return success(res, {
        type: 'text',
        message: response.text,
        suggestions: response.suggestions || aiChatConfig.DEFAULT_SUGGESTIONS
      });
    }
  }
  
  // 6. Si no hay coincidencias, dar respuesta por defecto
  const defaultResponse = getRandomDefaultResponse();
  
  return success(res, {
    type: 'text',
    message: defaultResponse,
    suggestions: aiChatConfig.DEFAULT_SUGGESTIONS
  });
});

/**
 * Obtiene sugerencias para el chat
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getChatSuggestions = asyncHandler(async (req, res) => {
  // Obtener categorías populares
  const categories = await jsonStore.find('categories');
  const popularCategories = categories
    .filter(cat => cat.popular === true)
    .map(cat => `Busco servicios de ${cat.name}`);
  
  // Combinar con sugerencias por defecto
  const suggestions = [
    ...popularCategories.slice(0, 3),
    ...aiChatConfig.DEFAULT_SUGGESTIONS
  ].slice(0, aiChatConfig.MAX_RESULTS.SUGGESTIONS);
  
  return success(res, { suggestions });
});

/**
 * Normaliza texto para búsquedas
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto normalizado
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Verifica si un mensaje es un saludo
 * @param {string} message - Mensaje normalizado
 * @returns {boolean} Si es un saludo
 */
function isGreeting(message) {
  return aiChatConfig.GREETING_PHRASES.some(phrase => 
    message.includes(phrase) || message === phrase
  );
}

/**
 * Obtiene un saludo aleatorio
 * @returns {string} Saludo aleatorio
 */
function getRandomGreeting() {
  const greetings = [
    '¡Hola! Soy el asistente virtual del Marketplace de Servicios. ¿En qué puedo ayudarte hoy?',
    '¡Bienvenido! ¿Qué tipo de servicio estás buscando?',
    'Hola, estoy aquí para ayudarte a encontrar el servicio perfecto. ¿Qué necesitas?',
    '¡Saludos! Cuéntame, ¿qué tipo de servicio estás buscando?'
  ];
  
  return greetings[Math.floor(Math.random() * greetings.length)];
}

/**
 * Obtiene una respuesta por defecto aleatoria
 * @returns {string} Respuesta por defecto
 */
function getRandomDefaultResponse() {
  return aiChatConfig.DEFAULT_RESPONSES[
    Math.floor(Math.random() * aiChatConfig.DEFAULT_RESPONSES.length)
  ];
}