/**
 * serviceController.js
 * Controlador para operaciones relacionadas con servicios
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const Service = require('../models/Service');
const { success, error, paginated } = require('../utils/responseFormatter');
const { PAGINATION, SERVICE_UNLOCK_COST } = require('../config/constants');

/**
 * Obtiene un servicio por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getServiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Buscar servicio por ID
  const service = await jsonStore.findById('services', id);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Verificar que el servicio está activo
  if (service.active === false) {
    return error(res, 'Servicio no disponible', 403);
  }
  
  // Cargar información de categoría
  const category = await jsonStore.findById('categories', service.category);
  
  // Cargar información de proveedor
  const users = await jsonStore.find('users');
  const provider = users.find(user => user.id === service.provider);
  
  // Verificar si el servicio está desbloqueado para el usuario
  let isUnlocked = false;
  
  if (req.user) {
    const unlockedServices = await jsonStore.find('unlockedServices');
    isUnlocked = unlockedServices.some(
      unlocked => unlocked.serviceId === id && unlocked.userId === req.user.id
    );
  }
  
  // Poblar información adicional
  const serviceDetails = {
    ...service,
    category: category ? {
      id: category.id,
      name: category.name,
      slug: category.slug
    } : null,
    provider: provider ? {
      id: provider.id,
      name: provider.name,
      avatar: provider.avatar,
      walletAddress: provider.walletAddress
    } : null,
    isUnlocked,
    // Solo incluir contactInfo si está desbloqueado
    contactInfo: isUnlocked ? service.contactInfo : null,
    // Si no está desbloqueado, añadir información de costo
    unlockCost: !isUnlocked ? SERVICE_UNLOCK_COST : null
  };
  
  return success(res, serviceDetails);
});

/**
 * Busca servicios por texto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.searchServices = asyncHandler(async (req, res) => {
  const { 
    q, 
    category,
    page = 1, 
    limit = PAGINATION.DEFAULT_LIMIT 
  } = req.query;
  
  if (!q && !category) {
    return error(res, 'Se requiere un término de búsqueda o categoría', 400);
  }
  
  // Cargar servicios desde almacenamiento
  const services = await jsonStore.find('services');
  
  // Filtrar servicios activos
  let filteredServices = services.filter(service => service.active !== false);
  
  // Aplicar filtro por categoría si se especifica
  if (category) {
    filteredServices = filteredServices.filter(
      service => service.category === category
    );
  }
  
  // Aplicar filtro por texto si se especifica
  if (q) {
    const searchText = q.toLowerCase();
    filteredServices = filteredServices.filter(service => {
      // Buscar en título, descripción y palabras clave
      return (
        service.title.toLowerCase().includes(searchText) || 
        service.description.toLowerCase().includes(searchText) ||
        (service.keywords && service.keywords.some(
          keyword => keyword.toLowerCase().includes(searchText)
        ))
      );
    });
  }
  
  // Aplicar paginación
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const endIndex = startIndex + parsedLimit;
  
  const paginatedServices = filteredServices.slice(startIndex, endIndex);
  
  // Poblar información adicional
  const users = await jsonStore.find('users');
  const categories = await jsonStore.find('categories');
  
  const servicesWithDetails = paginatedServices.map(service => {
    const serviceCategory = categories.find(cat => cat.id === service.category);
    const provider = users.find(user => user.id === service.provider);
    
    return {
      ...service,
      category: serviceCategory ? {
        id: serviceCategory.id,
        name: serviceCategory.name,
        slug: serviceCategory.slug
      } : null,
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
    
    for (const service of servicesWithDetails) {
      service.isUnlocked = unlockedServices.some(
        unlocked => unlocked.serviceId === service.id && unlocked.userId === req.user.id
      );
    }
  }
  
  return paginated(
    res, 
    servicesWithDetails, 
    parsedPage, 
    parsedLimit, 
    filteredServices.length,
    { searchTerm: q, categoryId: category }
  );
});

/**
 * Verifica si un servicio está desbloqueado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.checkServiceUnlocked = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere autenticación
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Verificar que el servicio existe
  const service = await jsonStore.findById('services', id);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Verificar si está desbloqueado
  const unlockedServices = await jsonStore.find('unlockedServices');
  const unlockedService = unlockedServices.find(
    unlocked => unlocked.serviceId === id && unlocked.userId === req.user.id
  );
  
  const isUnlocked = !!unlockedService;
  
  // Si está desbloqueado, verificar si ha expirado
  let isExpired = false;
  
  if (isUnlocked && unlockedService.expiresAt) {
    isExpired = new Date(unlockedService.expiresAt) < new Date();
  }
  
  return success(res, {
    serviceId: id,
    serviceName: service.title,
    unlocked: isUnlocked && !isExpired,
    expired: isExpired,
    unlockCost: SERVICE_UNLOCK_COST,
    // Si está desbloqueado y no expirado, incluir la fecha de expiración
    expiresAt: (isUnlocked && !isExpired) ? unlockedService.expiresAt : null
  });
});

/**
 * Obtiene servicios populares o recomendados
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getPopularServices = asyncHandler(async (req, res) => {
  const { limit = 6 } = req.query;
  
  // Cargar servicios desde almacenamiento
  const services = await jsonStore.find('services');
  
  // Filtrar servicios activos y populares
  const popularServices = services.filter(
    service => service.active !== false && service.popular === true
  );
  
  // Ordenar por vistas o popularidad (si existe el campo)
  popularServices.sort((a, b) => {
    if (a.views && b.views) return b.views - a.views;
    if (a.sales && b.sales) return b.sales - a.sales;
    return 0;
  });
  
  // Limitar cantidad
  const limitedServices = popularServices.slice(0, parseInt(limit));
  
  // Poblar información adicional
  const users = await jsonStore.find('users');
  const categories = await jsonStore.find('categories');
  
  const servicesWithDetails = limitedServices.map(service => {
    const serviceCategory = categories.find(cat => cat.id === service.category);
    const provider = users.find(user => user.id === service.provider);
    
    return {
      ...service,
      category: serviceCategory ? {
        id: serviceCategory.id,
        name: serviceCategory.name,
        slug: serviceCategory.slug
      } : null,
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
    
    for (const service of servicesWithDetails) {
      service.isUnlocked = unlockedServices.some(
        unlocked => unlocked.serviceId === service.id && unlocked.userId === req.user.id
      );
    }
  }
  
  return success(res, servicesWithDetails);
});