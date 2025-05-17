/**
 * asyncHandler.js
 * Utilidad para manejar funciones asíncronas en Express
 * Elimina la necesidad de usar try/catch en cada controlador
 */

/**
 * Envuelve una función async para manejar errores automáticamente
 * @param {Function} fn - Función asíncrona a envolver
 * @returns {Function} - Middleware de Express con manejo de errores
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Resuelve la promesa y captura cualquier error
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;