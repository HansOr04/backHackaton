/**
 * categoryController.js
 * Controlador para operaciones relacionadas con categorías de servicios
 */

const asyncHandler = require('../utils/asyncHandler');
const Category = require('../models/Category');
const Service = require('../models/Service');
const { success, error } = require('../utils/responseFormatter');

/**
 * Obtiene todas las categorías activas
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getAllCategories = asyncHandler(async (req, res) => {
  // Filtrar solo categorías activas por defecto
  const filter = { active: true };
  
  // Si se especifica en la consulta, incluir categorías inactivas
  if (req.query.includeInactive === 'true' && req.user && req.user.isAdmin) {
    delete filter.active;
  }
  
  // Ordenar por el campo 'order' para personalizar el orden de visualización
  const categories = await Category.find(filter).sort({ order: 1 });
  
  // Mapear a formato público
  const formattedCategories = categories.map(category => category.toPublic());
  
  return success(res, formattedCategories);
});

/**
 * Obtiene una categoría por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const category = await Category.findById(id);
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Si la categoría está inactiva, solo permitir acceso a administradores
  if (!category.active && (!req.user || !req.user.isAdmin)) {
    return error(res, 'Categoría no disponible', 403);
  }
  
  return success(res, category.toPublic());
});

/**
 * Obtiene una categoría por su slug
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  const category = await Category.findOne({ slug: slug.toLowerCase() });
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Si la categoría está inactiva, solo permitir acceso a administradores
  if (!category.active && (!req.user || !req.user.isAdmin)) {
    return error(res, 'Categoría no disponible', 403);
  }
  
  return success(res, category.toPublic());
});

/**
 * Crea una nueva categoría (solo administradores)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.createCategory = asyncHandler(async (req, res) => {
  // Verificar que el usuario es administrador
  if (!req.user || !req.user.isAdmin) {
    return error(res, 'No autorizado para crear categorías', 403);
  }
  
  const { name, description, icon, order } = req.body;
  
  // Verificar si ya existe una categoría con el mismo nombre
  const existing = await Category.findOne({ name });
  
  if (existing) {
    return error(res, 'Ya existe una categoría con este nombre', 409);
  }
  
  // Crear nueva categoría
  const category = new Category({
    name,
    description,
    icon,
    order: order || 0,
    active: true
  });
  
  await category.save();
  
  return success(res, category.toPublic(), 201);
});

/**
 * Actualiza una categoría existente (solo administradores)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateCategory = asyncHandler(async (req, res) => {
  // Verificar que el usuario es administrador
  if (!req.user || !req.user.isAdmin) {
    return error(res, 'No autorizado para actualizar categorías', 403);
  }
  
  const { id } = req.params;
  const { name, description, icon, order, active } = req.body;
  
  const category = await Category.findById(id);
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Verificar si el nuevo nombre ya existe en otra categoría
  if (name && name !== category.name) {
    const existing = await Category.findOne({ name, _id: { $ne: id } });
    
    if (existing) {
      return error(res, 'Ya existe otra categoría con este nombre', 409);
    }
  }
  
  // Actualizar campos si se proporcionaron
  if (name !== undefined) category.name = name;
  if (description !== undefined) category.description = description;
  if (icon !== undefined) category.icon = icon;
  if (order !== undefined) category.order = order;
  if (active !== undefined) category.active = active;
  
  await category.save();
  
  return success(res, category.toPublic());
});

/**
 * Elimina una categoría (solo administradores)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.deleteCategory = asyncHandler(async (req, res) => {
  // Verificar que el usuario es administrador
  if (!req.user || !req.user.isAdmin) {
    return error(res, 'No autorizado para eliminar categorías', 403);
  }
  
  const { id } = req.params;
  
  // Verificar si hay servicios que usan esta categoría
  const servicesCount = await Service.countDocuments({ category: id });
  
  if (servicesCount > 0) {
    return error(res, `No se puede eliminar: la categoría tiene ${servicesCount} servicios asociados`, 400);
  }
  
  const category = await Category.findByIdAndDelete(id);
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  return success(res, { message: 'Categoría eliminada correctamente' });
});

/**
 * Obtiene los servicios de una categoría específica
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getCategoryServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
  
  // Verificar que la categoría existe
  const category = await Category.findById(id);
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Si la categoría está inactiva, solo permitir acceso a administradores
  if (!category.active && (!req.user || !req.user.isAdmin)) {
    return error(res, 'Categoría no disponible', 403);
  }
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Obtener servicios de la categoría
  const services = await Service.find({ 
    category: id,
    active: true 
  })
    .skip(skip)
    .limit(parseInt(limit))
    .sort(sort)
    .populate('provider', 'name avatar rating walletAddress');
  
  // Contar total para paginación
  const total = await Service.countDocuments({ category: id, active: true });
  
  // Transformar a formato público
  const formattedServices = services.map(service => service.toPublic());
  
  return success(res, {
    category: category.toPublic(),
    services: formattedServices,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});