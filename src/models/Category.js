/**
 * Category.js
 * Modelo para categorías de servicios
 */

const { CATEGORIES, POPULAR_CATEGORIES } = require('../config/constants');

/**
 * Clase que representa el modelo de categoría
 */
class Category {
  /**
   * Constructor del modelo de categoría
   * @param {Object} data - Datos de la categoría
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.name = data.name || '';
    this.slug = data.slug || this.generateSlug(data.name || '');
    this.description = data.description || '';
    this.icon = data.icon || '📁';
    this.order = data.order || 0;
    this.active = data.active !== false; // true por defecto
    this.popular = data.popular || POPULAR_CATEGORIES.includes(this.slug);
    this.keywords = data.keywords || [];
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Genera un slug a partir del nombre
   * @param {string} name - Nombre de la categoría
   * @returns {string} Slug generado
   */
  generateSlug(name) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Valida los datos de la categoría
   * @returns {Object} Resultado de la validación
   */
  validate() {
    const errors = [];

    if (!this.name) {
      errors.push('El nombre de la categoría es obligatorio');
    }

    if (this.name && this.name.length > 50) {
      errors.push('El nombre no puede tener más de 50 caracteres');
    }

    if (this.description && this.description.length > 500) {
      errors.push('La descripción no puede tener más de 500 caracteres');
    }

    // Verificar que el slug está en la lista de categorías permitidas
    if (!CATEGORIES.includes(this.slug)) {
      errors.push(`La categoría '${this.slug}' no está en la lista de categorías permitidas`);
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
      name: this.name,
      slug: this.slug,
      description: this.description,
      icon: this.icon,
      order: this.order,
      active: this.active,
      popular: this.popular,
      keywords: this.keywords,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Obtiene la representación pública de la categoría
   * @returns {Object} Representación pública
   */
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      icon: this.icon,
      popular: this.popular
    };
  }
}

module.exports = Category;