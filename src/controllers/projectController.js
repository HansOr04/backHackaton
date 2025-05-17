/**
 * projectController.js
 * Controlador para operaciones relacionadas con proyectos activos
 */

const asyncHandler = require('../utils/asyncHandler');
const Project = require('../models/Project');
const Message = require('../models/Message');
const worldVerifyService = require('../services/worldVerifyService');
const { getIO } = require('../webSockets/socket');
const { success, error, paginated } = require('../utils/responseFormatter');
const { PROJECT_STATUS, VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Obtiene un proyecto por su ID
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es parte del proyecto
  const userId = req.user.id;
  if (project.client.toString() !== userId && 
      project.provider.toString() !== userId && 
      !req.user.isAdmin) {
    return error(res, 'No autorizado para ver este proyecto', 403);
  }
  
  return success(res, project.toPublic());
});

/**
 * Obtiene proyectos según filtros (como cliente o proveedor)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProjects = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const { 
    role = 'all',  // 'client', 'provider' o 'all'
    status,
    page = 1, 
    limit = 10,
    sort = '-startDate'
  } = req.query;
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir filtro según rol
  const filter = {};
  
  if (role === 'client') {
    filter.client = req.user.id;
  } else if (role === 'provider') {
    filter.provider = req.user.id;
  } else {
    // 'all' - proyectos donde el usuario es cliente o proveedor
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
  const projects = await Project.find(filter)
    .populate('client', 'name avatar walletAddress')
    .populate('provider', 'name avatar walletAddress')
    .populate('proposal', 'title price deliveryTime')
    .skip(skip)
    .limit(parseInt(limit))
    .sort(sort);
  
  // Contar total para paginación
  const total = await Project.countDocuments(filter);
  
  // Transformar a formato público y agregar cálculos
  const formattedProjects = projects.map(project => project.toPublic());
  
  return paginated(res, formattedProjects, parseInt(page), parseInt(limit), total);
});

/**
 * Agrega un hito al proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.addMilestone = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, dueDate } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es parte del proyecto
  const userId = req.user.id;
  const isClient = project.client.toString() === userId;
  const isProvider = project.provider.toString() === userId;
  
  if (!isClient && !isProvider && !req.user.isAdmin) {
    return error(res, 'No autorizado para modificar este proyecto', 403);
  }
  
  // Verificar que el proyecto está en progreso
  if (project.status !== PROJECT_STATUS.IN_PROGRESS) {
    return error(res, 'Solo se pueden agregar hitos a proyectos en progreso', 400);
  }
  
  // Crear nuevo hito
  const milestone = {
    title,
    description,
    dueDate: dueDate ? new Date(dueDate) : null,
    completed: false
  };
  
  // Agregar al array de hitos
  project.milestones.push(milestone);
  
  await project.save();
  
  // Notificar a través de WebSockets
  try {
    const io = getIO();
    io.to(`project:${id}`).emit('milestone_added', {
      projectId: id,
      milestone: project.milestones[project.milestones.length - 1]
    });
  } catch (socketError) {
    console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
  }
  
  // Crear mensaje del sistema
  await Message.create({
    project: id,
    sender: userId,
    content: `Nuevo hito agregado: ${title}`,
    type: 'system'
  });
  
  return success(res, project.toPublic());
});

/**
 * Actualiza el estado de un hito
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateMilestone = asyncHandler(async (req, res) => {
  const { id, milestoneId } = req.params;
  const { completed } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es parte del proyecto
  const userId = req.user.id;
  const isProvider = project.provider.toString() === userId;
  
  if (!isProvider && !req.user.isAdmin) {
    return error(res, 'Solo el proveedor puede actualizar hitos', 403);
  }
  
  // Verificar que el proyecto está en progreso
  if (project.status !== PROJECT_STATUS.IN_PROGRESS) {
    return error(res, 'Solo se pueden actualizar hitos en proyectos en progreso', 400);
  }
  
  // Encontrar el hito
  const milestone = project.milestones.id(milestoneId);
  
  if (!milestone) {
    return error(res, 'Hito no encontrado', 404);
  }
  
  // Actualizar estado
  milestone.completed = completed;
  
  if (completed) {
    milestone.completedAt = new Date();
  } else {
    milestone.completedAt = null;
  }
  
  await project.save();
  
  // Notificar a través de WebSockets
  try {
    const io = getIO();
    io.to(`project:${id}`).emit('milestone_updated', {
      projectId: id,
      milestoneId,
      completed,
      completedAt: milestone.completedAt
    });
  } catch (socketError) {
    console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
  }
  
  // Crear mensaje del sistema
  await Message.create({
    project: id,
    sender: userId,
    content: completed 
      ? `Hito completado: ${milestone.title}` 
      : `Hito marcado como pendiente: ${milestone.title}`,
    type: 'system'
  });
  
  return success(res, project.toPublic());
});

/**
 * Agrega un entregable (archivo) al proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.addDeliverable = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, fileUrl } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es el proveedor
  const userId = req.user.id;
  const isProvider = project.provider.toString() === userId;
  
  if (!isProvider && !req.user.isAdmin) {
    return error(res, 'Solo el proveedor puede agregar entregables', 403);
  }
  
  // Verificar que el proyecto está en progreso
  if (project.status !== PROJECT_STATUS.IN_PROGRESS) {
    return error(res, 'Solo se pueden agregar entregables a proyectos en progreso', 400);
  }
  
  // Verificar que se proporcionó la URL del archivo
  if (!fileUrl) {
    return error(res, 'Se requiere la URL del archivo', 400);
  }
  
  // Crear nuevo entregable
  const deliverable = {
    title,
    description,
    fileUrl,
    uploadedAt: new Date()
  };
  
  // Agregar al array de entregables
  project.deliverables.push(deliverable);
  
  await project.save();
  
  // Notificar a través de WebSockets
  try {
    const io = getIO();
    io.to(`project:${id}`).emit('deliverable_added', {
      projectId: id,
      deliverable: project.deliverables[project.deliverables.length - 1]
    });
  } catch (socketError) {
    console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
  }
  
  // Crear mensaje del sistema
  await Message.create({
    project: id,
    sender: userId,
    content: `Nuevo entregable subido: ${title}`,
    type: 'system'
  });
  
  return success(res, project.toPublic());
});

/**
 * Solicita la finalización del proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.requestCompletion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es el proveedor
  const userId = req.user.id;
  const isProvider = project.provider.toString() === userId;
  
  if (!isProvider) {
    return error(res, 'Solo el proveedor puede solicitar la finalización', 403);
  }
  
  // Verificar que el proyecto está en progreso
  if (project.status !== PROJECT_STATUS.IN_PROGRESS) {
    return error(res, 'Solo se puede solicitar finalización para proyectos en progreso', 400);
  }
  
  // Marcar como aprobado por el proveedor
  project.providerApproved = true;
  // Cambiar estado a "en revisión del cliente"
  project.status = PROJECT_STATUS.CLIENT_REVIEW;
  
  await project.save();
  
  // Notificar a través de WebSockets
  try {
    const io = getIO();
    io.to(`project:${id}`).emit('completion_requested', {
      projectId: id,
      providerApproved: true,
      status: project.status
    });
  } catch (socketError) {
    console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
  }
  
  // Crear mensaje del sistema
  await Message.create({
    project: id,
    sender: userId,
    content: 'El proveedor ha solicitado la finalización del proyecto',
    type: 'system'
  });
  
  return success(res, project.toPublic());
});

/**
 * Aprueba la finalización del proyecto (cliente)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.approveCompletion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es el cliente
  const userId = req.user.id;
  const isClient = project.client.toString() === userId;
  
  if (!isClient) {
    return error(res, 'Solo el cliente puede aprobar la finalización', 403);
  }
  
  // Verificar que el proyecto está en revisión del cliente
  if (project.status !== PROJECT_STATUS.CLIENT_REVIEW) {
    return error(res, 'El proyecto debe estar en revisión del cliente', 400);
  }
  
  // Verificar que el cliente tiene nivel de verificación necesario para pagos
  const hasVerification = await worldVerifyService.hasRequiredVerificationLevel(
    userId,
    VERIFICATION_LEVELS.PHONE
  );
  
  if (!hasVerification) {
    return error(res, 'Se requiere verificación de teléfono para aprobar pagos', 403);
  }
  
  // Marcar como aprobado por el cliente
  project.clientApproved = true;
  // Si ambos han aprobado, marcar como completado
  if (project.providerApproved) {
    project.status = PROJECT_STATUS.COMPLETED;
    project.completionDate = new Date();
  } else {
    project.status = PROJECT_STATUS.PROVIDER_REVIEW;
  }
  
  await project.save();
  
  // Notificar a través de WebSockets
  try {
    const io = getIO();
    io.to(`project:${id}`).emit('completion_approved', {
      projectId: id,
      clientApproved: true,
      status: project.status
    });
  } catch (socketError) {
    console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
  }
  
  // Crear mensaje del sistema
  await Message.create({
    project: id,
    sender: userId,
    content: 'El cliente ha aprobado la finalización del proyecto',
    type: 'system'
  });
  
  return success(res, project.toPublic());
});

/**
 * Solicita una revisión o modificación al trabajo entregado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.requestRevision = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es el cliente
  const userId = req.user.id;
  const isClient = project.client.toString() === userId;
  
  if (!isClient) {
    return error(res, 'Solo el cliente puede solicitar revisiones', 403);
  }
  
  // Verificar que el proyecto está en revisión del cliente
  if (project.status !== PROJECT_STATUS.CLIENT_REVIEW) {
    return error(res, 'El proyecto debe estar en revisión del cliente', 400);
  }
  
  // Verificar que se proporcionó feedback
  if (!feedback) {
    return error(res, 'Se requiere especificar el feedback para la revisión', 400);
  }
  
  // Restablecer aprobación del proveedor
  project.providerApproved = false;
  // Cambiar estado a "en progreso" nuevamente
  project.status = PROJECT_STATUS.IN_PROGRESS;
  
  await project.save();
  
  // Notificar a través de WebSockets
  try {
    const io = getIO();
    io.to(`project:${id}`).emit('revision_requested', {
      projectId: id,
      status: project.status
    });
  } catch (socketError) {
    console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
  }
  
  // Crear mensaje con el feedback
  await Message.create({
    project: id,
    sender: userId,
    content: `Solicitud de revisión: ${feedback}`,
    type: 'text'
  });
  
  // Crear mensaje del sistema
  await Message.create({
    project: id,
    sender: userId,
    content: 'El cliente ha solicitado revisiones al trabajo',
    type: 'system'
  });
  
  return success(res, project.toPublic());
});

/**
 * Actualiza notas o información adicional del proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.updateProjectNotes = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  const project = await Project.findById(id);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es parte del proyecto
  const userId = req.user.id;
  if (project.client.toString() !== userId && 
      project.provider.toString() !== userId && 
      !req.user.isAdmin) {
    return error(res, 'No autorizado para actualizar este proyecto', 403);
  }
  
  // Actualizar notas
  project.notes = notes;
  
  await project.save();
  
  return success(res, project.toPublic());
});