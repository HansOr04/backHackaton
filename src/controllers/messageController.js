/**
 * messageController.js
 * Controlador para operaciones relacionadas con mensajes entre clientes y proveedores
 */

const asyncHandler = require('../utils/asyncHandler');
const Message = require('../models/Message');
const Project = require('../models/Project');
const messageService = require('../services/messageService');
const { success, error, paginated } = require('../utils/responseFormatter');

/**
 * Envía un nuevo mensaje en un proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const { projectId, content, type = 'text', attachment = null } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  try {
    // Utilizar servicio de mensajes para enviar
    const message = await messageService.sendMessage({
      projectId,
      senderId: req.user.id,
      content,
      type,
      attachment
    });
    
    return success(res, message.toPublic(req.user.id));
  } catch (err) {
    return error(res, err.message, 400);
  }
});

/**
 * Obtiene los mensajes de un proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getProjectMessages = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { page = 1, limit = 20, sort = '-timestamp' } = req.query;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Verificar que el usuario tiene acceso al proyecto
  const project = await Project.findById(projectId);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es parte del proyecto
  const userId = req.user.id;
  if (project.client.toString() !== userId && 
      project.provider.toString() !== userId && 
      !req.user.isAdmin) {
    return error(res, 'No autorizado para ver mensajes de este proyecto', 403);
  }
  
  try {
    // Utilizar servicio de mensajes para obtener mensajes
    const result = await messageService.getProjectMessages(
      projectId, 
      { page, limit, sort }
    );
    
    // Transformar mensajes para incluir estado de lectura para el usuario
    const formattedMessages = result.messages.map(message => 
      message.toPublic(userId)
    );
    
    return paginated(
      res, 
      formattedMessages, 
      parseInt(page), 
      parseInt(limit), 
      result.pagination.total
    );
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * Marca mensajes como leídos
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.markMessagesAsRead = asyncHandler(async (req, res) => {
  const { messageIds } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return error(res, 'Se requiere un array de IDs de mensajes', 400);
  }
  
  try {
    // Utilizar servicio de mensajes para marcar como leídos
    const updatedCount = await messageService.markMessagesAsRead(
      messageIds,
      req.user.id
    );
    
    return success(res, { 
      marked: updatedCount,
      messageIds
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * Obtiene mensajes no leídos del usuario
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getUnreadMessages = asyncHandler(async (req, res) => {
  const { countOnly = false } = req.query;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  try {
    // Utilizar servicio de mensajes para obtener no leídos
    const result = await messageService.getUnreadMessages(
      req.user.id,
      countOnly === 'true'
    );
    
    if (countOnly === 'true') {
      return success(res, { unreadCount: result.count });
    } else {
      // Transformar mensajes para incluir estado de lectura
      const formattedMessages = result.messages.map(message => 
        message.toPublic(req.user.id)
      );
      
      return success(res, { 
        messages: formattedMessages,
        count: formattedMessages.length
      });
    }
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * Elimina un mensaje (solo permitido para mensajes propios)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  try {
    // Utilizar servicio de mensajes para eliminar
    const deleted = await messageService.deleteMessage(
      id,
      req.user.id
    );
    
    if (!deleted) {
      return error(res, 'Mensaje no encontrado o no autorizado para eliminarlo', 403);
    }
    
    return success(res, { 
      message: 'Mensaje eliminado correctamente',
      id
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * Sube un archivo y envía un mensaje con el archivo adjunto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.sendFileMessage = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { fileUrl, fileName, fileType, fileSize, description } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Verificar datos obligatorios
  if (!fileUrl || !fileName) {
    return error(res, 'Se requiere URL y nombre del archivo', 400);
  }
  
  // Verificar que el usuario tiene acceso al proyecto
  const project = await Project.findById(projectId);
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es parte del proyecto
  const userId = req.user.id;
  if (project.client.toString() !== userId && 
      project.provider.toString() !== userId) {
    return error(res, 'No autorizado para enviar mensajes en este proyecto', 403);
  }
  
  try {
    // Crear adjunto
    const attachment = {
      filename: fileName,
      url: fileUrl,
      mimeType: fileType || 'application/octet-stream',
      size: fileSize || 0
    };
    
    // Contenido del mensaje (descripción o nombre del archivo)
    const content = description || `Archivo: ${fileName}`;
    
    // Utilizar servicio de mensajes para enviar
    const message = await messageService.sendMessage({
      projectId,
      senderId: userId,
      content,
      type: 'file',
      attachment
    });
    
    return success(res, message.toPublic(userId));
  } catch (err) {
    return error(res, err.message, 500);
  }
});

/**
 * Obtiene la cantidad de mensajes no leídos agrupados por proyecto
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getUnreadCountByProject = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Obtener proyectos donde el usuario es cliente o proveedor
  const projects = await Project.find({
    $or: [
      { client: req.user.id },
      { provider: req.user.id }
    ]
  }).select('_id');
  
  const projectIds = projects.map(p => p._id);
  
  // Obtener conteo de mensajes no leídos por proyecto
  const unreadCounts = await Message.aggregate([
    {
      $match: {
        project: { $in: projectIds },
        sender: { $ne: req.user.id },
        'readBy.user': { $ne: req.user.id }
      }
    },
    {
      $group: {
        _id: '$project',
        count: { $sum: 1 }
      }
    }
  ]);
  
  // Formatear resultado
  const result = {};
  unreadCounts.forEach(item => {
    result[item._id.toString()] = item.count;
  });
  
  return success(res, result);
});