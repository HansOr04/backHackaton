/**
 * User.js
 * Modelo para usuarios
 */

const { VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Clase que representa el modelo de usuario
 */
class User {
  /**
   * Constructor del modelo de usuario
   * @param {Object} data - Datos del usuario
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.walletAddress = data.walletAddress ? data.walletAddress.toLowerCase() : null;
    this.name = data.name || '';
    this.worldUsername = data.worldUsername || null;
    this.avatar = data.avatar || null;
    this.bio = data.bio || '';
    this.verificationLevel = data.verificationLevel || VERIFICATION_LEVELS.DEVICE;
    this.walletAuthorized = data.walletAuthorized || false;
    this.isProvider = data.isProvider || false;
    this.skills = data.skills || [];
    this.rating = data.rating || 0;
    this.ratingCount = data.ratingCount || 0;
    this.completedJobs = data.completedJobs || 0;
    this.isActive = data.isActive !== false; // true por defecto
    this.isAdmin = data.isAdmin || false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Valida los datos del usuario
   * @returns {Object} Resultado de la validación
   */
  validate() {
    const errors = [];

    if (!this.walletAddress) {
      errors.push('La dirección de wallet es obligatoria');
    }

    if (this.walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(this.walletAddress)) {
      errors.push('La dirección de wallet debe tener formato Ethereum válido');
    }

    if (this.name && this.name.length > 50) {
      errors.push('El nombre no puede tener más de 50 caracteres');
    }

    if (this.bio && this.bio.length > 500) {
      errors.push('La biografía no puede tener más de 500 caracteres');
    }

    if (!Object.values(VERIFICATION_LEVELS).includes(this.verificationLevel)) {
      errors.push(`Nivel de verificación inválido: ${this.verificationLevel}`);
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
      walletAddress: this.walletAddress,
      name: this.name,
      worldUsername: this.worldUsername,
      avatar: this.avatar,
      bio: this.bio,
      verificationLevel: this.verificationLevel,
      walletAuthorized: this.walletAuthorized,
      isProvider: this.isProvider,
      skills: this.skills,
      rating: this.rating,
      ratingCount: this.ratingCount,
      completedJobs: this.completedJobs,
      isActive: this.isActive,
      isAdmin: this.isAdmin,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Obtiene la representación pública del usuario
   * @returns {Object} Representación pública
   */
  getPublicProfile() {
    return {
      id: this.id,
      walletAddress: this.walletAddress,
      name: this.name,
      worldUsername: this.worldUsername,
      avatar: this.avatar,
      bio: this.bio,
      verificationLevel: this.verificationLevel,
      isProvider: this.isProvider,
      skills: this.skills,
      rating: this.rating,
      ratingCount: this.ratingCount,
      completedJobs: this.completedJobs
    };
  }

  /**
   * Verifica si el usuario tiene un nivel de verificación mínimo
   * @param {string} requiredLevel - Nivel requerido
   * @returns {boolean} Si cumple con el nivel requerido
   */
  hasVerificationLevel(requiredLevel) {
    const levelPriority = {
      [VERIFICATION_LEVELS.DEVICE]: 1,
      [VERIFICATION_LEVELS.PHONE]: 2,
      [VERIFICATION_LEVELS.ORB]: 3
    };

    return levelPriority[this.verificationLevel] >= levelPriority[requiredLevel];
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

  /**
   * Incrementa el contador de trabajos completados
   */
  incrementCompletedJobs() {
    this.completedJobs += 1;
    this.updatedAt = new Date().toISOString();
  }
}

module.exports = User;