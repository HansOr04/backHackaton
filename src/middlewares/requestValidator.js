/**
 * requestValidator.js
 * Middleware para validar datos de entrada en las solicitudes
 */

const { validationResult, body, param, query } = require('express-validator');
const { error } = require('../utils/responseFormatter');
const mongoose = require('mongoose');

/**
 * Middleware para verificar errores de validación
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Formatear los errores para una respuesta más clara
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg
    }));
    
    return error(res, {
      message: 'Datos de entrada inválidos',
      errors: errorMessages
    }, 422);
  }
  next();
};

/**
 * Generador de reglas de validación comunes
 */
const validationRules = {
  /**
   * Validación para IDs de MongoDB
   * @param {string} field - Nombre del campo a validar
   * @param {string} location - Ubicación del campo (body, param, query)
   * @returns {Object} Regla de validación
   */
  mongoId: (field, location = 'param') => {
    const validator = location === 'body' ? body(field)
      : location === 'query' ? query(field)
      : param(field);
    
    return validator
      .notEmpty().withMessage(`El campo ${field} es obligatorio`)
      .custom(value => mongoose.Types.ObjectId.isValid(value))
      .withMessage(`${field} debe ser un ID válido de MongoDB`);
  },
  
  /**
   * Validación para campo requerido
   * @param {string} field - Nombre del campo a validar
   * @param {string} location - Ubicación del campo (body, param, query)
   * @returns {Object} Regla de validación
   */
  required: (field, location = 'body') => {
    const validator = location === 'body' ? body(field)
      : location === 'query' ? query(field)
      : param(field);
    
    return validator
      .notEmpty().withMessage(`El campo ${field} es obligatorio`);
  },
  
  /**
   * Validación para cadenas de texto
   * @param {string} field - Nombre del campo a validar
   * @param {Object} options - Opciones de validación (min, max)
   * @returns {Object} Regla de validación
   */
  string: (field, options = {}) => {
    let validator = body(field).isString().withMessage(`${field} debe ser una cadena de texto`);
    
    if (options.required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    if (options.min) {
      validator = validator.isLength({ min: options.min })
        .withMessage(`${field} debe tener al menos ${options.min} caracteres`);
    }
    
    if (options.max) {
      validator = validator.isLength({ max: options.max })
        .withMessage(`${field} no puede tener más de ${options.max} caracteres`);
    }
    
    return validator;
  },
  
  /**
   * Validación para números
   * @param {string} field - Nombre del campo a validar
   * @param {Object} options - Opciones de validación (min, max)
   * @returns {Object} Regla de validación
   */
  number: (field, options = {}) => {
    let validator = body(field).isNumeric().withMessage(`${field} debe ser un número`);
    
    if (options.required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    if (options.min !== undefined) {
      validator = validator.isFloat({ min: options.min })
        .withMessage(`${field} debe ser mayor o igual a ${options.min}`);
    }
    
    if (options.max !== undefined) {
      validator = validator.isFloat({ max: options.max })
        .withMessage(`${field} debe ser menor o igual a ${options.max}`);
    }
    
    return validator;
  },
  
  /**
   * Validación para direcciones de email
   * @param {string} field - Nombre del campo a validar
   * @param {boolean} required - Si el campo es obligatorio
   * @returns {Object} Regla de validación
   */
  email: (field, required = true) => {
    let validator = body(field).isEmail().withMessage(`${field} debe ser un email válido`);
    
    if (required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    return validator;
  },
  
  /**
   * Validación para URLs
   * @param {string} field - Nombre del campo a validar
   * @param {boolean} required - Si el campo es obligatorio
   * @returns {Object} Regla de validación
   */
  url: (field, required = false) => {
    let validator = body(field).isURL().withMessage(`${field} debe ser una URL válida`);
    
    if (required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    return validator;
  },
  
  /**
   * Validación para direcciones de Ethereum
   * @param {string} field - Nombre del campo a validar
   * @param {boolean} required - Si el campo es obligatorio
   * @returns {Object} Regla de validación
   */
  ethAddress: (field, required = true) => {
    let validator = body(field)
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage(`${field} debe ser una dirección Ethereum válida`);
    
    if (required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    return validator;
  },
  
  /**
   * Validación para arrays
   * @param {string} field - Nombre del campo a validar
   * @param {boolean} required - Si el campo es obligatorio
   * @returns {Object} Regla de validación
   */
  array: (field, required = false) => {
    let validator = body(field).isArray().withMessage(`${field} debe ser un array`);
    
    if (required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio y no puede estar vacío`);
    } else {
      validator = validator.optional();
    }
    
    return validator;
  },
  
  /**
   * Validación para fechas
   * @param {string} field - Nombre del campo a validar
   * @param {boolean} required - Si el campo es obligatorio
   * @returns {Object} Regla de validación
   */
  date: (field, required = false) => {
    let validator = body(field).isISO8601().withMessage(`${field} debe ser una fecha válida en formato ISO8601`);
    
    if (required) {
      validator = validator.notEmpty().withMessage(`El campo ${field} es obligatorio`);
    } else {
      validator = validator.optional({ nullable: true });
    }
    
    return validator;
  },
  
  /**
   * Validación personalizada
   * @param {string} field - Nombre del campo a validar
   * @param {Function} validationFn - Función de validación personalizada
   * @param {string} message - Mensaje de error
   * @returns {Object} Regla de validación
   */
  custom: (field, validationFn, message) => {
    return body(field).custom(validationFn).withMessage(message);
  }
};

module.exports = {
  validateRequest,
  validationRules
};