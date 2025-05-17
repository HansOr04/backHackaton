/**
 * userController.js
 * Controlador para operaciones relacionadas con usuarios
 */

const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const { success, error, paginated } = require('../utils/responseFormatter');

/**
 * Obtiene el perfil del usuario autenticado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProfile = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Buscar usuario por ID con selección de campos
  const user = await User.findById(req.user.id).select('-__v');
  
  if (!user) {
    return error(res, 'Usuario no encontrado', 404);
  }
  
  return success(res, user.getPublicProfile());
});

/**
 * Actualiza el perfil del usuario autenticado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { name, bio, avatar, skills } = req.body;
  
  // Buscar usuario
  const user = await User.findById(req.user.id);
  
  if (!user) {
    return error(res, 'Usuario no encontrado', 404);
  }
  
  // Actualizar campos si se proporcionaron
  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;
  if (skills !== undefined) user.skills = skills;
  
  // Guardar cambios
  await user.save();
  
  return success(res, user.getPublicProfile());
});

/**
 * Obtiene el perfil público de un usuario por ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id);
  
  if (!user) {
    return error(res, 'Usuario no encontrado', 404);
  }
  
  // Para perfiles públicos, limitar la información devuelta
  return success(res, user.getPublicProfile());
});

/**
 * Obtiene el perfil de un usuario por dirección de wallet
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getUserByWallet = asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  // Normalizar dirección a minúsculas
  const walletAddress = address.toLowerCase();
  
  const user = await User.findOne({ walletAddress });
  
  if (!user) {
    return error(res, 'Usuario no encontrado', 404);
  }
  
  return success(res, user.getPublicProfile());
});

/**
 * Busca usuarios por nombre o habilidades
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.searchUsers = asyncHandler(async (req, res) => {
  const { query, skills, page = 1, limit = 10 } = req.query;
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir filtro
  const filter = {};
  
  if (query) {
    filter.name = { $regex: query, $options: 'i' };
  }
  
  if (skills) {
    // Convertir skills a array si viene como string
    const skillsArray = Array.isArray(skills) ? skills : skills.split(',');
    filter.skills = { $in: skillsArray };
  }
  
  // Solo usuarios activos
  filter.isActive = true;
  
  // Ejecutar consulta con paginación
  const users = await User.find(filter)
    .select('name bio avatar skills rating completedJobs walletAddress verificationLevel')
    .skip(skip)
    .limit(parseInt(limit))
    .sort('name');
  
  // Contar total para paginación
  const total = await User.countDocuments(filter);
  
  // Transformar a formato público
  const formattedUsers = users.map(user => user.getPublicProfile());
  
  return paginated(res, formattedUsers, parseInt(page), parseInt(limit), total);
});

/**
 * Obtiene las métricas de un usuario (trabajos completados, calificación, etc.)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getUserMetrics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await User.findById(id);
  
  if (!user) {
    return error(res, 'Usuario no encontrado', 404);
  }
  
  // Opcional: Agregar más métricas calculadas desde otras colecciones
  
  return success(res, {
    userId: user._id,
    rating: user.rating,
    completedJobs: user.completedJobs,
    verificationLevel: user.verificationLevel
  });
});

/**
 * Verifica si una dirección de wallet está registrada
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.checkWalletRegistered = asyncHandler(async (req, res) => {
  const { address } = req.params;
  
  // Normalizar dirección a minúsculas
  const walletAddress = address.toLowerCase();
  
  const user = await User.findOne({ walletAddress }).select('_id');
  
  return success(res, {
    address: walletAddress,
    registered: !!user
  });
});