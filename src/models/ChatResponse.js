/**
 * ChatResponse.js
 * Modelo para respuestas predefinidas del chat
 */

/**
 * Clase que representa el modelo de respuesta de chat
 */
class ChatResponse {
  /**
   * Constructor del modelo de respuesta de chat
   * @param {Object} data - Datos de la respuesta
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.keywords = data.keywords || [];
    this.text = data.text || '';
    this.suggestions = data.suggestions || [];
    this.serviceIds = data.serviceIds || []; // IDs de servicios relacionados con esta respuesta
    this.categoryIds = data.categoryIds || []; // IDs de categorías relacionadas con esta respuesta
    this.priority = data.priority || 1; // Prioridad para resolver conflictos
    this.active = data.active !== false; // true por defecto
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Valida los datos de la respuesta de chat
   * @returns {Object} Resultado de la validación
   */
  validate() {
    const errors = [];

    if (!this.keywords || this.keywords.length === 0) {
      errors.push('Se requiere al menos una palabra clave');
    }

    if (!this.text) {
      errors.push('El texto de respuesta es obligatorio');
    }

    if (this.text && this.text.length > 1000) {
      errors.push('El texto no puede tener más de 1000 caracteres');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convierte la instancia a un objeto simple
   * @returns {Object} Representación del objeto
   */
  toJSON() {
    return {
      id: this.id,
      keywords: this.keywords,
      text: this.text,
      suggestions: this.suggestions,
      serviceIds: this.serviceIds,
      categoryIds: this.categoryIds,
      priority: this.priority,
      active: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Verifica si un texto coincide con las palabras clave
   * @param {string} text - Texto a verificar
   * @returns {boolean} Si hay coincidencia
   */
  matchesText(text) {
    if (!text || !this.keywords || this.keywords.length === 0) {
      return false;
    }

    const normalizedText = text.toLowerCase();
    
    return this.keywords.some(keyword => 
      normalizedText.includes(keyword.toLowerCase())
    );
  }

  /**
   * Calcula la relevancia para un texto dado
   * @param {string} text - Texto para calcular relevancia
   * @returns {number} Puntuación de relevancia
   */
  calculateRelevance(text) {
    if (!text || !this.keywords || this.keywords.length === 0) {
      return 0;
    }

    const normalizedText = text.toLowerCase();
    let relevance = 0;

    // Contar coincidencias con palabras clave
    this.keywords.forEach(keyword => {
      if (normalizedText.includes(keyword.toLowerCase())) {
        relevance += 1;
      }
    });

    // Multiplicar por la prioridad
    relevance *= this.priority;

    return relevance;
  }
}

module.exports = ChatResponse;