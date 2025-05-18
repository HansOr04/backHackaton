/**
 * chatService.js
 * Servicio para procesar mensajes del chat y generar respuestas automáticas
 */

const jsonStore = require('../utils/jsonStore');
const textMatcher = require('../utils/textMatcher');
const ChatResponse = require('../models/ChatResponse');
const aiChatConfig = require('../config/aiChatConfig');

/**
 * Procesa un mensaje y genera respuesta automática
 * @param {string} message - Mensaje del usuario
 * @returns {Promise<Object>} Respuesta generada
 */
exports.processMessage = async (message) => {
  // Normalizar mensaje
  const normalizedMessage = normalizeText(message);
  
  // Verificar si es un saludo
  if (isGreeting(normalizedMessage)) {
    return {
      type: 'text',
      message: getRandomGreeting(),
      suggestions: aiChatConfig.DEFAULT_SUGGESTIONS
    };
  }
  
  // Verificar si es una despedida
  if (isFarewell(normalizedMessage)) {
    return {
      type: 'text',
      message: getRandomFarewell(),
      suggestions: []
    };
  }
  
  // Cargar datos necesarios
  const categories = await jsonStore.find('categories');
  const services = await jsonStore.find('services');
  const chatResponses = await jsonStore.find('chatResponses') || [];
  
  // Convertir a instancias del modelo ChatResponse
  const responseModels = chatResponses.map(response => new ChatResponse(response));
  
  // 1. Buscar respuestas predefinidas con coincidencia exacta
  const exactMatches = responseModels.filter(response => 
    response.matchesText(normalizedMessage) && response.active
  );
  
  if (exactMatches.length > 0) {
    // Ordenar por prioridad y relevancia
    const sorted = exactMatches.sort((a, b) => {
      const relevanceA = a.calculateRelevance(normalizedMessage);
      const relevanceB = b.calculateRelevance(normalizedMessage);
      return relevanceB - relevanceA;
    });
    
    // Usar la mejor coincidencia
    const bestMatch = sorted[0];
    
    // Si la respuesta tiene categorías o servicios asociados, incluirlos
    const relatedCategories = [];
    const relatedServices = [];
    
    if (bestMatch.categoryIds && bestMatch.categoryIds.length > 0) {
      for (const catId of bestMatch.categoryIds) {
        const category = categories.find(c => c.id === catId);
        if (category && category.active) {
          relatedCategories.push({
            id: category.id,
            name: category.name,
            description: category.description,
            icon: category.icon
          });
        }
      }
    }
    
    if (bestMatch.serviceIds && bestMatch.serviceIds.length > 0) {
      for (const svcId of bestMatch.serviceIds) {
        const service = services.find(s => s.id === svcId);
        if (service && service.active) {
          const category = categories.find(c => c.id === service.category);
          const relatedService = {
            id: service.id,
            title: service.title,
            description: service.description,
            price: service.price,
            category: category ? {
              id: category.id,
              name: category.name
            } : null
          };
          relatedServices.push(relatedService);
        }
      }
    }
    
    // Si hay categorías o servicios relacionados, devolverlos con la respuesta
    if (relatedCategories.length > 0 || relatedServices.length > 0) {
      return {
        type: 'search_results',
        message: bestMatch.text,
        categories: relatedCategories,
        services: relatedServices,
        suggestions: bestMatch.suggestions || []
      };
    }
    
    // Si no hay relacionados, devolver solo el texto
    return {
      type: 'text',
      message: bestMatch.text,
      suggestions: bestMatch.suggestions || aiChatConfig.DEFAULT_SUGGESTIONS
    };
  }
  
  // 2. Buscar coincidencias en categorías
  const matchedCategories = categories.filter(category => {
    if (!category.active) return false;
    
    // Comprobar coincidencia en nombre
    if (normalizedMessage.includes(normalizeText(category.name))) {
      return true;
    }
    
    // Comprobar coincidencia en palabras clave
    if (category.keywords && category.keywords.length > 0) {
      return textMatcher.hasKeywords(normalizedMessage, category.keywords);
    }
    
    return false;
  }).slice(0, aiChatConfig.MAX_RESULTS.CATEGORIES);
  
  // 3. Buscar coincidencias en servicios
  const matchedServices = services.filter(service => {
    if (!service.active) return false;
    
    // Comprobar coincidencia en título
    if (normalizedMessage.includes(normalizeText(service.title))) {
      return true;
    }
    
    // Comprobar coincidencia en palabras clave
    if (service.keywords && service.keywords.length > 0) {
      return textMatcher.hasKeywords(normalizedMessage, service.keywords);
    }
    
    // Comprobar coincidencia en tags
    if (service.tags && service.tags.length > 0) {
      return service.tags.some(tag => 
        normalizedMessage.includes(normalizeText(tag))
      );
    }
    
    return false;
  }).slice(0, aiChatConfig.MAX_RESULTS.SERVICES);
  
  // Si hay categorías o servicios coincidentes, devolver resultados
  if (matchedCategories.length > 0 || matchedServices.length > 0) {
    // Preparar datos para categorías
    const categoryData = matchedCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      icon: cat.icon
    }));
    
    // Preparar datos para servicios
    const serviceData = [];
    for (const service of matchedServices) {
      const category = categories.find(c => c.id === service.category);
      serviceData.push({
        id: service.id,
        title: service.title,
        description: service.description,
        price: service.price,
        category: category ? {
          id: category.id,
          name: category.name
        } : null
      });
    }
    
    return {
      type: 'search_results',
      message: '¡He encontrado algunas opciones que podrían interesarte!',
      categories: categoryData,
      services: serviceData,
      suggestions: getSearchSuggestions(matchedCategories)
    };
  }
  
  // 4. Si no hay coincidencias, dar respuesta por defecto
  return {
    type: 'text',
    message: getRandomDefaultResponse(),
    suggestions: aiChatConfig.DEFAULT_SUGGESTIONS
  };
};

