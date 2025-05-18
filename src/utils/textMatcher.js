/**
 * textMatcher.js
 * Utilidad para hacer matching de texto en el chat
 */

const aiChatConfig = require('../config/aiChatConfig');

/**
 * Verifica si un texto contiene palabras clave
 * @param {string} text - Texto a analizar
 * @param {Array} keywords - Palabras clave a buscar
 * @param {Object} options - Opciones de búsqueda
 * @returns {boolean} Si hay coincidencia
 */
exports.hasKeywords = (text, keywords, options = {}) => {
  if (!text || !keywords || keywords.length === 0) {
    return false;
  }
  
  // Opciones por defecto
  const opts = {
    minMatches: 1,
    matchThreshold: aiChatConfig.MATCH_THRESHOLD,
    partialMatches: true,
    ...options
  };
  
  // Normalizar texto
  const normalizedText = normalizeText(text);
  
  // Eliminar stop words si se especifica
  const cleanedText = opts.removeStopWords 
    ? removeStopWords(normalizedText)
    : normalizedText;
  
  // Dividir en palabras
  const words = cleanedText.split(/\s+/);
  
  // Contar coincidencias
  let matches = 0;
  
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    
    // Coincidencia exacta de palabra clave completa
    if (cleanedText.includes(normalizedKeyword)) {
      matches += aiChatConfig.NLP.WEIGHTS.EXACT_MATCH;
      continue;
    }
    
    // Coincidencia parcial (la palabra clave tiene varias palabras)
    if (opts.partialMatches && normalizedKeyword.includes(' ')) {
      const keywordParts = normalizedKeyword.split(/\s+/);
      const partMatches = keywordParts.filter(part => 
        cleanedText.includes(part)
      ).length;
      
      // Si hay suficientes partes coincidentes
      if (partMatches / keywordParts.length >= opts.matchThreshold) {
        matches += aiChatConfig.NLP.WEIGHTS.PARTIAL_MATCH;
        continue;
      }
    }
    
    // Coincidencia de palabras individuales
    for (const word of words) {
      if (normalizedKeyword.includes(word) || word.includes(normalizedKeyword)) {
        matches += aiChatConfig.NLP.WEIGHTS.RELATED_TERM;
        break;
      }
    }
  }
  
  // Verificar si hay suficientes coincidencias
  return matches >= opts.minMatches;
};

/**
 * Calcula la relevancia entre un texto y palabras clave
 * @param {string} text - Texto a analizar
 * @param {Array} keywords - Palabras clave para calcular relevancia
 * @returns {number} Puntuación de relevancia
 */
exports.calculateRelevance = (text, keywords) => {
  if (!text || !keywords || keywords.length === 0) {
    return 0;
  }
  
  // Normalizar texto
  const normalizedText = normalizeText(text);
  
  // Eliminar stop words
  const cleanedText = removeStopWords(normalizedText);
  
  // Dividir en palabras
  const words = cleanedText.split(/\s+/);
  
  // Calcular puntuación
  let score = 0;
  
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    
    // Coincidencia exacta de palabra clave completa
    if (cleanedText.includes(normalizedKeyword)) {
      score += aiChatConfig.NLP.WEIGHTS.EXACT_MATCH;
      continue;
    }
    
    // Coincidencia parcial (la palabra clave tiene varias palabras)
    if (normalizedKeyword.includes(' ')) {
      const keywordParts = normalizedKeyword.split(/\s+/);
      const partMatches = keywordParts.filter(part => 
        cleanedText.includes(part)
      ).length;
      
      // Puntuar según la proporción de partes coincidentes
      score += (partMatches / keywordParts.length) * aiChatConfig.NLP.WEIGHTS.PARTIAL_MATCH;
    }
    
    // Coincidencia de palabras individuales
    for (const word of words) {
      if (normalizedKeyword.includes(word) || word.includes(normalizedKeyword)) {
        score += aiChatConfig.NLP.WEIGHTS.RELATED_TERM;
        break;
      }
    }
  }
  
  return score;
};

/**
 * Encuentra las mejores coincidencias para un texto
 * @param {string} text - Texto para buscar coincidencias
 * @param {Array} items - Array de objetos con propiedad keywords
 * @param {Object} options - Opciones de coincidencia
 * @returns {Array} Mejores coincidencias ordenadas por relevancia
 */
exports.findBestMatches = (text, items, options = {}) => {
  if (!text || !items || items.length === 0) {
    return [];
  }
  
  // Opciones por defecto
  const opts = {
    minScore: 0.5,
    keywordsField: 'keywords',
    limit: 5,
    ...options
  };
  
  // Normalizar texto
  const normalizedText = normalizeText(text);
  
  // Calcular relevancia para cada ítem
  const scoredItems = items.map(item => {
    const keywords = item[opts.keywordsField] || [];
    const score = this.calculateRelevance(normalizedText, keywords);
    
    return {
      item,
      score
    };
  });
  
  // Filtrar por puntuación mínima y ordenar por relevancia
  return scoredItems
    .filter(scored => scored.score >= opts.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit)
    .map(scored => scored.item);
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
 * Elimina stop words de un texto
 * @param {string} text - Texto a limpiar
 * @returns {string} Texto sin stop words
 */
function removeStopWords(text) {
  const stopWords = aiChatConfig.NLP.STOP_WORDS;
  
  if (!stopWords || stopWords.length === 0) {
    return text;
  }
  
  const words = text.split(/\s+/);
  const filteredWords = words.filter(word => !stopWords.includes(word));
  
  return filteredWords.join(' ');
}