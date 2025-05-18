/**
 * Service.js
 * Modelo para servicios
 */

const { PRICE_TYPES } = require('../config/constants');

/**
 * Clase que representa el modelo de servicio
 */
class Service {
  /**
   * Constructor del modelo de servicio
   * @param {Object} data - Datos del servicio
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.title = data.title || '';
    this.description = data.description || '';
    this.category = data.category || null;
    this.provider = data.provider || null;
    this.price = data.price || 0;
    this.priceType = data.priceType || PRICE_TYPES.FIXED;
    this.token = data.token || 'WLD';
    this.images = data.images || [];
    this.contactInfo = data.contactInfo || null;
    this.tags = data.tags || [];
    this.keywords = data.keywords || [];
    this.requirements = data.requirements || '';
    this.deliveryTime = data.deliveryTime || null;
    this.popular = data.popular || false;
    this.views = data.views || 0;
    this.sales = data.sales || 0;
    this.rating = data.rating || 0;
    this.ratingCount = data.ratingCount || 0;
    this.active = data.active !== false; // true por defecto
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Valida los datos del servicio
   * @returns {Object} Resultado de la validación
   */
  validate() {
    const errors = [];

    if (!this.title) {
      errors.push('El título del servicio es obligatorio');
    }

    if (this.title && this.title.length > 100) {
      errors.push('El título no puede tener más de 100 caracteres');
    }

    if (!this.description) {
      errors.push('La descripción del servicio es obligatoria');
    }

    if (this.description && this.description.length > 2000) {
      errors.push('La descripción no puede tener más de 2000 caracteres');
    }

    if (!this.category) {
      errors.push('La categoría es obligatoria');
    }

    if (!this.provider) {
      errors.push('El proveedor es obligatorio');
    }

    if (typeof this.price !== 'number' || this.price < 0) {
      errors.push('El precio debe ser un número no negativo');
    }

    if (!Object.values(PRICE_TYPES).includes(this.priceType)) {
      errors.push(`Tipo de precio inválido: ${this.priceType}`);
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
      title: this.title,
      description: this.description,
      category: this.category,
      provider: this.provider,
      price: this.price,
      priceType: this.priceType,
      token: this.token,
      images: this.images,
      contactInfo: this.contactInfo,
      tags: this.tags,
      keywords: this.keywords,
      requirements: this.requirements,
      deliveryTime: this.deliveryTime,
      popular: this.popular,
      views: this.views,
      sales: this.sales,
      rating: this.rating,
      ratingCount: this.ratingCount,
      active: this.active,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Obtiene la representación pública del servicio
   * @param {boolean} includeContactInfo - Si se debe incluir la información de contacto
   * @returns {Object} Representación pública
   */
  toPublic(includeContactInfo = false) {
    const publicData = {
      id: this.id,
      title: this.title,
      description: this.description,
      category: this.category, // Esto se populará con la info real en el controlador
      provider: this.provider, // Esto se populará con la info real en el controlador
      price: this.price,
      priceType: this.priceType,
      token: this.token,
      images: this.images,
      tags: this.tags,
      requirements: this.requirements,
      deliveryTime: this.deliveryTime,
      rating: this.rating,
      ratingCount: this.ratingCount,
      createdAt: this.createdAt
    };

    // Solo incluir información de contacto si se solicita explícitamente
    // Esta información solo debería ser accesible después de pagar
    if (includeContactInfo && this.contactInfo) {
      publicData.contactInfo = this.contactInfo;
    }

    return publicData;
  }

  /**
   * Incrementa el contador de vistas
   */
  incrementViews() {
    this.views += 1;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Incrementa el contador de ventas
   */
  incrementSales() {
    this.sales += 1;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Añade una nueva valoración
   * @param {number} rating - Valoración (1-5)
   */
  addRating(rating) {
    if (rating < 1 || rating > 5) {
      throw new Error('La valoración debe estar entre 1 y 5');
    }

    const totalRating = this.rating * this.ratingCount + rating;
    this.ratingCount += 1;
    this.rating = totalRating / this.ratingCount;
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = Service;