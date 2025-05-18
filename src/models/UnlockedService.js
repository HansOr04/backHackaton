/**
 * UnlockedService.js
 * Modelo para servicios desbloqueados por usuarios
 */

/**
 * Clase que representa el modelo de servicio desbloqueado
 */
class UnlockedService {
  /**
   * Constructor del modelo de servicio desbloqueado
   * @param {Object} data - Datos del servicio desbloqueado
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.userId = data.userId || null;
    this.serviceId = data.serviceId || null;
    this.transactionId = data.transactionId || null;
    this.unlockedAt = data.unlockedAt || new Date().toISOString();
    this.expiresAt = data.expiresAt || null;
  }

  /**
   * Valida los datos del servicio desbloqueado
   * @returns {Object} Resultado de la validación
   */
  validate() {
    const errors = [];

    if (!this.userId) {
      errors.push('El ID de usuario es obligatorio');
    }

    if (!this.serviceId) {
      errors.push('El ID de servicio es obligatorio');
    }

    if (!this.transactionId) {
      errors.push('El ID de transacción es obligatorio');
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
      userId: this.userId,
      serviceId: this.serviceId,
      transactionId: this.transactionId,
      unlockedAt: this.unlockedAt,
      expiresAt: this.expiresAt
    };
  }

  /**
   * Comprueba si el desbloqueo ha expirado
   * @returns {boolean} Si ha expirado
   */
  isExpired() {
    if (!this.expiresAt) {
      return false; // Si no tiene fecha de expiración, no expira
    }

    return new Date(this.expiresAt) < new Date();
  }

  /**
   * Obtiene días restantes hasta expiración
   * @returns {number|null} Días restantes o null si no expira
   */
  getDaysRemaining() {
    if (!this.expiresAt) {
      return null;
    }

    const now = new Date();
    const expiry = new Date(this.expiresAt);
    
    if (expiry <= now) {
      return 0; // Ya expirado
    }

    const diffTime = Math.abs(expiry - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  /**
   * Extiende la fecha de expiración
   * @param {number} days - Días adicionales
   */
  extendExpiry(days) {
    if (!days || days <= 0) {
      throw new Error('Los días para extender deben ser un número positivo');
    }

    const currentExpiry = this.expiresAt ? new Date(this.expiresAt) : new Date();
    currentExpiry.setDate(currentExpiry.getDate() + days);
    this.expiresAt = currentExpiry.toISOString();
  }
}

module.exports = UnlockedService;