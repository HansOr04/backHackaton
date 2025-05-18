/**
 * categoryController.js
 * Controlador para operaciones relacionadas con categorías de servicios
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const { success, error, paginated } = require('../utils/responseFormatter');
const { PAGINATION } = require('../config/constants');

/**
 * Obtiene todas las categorías activas ordenadas
 */
exports.getAllCategories = asyncHandler(async (req, res) => {
  const categories = await jsonStore.find('categories');
  const activeCategories = categories
    .filter(cat => cat.active !== false)
    .sort((a, b) => a.order - b.order);

  return success(res, activeCategories);
});

/**
 * Obtiene una categoría por su ID
 */
exports.getCategoryById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const category = await jsonStore.findById('categories', id);

  if (!category) return error(res, 'Categoría no encontrada', 404);
  if (category.active === false) return error(res, 'Categoría no disponible', 403);

  return success(res, category);
});

/**
 * Obtiene una categoría por su slug
 */
exports.getCategoryBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const categories = await jsonStore.find('categories');

  const category = categories.find(cat =>
    cat.slug.toLowerCase() === slug.toLowerCase()
  );

  if (!category) return error(res, 'Categoría no encontrada', 404);
  if (category.active === false) return error(res, 'Categoría no disponible', 403);

  return success(res, category);
});

/**
 * Obtiene los servicios activos de una categoría específica con paginación
 */
exports.getCategoryServices = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = PAGINATION.DEFAULT_LIMIT,
    sort = '-createdAt'
  } = req.query;

  const category = await jsonStore.findById('categories', id);
  if (!category) return error(res, 'Categoría no encontrada', 404);
  if (category.active === false) return error(res, 'Categoría no disponible', 403);

  const services = await jsonStore.find('services');
  const categoryServices = services.filter(
    service => service.category === id && service.active !== false
  );

  // Ordenar servicios
  const sortField = sort.startsWith('-') ? sort.substring(1) : sort;
  const sortOrder = sort.startsWith('-') ? -1 : 1;
  categoryServices.sort((a, b) => {
    if (a[sortField] < b[sortField]) return -1 * sortOrder;
    if (a[sortField] > b[sortField]) return 1 * sortOrder;
    return 0;
  });

  // Paginación
  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const startIndex = (parsedPage - 1) * parsedLimit;
  const endIndex = startIndex + parsedLimit;
  const paginatedServices = categoryServices.slice(startIndex, endIndex);

  // Cargar usuarios una vez y crear mapa para acceso rápido
  const users = await jsonStore.find('users');
  const userMap = Object.fromEntries(users.map(user => [user.id, user]));

  // Adjuntar información del proveedor
  const servicesWithProviders = paginatedServices.map(service => {
    const provider = userMap[service.provider];
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
 * Obtiene las categorías populares activas
 */
exports.getPopularCategories = asyncHandler(async (req, res) => {
  const categories = await jsonStore.find('categories');
  const popularCategories = categories
    .filter(cat => cat.active !== false && cat.popular === true)
    .sort((a, b) => a.order - b.order);

  return success(res, popularCategories);
});
