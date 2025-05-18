/**
 * categoryController.js
 * Controlador para operaciones relacionadas con categorías de servicios
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const Category = require('../models/Category');
const Service = require('../models/Service');
const { success, error, paginated } = require('../utils/responseFormatter');
const { PAGINATION } = require('../config/constants');

/**
 * Obtiene todas las categorías
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getAllCategories = asyncHandler(async (req, res) => {
  // Cargar categorías desde el almacenamiento JSON
  const categories = await jsonStore.find('categories');
  
  // Filtrar solo categorías activas
  const activeCategories = categories.filter(cat => cat.active !== false);
  
  // Ordenar por campo 'order'
  activeCategories.sort((a, b) => a.order - b.order);
  
  return success(res, activeCategories);
});

/**
 * Obtiene una categoría por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Buscar categoría por ID
  const category = await jsonStore.findById('categories', id);
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Verificar que la categoría está activa
  if (category.active === false) {
    return error(res, 'Categoría no disponible', 403);
  }
  
  return success(res, category);
});

/**
 * Obtiene una categoría por su slug
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  
  // Cargar todas las categorías
  const categories = await jsonStore.find('categories');
  
  // Buscar por slug
  const category = categories.find(cat => 
    cat.slug.toLowerCase() === slug.toLowerCase()
  );
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Verificar que la categoría está activa
  if (category.active === false) {
    return error(res, 'Categoría no disponible', 403);
  }
  
  return success(res, category);
});

/**
 * Obtiene los servicios de una categoría específica
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getCategoryServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    page = 1, 
    limit = PAGINATION.DEFAULT_LIMIT,
    sort = '-createdAt'
  } = req.query;
  
  // Verificar que la categoría existe
  const category = await jsonStore.findById('categories', id);
  
  if (!category) {
    return error(res, 'Categoría no encontrada', 404);
  }
  
  // Verificar que la categoría está activa
  if (category.active === false) {
    return error(res, 'Categoría no disponible', 403);
  }
  
  // Cargar todos los servicios
  const services = await jsonStore.find('services');
  
  // Filtrar servicios por categoría y activos
  const categoryServices = services.filter(
    service => service.category === id && service.active !== false
  );
  
  // Aplicar ordenamiento
  const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
  const sortOrder = sort.startsWith('-') ? -1 : 1;
  
  categoryServices.sort((a, b) => {
    if (a[sortField] < b[sortField]) return -1 * sortOrder;
    if (a[sortField] > b[sortField]) return 1 * sortOrder;
    return 0;
  });
  
  // Aplicar paginación
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const endIndex = startIndex + parsedLimit;
  
  const paginatedServices = categoryServices.slice(startIndex, endIndex);
  
  // Obtener información de proveedores para los servicios
  const users = await jsonStore.find('users');
  
  // Poblar información de proveedor para cada servicio
  const servicesWithProviders = paginatedServices.map(service => {
    const provider = users.find(user => user.id === service.provider);
    
    return {
      ...service,
      provider: provider ? {
        id: provider.id,
        name: provider.name,
        avatar: provider.avatar,
        walletAddress: provider.walletAddress
      } : null
    };
  });
  
  // Verificar servicios desbloqueados si el usuario está autenticado
  if (req.user) {
    const unlockedServices = await jsonStore.find('unlockedServices');
    
    for (const service of servicesWithProviders) {
      service.isUnlocked = unlockedServices.some(
        unlocked => unlocked.serviceId === service.id && unlocked.userId === req.user.id
      );
    }
  }
  
  return paginated(
    res, 
    servicesWithProviders, 
    parsedPage, 
    parsedLimit, 
    categoryServices.length,
    { category: category.name }
  );
});

/**
 * Obtiene las categorías populares
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getPopularCategories = asyncHandler(async (req, res) => {
  // Cargar categorías desde el almacenamiento JSON
  const categories = await jsonStore.find('categories');
  
  // Filtrar categorías activas y populares
  const popularCategories = categories.filter(
    cat => cat.active !== false && cat.popular === true
  );
  
  // Ordenar por campo 'order'
  popularCategories.sort((a, b) => a.order - b.order);
  
  return success(res, popularCategories);
});