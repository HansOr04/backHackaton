/**
 * serviceController.js
 * Controlador para operaciones relacionadas con servicios
 */

const asyncHandler = require('../utils/asyncHandler');
const Service = require('../models/Service');
const Category = require('../models/Category');
const { success, error, paginated } = require('../utils/responseFormatter');
const { PRICE_TYPES } = require('../config/constants');

/**
 * Obtiene todos los servicios con filtros y paginación
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getAllServices = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10,
    sort = '-createdAt',
    category,
    provider,
    minPrice,
    maxPrice,
    search,
    priceType
  } = req.query;
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir filtro
  const filter = { active: true };
  
  // Filtrar por categoría
  if (category) {
    filter.category = category;
  }
  
  // Filtrar por proveedor
  if (provider) {
    filter.provider = provider;
  }
  
  // Filtrar por rango de precio
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }
  
  // Filtrar por tipo de precio
  if (priceType && Object.values(PRICE_TYPES).includes(priceType)) {
    filter.priceType = priceType;
  }
  
  // Búsqueda por texto
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Ejecutar consulta con paginación
  const services = await Service.find(filter)
    .populate('provider', 'name avatar rating walletAddress')
    .populate('category', 'name slug')
    .skip(skip)
    .limit(parseInt(limit))
    .sort(sort);
  
  // Contar total para paginación
  const total = await Service.countDocuments(filter);
  
  // Transformar a formato público
  const formattedServices = services.map(service => service.toPublic());
  
  return paginated(res, formattedServices, parseInt(page), parseInt(limit), total);
});

/**
 * Obtiene un servicio por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const service = await Service.findById(id)
    .populate('provider', 'name avatar rating walletAddress')
    .populate('category', 'name slug');
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Verificar si el servicio está activo o si el usuario es el proveedor
  if (!service.active && 
      (!req.user || (req.user.id !== service.provider._id.toString() && !req.user.isAdmin))) {
    return error(res, 'Servicio no disponible', 403);
  }
  
  return success(res, service.toPublic());
});

/**
 * Crea un nuevo servicio
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.createService = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { 
    title, 
    description, 
    category, 
    price, 
    priceType = PRICE_TYPES.FIXED,
    token = 'WLD',
    deliveryTime,
    images = [],
    tags = []
  } = req.body;
  
  // Verificar que la categoría existe y está activa
  const categoryExists = await Category.findOne({ _id: category, active: true });
  
  if (!categoryExists) {
    return error(res, 'Categoría no válida o inactiva', 400);
  }
  
  // Crear nuevo servicio
  const service = new Service({
    title,
    description,
    category,
    provider: req.user.id,
    price,
    priceType,
    token,
    deliveryTime,
    images,
    tags,
    active: true
  });
  
  await service.save();
  
  // Poblar referencias para la respuesta
  await service.populate('provider', 'name avatar rating walletAddress');
  await service.populate('category', 'name slug');
  
  return success(res, service.toPublic(), 201);
});

/**
 * Actualiza un servicio existente
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Buscar el servicio
  const service = await Service.findById(id);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Verificar que el usuario es el proveedor del servicio
  if (service.provider.toString() !== req.user.id && !req.user.isAdmin) {
    return error(res, 'No autorizado para actualizar este servicio', 403);
  }
  
  const { 
    title, 
    description, 
    category, 
    price, 
    priceType,
    token,
    deliveryTime,
    images,
    tags,
    active
  } = req.body;
  
  // Verificar categoría si se está actualizando
  if (category && category !== service.category.toString()) {
    const categoryExists = await Category.findOne({ _id: category, active: true });
    
    if (!categoryExists) {
      return error(res, 'Categoría no válida o inactiva', 400);
    }
  }
  
  // Actualizar campos si se proporcionaron
  if (title !== undefined) service.title = title;
  if (description !== undefined) service.description = description;
  if (category !== undefined) service.category = category;
  if (price !== undefined) service.price = price;
  if (priceType !== undefined) service.priceType = priceType;
  if (token !== undefined) service.token = token;
  if (deliveryTime !== undefined) service.deliveryTime = deliveryTime;
  if (images !== undefined) service.images = images;
  if (tags !== undefined) service.tags = tags;
  if (active !== undefined) service.active = active;
  
  await service.save();
  
  // Poblar referencias para la respuesta
  await service.populate('provider', 'name avatar rating walletAddress');
  await service.populate('category', 'name slug');
  
  return success(res, service.toPublic());
});

/**
 * Elimina un servicio (desactivación lógica)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.deleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Buscar el servicio
  const service = await Service.findById(id);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Verificar que el usuario es el proveedor del servicio
  if (service.provider.toString() !== req.user.id && !req.user.isAdmin) {
    return error(res, 'No autorizado para eliminar este servicio', 403);
  }
  
  // En lugar de eliminar físicamente, desactivar el servicio
  service.active = false;
  await service.save();
  
  return success(res, { message: 'Servicio eliminado correctamente' });
});

/**
 * Busca servicios por texto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.searchServices = asyncHandler(async (req, res) => {
  const { q, page = 1, limit = 10 } = req.query;
  
  // Verificar que se proporcionó un término de búsqueda
  if (!q) {
    return error(res, 'Se requiere un término de búsqueda', 400);
  }
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir consulta de búsqueda por texto
  const query = {
    $or: [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } }
    ],
    active: true
  };
  
  // Ejecutar consulta con paginación
  const services = await Service.find(query)
    .populate('provider', 'name avatar rating walletAddress')
    .populate('category', 'name slug')
    .skip(skip)
    .limit(parseInt(limit))
    .sort('-rating');
  
  // Contar total para paginación
  const total = await Service.countDocuments(query);
  
  // Transformar a formato público
  const formattedServices = services.map(service => service.toPublic());
  
  return paginated(res, formattedServices, parseInt(page), parseInt(limit), total);
});

/**
 * Obtiene servicios recomendados según historial o categorías populares
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getRecommendedServices = asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  
  // Si el usuario está autenticado, intentar personalizar recomendaciones
  let recommendedServices = [];
  
  if (req.user) {
    // Enfoque 1: Recomendar servicios de categorías en las que el usuario ha contratado
    // Este enfoque requeriría acceder al historial de propuestas/proyectos
    
    // Enfoque 2: Por ahora, simplemente mostramos servicios bien valorados
    recommendedServices = await Service.find({ active: true })
      .populate('provider', 'name avatar rating walletAddress')
      .populate('category', 'name slug')
      .sort('-rating -sales')
      .limit(parseInt(limit));
  } else {
    // Sin usuario, mostrar servicios populares
    recommendedServices = await Service.find({ active: true })
      .populate('provider', 'name avatar rating walletAddress')
      .populate('category', 'name slug')
      .sort('-sales -rating')
      .limit(parseInt(limit));
  }
  
  // Transformar a formato público
  const formattedServices = recommendedServices.map(service => service.toPublic());
  
  return success(res, formattedServices);
});

/**
 * Obtiene los servicios de un proveedor específico
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProviderServices = asyncHandler(async (req, res) => {
  const { providerId } = req.params;
  const { page = 1, limit = 10, includeInactive = false } = req.query;
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir filtro
  const filter = { provider: providerId };
  
  // Si no es el propio proveedor, mostrar solo servicios activos
  if (!includeInactive || 
      !req.user || 
      (req.user.id !== providerId && !req.user.isAdmin)) {
    filter.active = true;
  }
  
  // Ejecutar consulta con paginación
  const services = await Service.find(filter)
    .populate('provider', 'name avatar rating walletAddress')
    .populate('category', 'name slug')
    .skip(skip)
    .limit(parseInt(limit))
    .sort('-createdAt');
  
  // Contar total para paginación
  const total = await Service.countDocuments(filter);
  
  // Transformar a formato público
  const formattedServices = services.map(service => service.toPublic());
  
  return paginated(res, formattedServices, parseInt(page), parseInt(limit), total);
});