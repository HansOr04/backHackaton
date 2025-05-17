/**
 * proposalController.js
 * Controlador para operaciones relacionadas con propuestas de servicios
 */

const asyncHandler = require('../utils/asyncHandler');
const Proposal = require('../models/Proposal');
const Service = require('../models/Service');
const User = require('../models/User');
const Project = require('../models/Project');
const worldVerifyService = require('../services/worldVerifyService');
const { success, error, paginated } = require('../utils/responseFormatter');
const { PROJECT_STATUS, VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Crea una nueva propuesta de servicio
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.createProposal = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { 
    service, 
    provider, 
    title, 
    description, 
    price, 
    token = 'WLD',
    deliveryTime,
    attachments = []
  } = req.body;
  
  // El cliente es el usuario autenticado
  const client = req.user.id;
  
  // Verificar que el cliente no sea el proveedor
  if (client === provider) {
    return error(res, 'No puedes crear una propuesta para ti mismo', 400);
  }
  
  // Verificar que el usuario tiene verificación mínima requerida
  const hasVerification = await worldVerifyService.hasRequiredVerificationLevel(
    client,
    VERIFICATION_LEVELS.DEVICE
  );
  
  if (!hasVerification) {
    return error(res, 'Se requiere verificación de dispositivo para crear propuestas', 403);
  }
  
  // Verificar que el proveedor existe
  const providerExists = await User.findById(provider);
  
  if (!providerExists) {
    return error(res, 'Proveedor no encontrado', 404);
  }
  
  // Si se especifica un servicio, verificar que existe
  let serviceData = null;
  if (service) {
    serviceData = await Service.findOne({ _id: service, active: true });
    
    if (!serviceData) {
      return error(res, 'Servicio no encontrado o inactivo', 404);
    }
    
    // Verificar que el proveedor es el dueño del servicio
    if (serviceData.provider.toString() !== provider) {
      return error(res, 'El proveedor especificado no coincide con el dueño del servicio', 400);
    }
  }
  
  // Crear la propuesta
  const proposal = new Proposal({
    service: service || null,
    client,
    provider,
    title: title || (serviceData ? serviceData.title : 'Propuesta personalizada'),
    description,
    price,
    token,
    deliveryTime,
    attachments,
    status: PROJECT_STATUS.PENDING
  });
  
  await proposal.save();
  
  // Poblar referencias para la respuesta
  await proposal.populate('client', 'name avatar walletAddress');
  await proposal.populate('provider', 'name avatar walletAddress');
  if (service) {
    await proposal.populate('service', 'title price category');
  }
  
  return success(res, proposal.toPublic(), 201);
});

