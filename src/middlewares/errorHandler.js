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

  // Verificar si es un error de Mongoose/MongoDB
  if (err.name === 'ValidationError') {
    return error(res, formatValidationError(err), 400);
  }

  if (err.name === 'CastError') {
    return error(res, 'Recurso no encontrado', 404);
  }

  if (err.code === 11000) {
    return error(res, 'Entrada duplicada', 409);
  }

  // Verificar si es un error de JWT
  if (err.name === 'JsonWebTokenError') {
    return error(res, 'Token inválido', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return error(res, 'Token expirado', 401);
  }

  // Verificar si el error ya tiene un código de estado definido
  const statusCode = err.statusCode || 500;
  
  // Enviar respuesta de error
  return error(
    res,
    err.message || 'Error interno del servidor',
    statusCode
  );
};

/**
 * Formatea errores de validación de Mongoose
 * @param {Object} err - Error de validación de Mongoose
 * @returns {String} - Mensaje de error formateado
 */
const formatValidationError = (err) => {
  const errors = Object.values(err.errors).map(error => error.message);
  return errors.join(', ');
};

module.exports = errorHandler;