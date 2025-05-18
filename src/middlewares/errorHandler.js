/**
 * errorHandler.js
 * Middleware para manejar errores de manera centralizada
 */

const { error } = require('../utils/responseFormatter');

/**
 * Middleware para manejar errores
 * Captura cualquier error lanzado en middlewares o controladores anteriores
 * @param {Error} err - Error capturado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {Function} next - Función next de Express
 */
const errorHandler = (err, req, res, next) => {
  // Imprimir el error en la consola para depuración
  console.error('Error:', err);

  // Determinar el tipo de error y dar una respuesta apropiada
  
  // Error de validación (p.ej. de express-validator)
  if (err.array && typeof err.array === 'function') {
    const validationErrors = err.array().map(error => ({
      field: error.param,
      message: error.msg
    }));
    
    return error(res, {
      message: 'Errores de validación',
      errors: validationErrors
    }, 422);
  }
  
  // Error de sintaxis JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return error(res, 'JSON inválido en la solicitud', 400);
  }
  
  // Error de autenticación (token inválido)
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Token inválido', 401);
  }
  
  // Error de autenticación (token expirado)
  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expirado', 401);
  }
  
  // Si el error tiene un código de estado definido, usarlo
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';
  
  // Para errores 500, dar un mensaje genérico en producción
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    return error(res, 'Error interno del servidor', 500);
  }
  
  // Enviar respuesta de error
  return error(res, message, statusCode);
};

module.exports = errorHandler;