/**
 * Obtiene sugerencias para el chat
 * @returns {Promise<Array>} Lista de sugerencias
 */
exports.getSuggestions = async () => {
  // Obtener categorías populares
  const categories = await jsonStore.find('categories');
  const popularCategories = categories
    .filter(cat => cat.active && cat.popular)
    .slice(0, 3)
    .map(cat => `Busco servicios de ${cat.name}`);
  
  // Combinar con sugerencias por defecto
  return [
    ...popularCategories,
    ...aiChatConfig.DEFAULT_SUGGESTIONS.slice(0, aiChatConfig.MAX_RESULTS.SUGGESTIONS - popularCategories.length)
  ];
};

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
 * Verifica si un mensaje es una despedida
 * @param {string} message - Mensaje normalizado
 * @returns {boolean} Si es una despedida
 */
function isFarewell(message) {
  return aiChatConfig.FAREWELL_PHRASES.some(phrase => 
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
 * Obtiene una despedida aleatoria
 * @returns {string} Despedida aleatoria
 */
function getRandomFarewell() {
  const farewells = [
    '¡Hasta pronto! Espero haberte ayudado.',
    'Ha sido un placer asistirte. ¡Vuelve cuando quieras!',
    '¡Adiós! Si necesitas algo más, estaré aquí.',
    'Gracias por usar nuestro servicio. ¡Que tengas un buen día!'
  ];
  
  return farewells[Math.floor(Math.random() * farewells.length)];
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

/**
 * Genera sugerencias basadas en categorías coincidentes
 * @param {Array} matchedCategories - Categorías coincidentes
 * @returns {Array} Sugerencias generadas
 */
function getSearchSuggestions(matchedCategories) {
  // Si hay categorías coincidentes, sugerir búsquedas relacionadas
  if (matchedCategories.length > 0) {
    return matchedCategories
      .slice(0, 2)
      .map(cat => `Más servicios de ${cat.name}`)
      .concat(aiChatConfig.DEFAULT_SUGGESTIONS.slice(0, 2));
  }
  
  return aiChatConfig.DEFAULT_SUGGESTIONS;
}