/**
 * Obtiene una propuesta por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProposalById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const proposal = await Proposal.findById(id);
  
  if (!proposal) {
    return error(res, 'Propuesta no encontrada', 404);
  }
  
  // Verificar que el usuario es parte de la propuesta
  const userId = req.user.id;
  if (proposal.client.toString() !== userId && 
      proposal.provider.toString() !== userId && 
      !req.user.isAdmin) {
    return error(res, 'No autorizado para ver esta propuesta', 403);
  }
  
  return success(res, proposal.toPublic());
});

/**
 * Obtiene propuestas según filtros (enviadas o recibidas)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProposals = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { 
    type = 'all',  // 'sent', 'received' o 'all'
    status,
    page = 1, 
    limit = 10,
    sort = '-createdAt'
  } = req.query;
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir filtro según tipo
  const filter = {};
  
  if (type === 'sent') {
    filter.client = req.user.id;
  } else if (type === 'received') {
    filter.provider = req.user.id;
  } else {
    // 'all' - propuestas donde el usuario es cliente o proveedor
    filter.$or = [
      { client: req.user.id },
      { provider: req.user.id }
    ];
  }
  
  // Filtrar por estado si se especifica
  if (status && Object.values(PROJECT_STATUS).includes(status)) {
    filter.status = status;
  }
  
  // Ejecutar consulta con paginación
  const proposals = await Proposal.find(filter)
    .populate('client', 'name avatar walletAddress')
    .populate('provider', 'name avatar walletAddress')
    .populate('service', 'title price category')
    .skip(skip)
    .limit(parseInt(limit))
    .sort(sort);
  
  // Contar total para paginación
  const total = await Proposal.countDocuments(filter);
  
  // Transformar a formato público y marcar si han expirado
  const formattedProposals = proposals.map(proposal => {
    const formatted = proposal.toPublic();
    return formatted;
  });
  
  return paginated(res, formattedProposals, parseInt(page), parseInt(limit), total);
});

/**
 * Actualiza el estado de una propuesta (aceptar, rechazar, etc.)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateProposalStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, rejectionReason } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Verificar que el estado proporcionado es válido
  if (!Object.values(PROJECT_STATUS).includes(status)) {
    return error(res, 'Estado no válido', 400);
  }
  
  const proposal = await Proposal.findById(id);
  
  if (!proposal) {
    return error(res, 'Propuesta no encontrada', 404);
  }
  
  // Verificar que el usuario es parte de la propuesta
  const userId = req.user.id;
  const isClient = proposal.client.toString() === userId;
  const isProvider = proposal.provider.toString() === userId;
  
  if (!isClient && !isProvider && !req.user.isAdmin) {
    return error(res, 'No autorizado para actualizar esta propuesta', 403);
  }
  
  // Verificar que la propuesta no ha expirado
  if (proposal.hasExpired()) {
    return error(res, 'La propuesta ha expirado', 400);
  }
  
  // Reglas de negocio para cambios de estado
  // Solo el proveedor puede aceptar una propuesta
  if (status === PROJECT_STATUS.ACCEPTED && !isProvider) {
    return error(res, 'Solo el proveedor puede aceptar la propuesta', 403);
  }
  
  // Solo el proveedor puede rechazar una propuesta
  if (status === PROJECT_STATUS.REJECTED && !isProvider) {
    return error(res, 'Solo el proveedor puede rechazar la propuesta', 403);
  }
  
  // Solo el cliente puede cancelar una propuesta pendiente
  if (status === PROJECT_STATUS.CANCELLED && !isClient) {
    return error(res, 'Solo el cliente puede cancelar la propuesta', 403);
  }
  
  // Si aceptando, verificar que el proveedor tiene verificación mínima
  if (status === PROJECT_STATUS.ACCEPTED) {
    const hasVerification = await worldVerifyService.hasRequiredVerificationLevel(
      proposal.provider,
      VERIFICATION_LEVELS.PHONE
    );
    
    if (!hasVerification) {
      return error(res, 'Se requiere verificación de teléfono para aceptar propuestas', 403);
    }
  }
  
  // Actualizar estado
  proposal.status = status;
  
  // Si se rechaza, guardar la razón
  if (status === PROJECT_STATUS.REJECTED && rejectionReason) {
    proposal.rejectionReason = rejectionReason;
  }
  
  await proposal.save();
  
  // Si se acepta la propuesta, crear un proyecto
  if (status === PROJECT_STATUS.ACCEPTED) {
    const project = new Project({
      proposal: proposal._id,
      client: proposal.client,
      provider: proposal.provider,
      title: proposal.title,
      description: proposal.description,
      price: proposal.price,
      token: proposal.token,
      deliveryTime: proposal.deliveryTime,
      status: PROJECT_STATUS.IN_PROGRESS
    });
    
    await project.save();
    
    return success(res, {
      message: 'Propuesta aceptada y proyecto creado',
      proposal: proposal.toPublic(),
      project: {
        id: project._id,
        title: project.title,
        status: project.status
      }
    });
  }
  
  return success(res, proposal.toPublic());
});

/**
 * Actualiza los detalles de una propuesta (solo permitido si está pendiente)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateProposal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    title, 
    description, 
    price, 
    deliveryTime,
    attachments
  } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const proposal = await Proposal.findById(id);
  
  if (!proposal) {
    return error(res, 'Propuesta no encontrada', 404);
  }
  
  // Solo permitir actualizar propuestas pendientes
  if (proposal.status !== PROJECT_STATUS.PENDING) {
    return error(res, 'Solo se pueden actualizar propuestas pendientes', 400);
  }
  
  // Verificar que el usuario es el cliente (creador de la propuesta)
  if (proposal.client.toString() !== req.user.id && !req.user.isAdmin) {
    return error(res, 'No autorizado para actualizar esta propuesta', 403);
  }
  
  // Verificar que la propuesta no ha expirado
  if (proposal.hasExpired()) {
    return error(res, 'La propuesta ha expirado', 400);
  }
  
  // Actualizar campos si se proporcionaron
  if (title !== undefined) proposal.title = title;
  if (description !== undefined) proposal.description = description;
  if (price !== undefined) proposal.price = price;
  if (deliveryTime !== undefined) proposal.deliveryTime = deliveryTime;
  if (attachments !== undefined) proposal.attachments = attachments;
  
  await proposal.save();
  
  return success(res, proposal.toPublic());
});

/**
 * Extiende la fecha de expiración de una propuesta
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.extendProposalExpiry = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { days = 7 } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const proposal = await Proposal.findById(id);
  
  if (!proposal) {
    return error(res, 'Propuesta no encontrada', 404);
  }
  
  // Solo permitir extender propuestas pendientes
  if (proposal.status !== PROJECT_STATUS.PENDING) {
    return error(res, 'Solo se pueden extender propuestas pendientes', 400);
  }
  
  // Verificar que el usuario es el cliente (creador de la propuesta)
  if (proposal.client.toString() !== req.user.id && !req.user.isAdmin) {
    return error(res, 'No autorizado para extender esta propuesta', 403);
  }
  
  // Calcular nueva fecha de expiración
  const newExpiryDate = new Date();
  newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(days));
  
  // Actualizar fecha de expiración
  proposal.expiresAt = newExpiryDate;
  
  await proposal.save();
  
  return success(res, {
    message: `Propuesta extendida por ${days} días`,
    proposal: proposal.toPublic()
  });
});