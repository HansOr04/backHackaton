/**
 * responseFormatter.js
 * Utilidad para formatear respuestas HTTP de manera consistente
 */

/**
 * Formatea una respuesta exitosa
 * @param {Object} res - Objeto de respuesta de Express
 * @param {*} data - Datos a enviar en la respuesta
 * @param {number} statusCode - Código de estado HTTP (default: 200)
 * @returns {Object} - Respuesta HTTP formateada
 */
exports.success = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data
  });
};

/**
 * Formatea una respuesta de error
 * @param {Object} res - Objeto de respuesta de Express
 * @param {string|Object} message - Mensaje o datos de error
 * @param {number} statusCode - Código de estado HTTP (default: 400)
 * @returns {Object} - Respuesta HTTP formateada
 */
exports.error = (res, message, statusCode = 400) => {
  // Determinar formato del error
  const errorData = typeof message === 'string' 
    ? { message } 
    : message;
  
  return res.status(statusCode).json({
    success: false,
    error: errorData
  });
};

/**
 * Formatea una respuesta con paginación
 * @param {Object} res - Objeto de respuesta de Express
 * @param {Array} data - Datos a enviar en la respuesta
 * @param {number} page - Página actual
 * @param {number} limit - Límite de elementos por página
 * @param {number} total - Total de elementos
 * @param {Object} meta - Metadatos adicionales (opcional)
 * @param {number} statusCode - Código de estado HTTP (default: 200)
 * @returns {Object} - Respuesta HTTP formateada con metadatos de paginación
 */
exports.paginated = (res, data, page, limit, total, meta = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    meta
  });
};

/**
 * Formatea una respuesta de creación
 * @param {Object} res - Objeto de respuesta de Express
 * @param {*} data - Datos a enviar en la respuesta
 * @param {string} resourceType - Tipo de recurso creado
 * @returns {Object} - Respuesta HTTP formateada
 */
exports.created = (res, data, resourceType = 'resource') => {
  return res.status(201).json({
    success: true,
    message: `${resourceType} created successfully`,
    data
  });
};

/**
 * Formatea una respuesta para operaciones sin contenido
 * @param {Object} res - Objeto de respuesta de Express
 * @returns {Object} - Respuesta HTTP formateada
 */
exports.noContent = (res) => {
  return res.status(204).end();
};