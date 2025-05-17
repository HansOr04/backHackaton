/**
 * messageHandler.js
 * Manejador de eventos WebSocket relacionados con mensajes
 */

const Message = require('../models/Message');
const Project = require('../models/Project');
const User = require('../models/User');

/**
 * Configura los manejadores de eventos relacionados con mensajes
 * @param {Object} io - Instancia global de Socket.IO
 * @param {Object} socket - Conexión de socket individual
 */
module.exports = function(io, socket) {
  /**
   * Maneja el envío de un nuevo mensaje
   * @param {Object} data - Datos del mensaje
   */
  socket.on('send_message', async (data) => {
    try {
      const { projectId, content, type = 'text', attachment = null } = data;
      
      if (!projectId || !content) {
        return socket.emit('error', { 
          event: 'send_message',
          message: 'Se requieren projectId y content' 
        });
      }
      
      // Verificar que el proyecto existe
      const project = await Project.findById(projectId);
      
      if (!project) {
        return socket.emit('error', { 
          event: 'send_message',
          message: 'Proyecto no encontrado' 
        });
      }
      
      // Verificar que el usuario pertenece al proyecto
      const userId = socket.user.id;
      const isClient = project.client.toString() === userId;
      const isProvider = project.provider.toString() === userId;
      
      if (!isClient && !isProvider) {
        return socket.emit('error', { 
          event: 'send_message',
          message: 'No autorizado para enviar mensajes en este proyecto' 
        });
      }
      
      // Crear el mensaje
      const message = new Message({
        project: projectId,
        sender: userId,
        content,
        type,
        attachment,
        readBy: [{ user: userId, readAt: new Date() }] // El remitente siempre ha leído su propio mensaje
      });
      
      await message.save();
      
      // Poblar información del remitente para la respuesta
      await message.populate({
        path: 'sender',
        select: 'name avatar walletAddress'
      });
      
      // Emitir el mensaje a todos en la sala del proyecto
      io.to(`project:${projectId}`).emit('new_message', {
        message: {
          id: message._id,
          project: message.project,
          sender: message.sender,
          content: message.content,
          type: message.type,
          attachment: message.attachment,
          read: false,
          timestamp: message.timestamp
        }
      });
      
      // También, enviar una notificación personal al otro usuario del proyecto
      const recipientId = isClient ? project.provider.toString() : project.client.toString();
      
      io.to(`user:${recipientId}`).emit('notification', {
        type: 'new_message',
        projectId,
        messageId: message._id,
        sender: {
          id: socket.user.id,
          name: socket.user.name
        },
        preview: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
        timestamp: message.timestamp
      });
      
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
      socket.emit('error', { 
        event: 'send_message',
        message: 'Error al enviar mensaje',
        details: error.message
      });
    }
  });
  
  /**
   * Maneja la marcación de mensajes como leídos
   * @param {Object} data - Datos de lectura
   */
  socket.on('mark_read', async (data) => {
    try {
      const { messageIds } = data;
      
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return socket.emit('error', { 
          event: 'mark_read',
          message: 'Se requiere un array de IDs de mensajes' 
        });
      }
      
      // Buscar mensajes que no son del usuario actual y no han sido leídos por él
      const messagesToMark = await Message.find({
        _id: { $in: messageIds },
        sender: { $ne: socket.user.id }, // No marcar mensajes propios
        'readBy.user': { $ne: socket.user.id } // No actualizar si ya están marcados
      });
      
      if (messagesToMark.length === 0) {
        return socket.emit('messages_read_ack', { 
          messageIds: [],
          count: 0
        });
      }
      
      // Agrupar mensajes por proyecto para notificaciones
      const projectMessages = {};
      
      // Actualizar cada mensaje
      for (const message of messagesToMark) {
        // Agregar al usuario en readBy
        message.readBy.push({
          user: socket.user.id,
          readAt: new Date()
        });
        
        // Actualizar estado general de lectura
        message.read = true;
        
        await message.save();
        
        // Agrupar por proyecto
        if (!projectMessages[message.project]) {
          projectMessages[message.project] = [];
        }
        projectMessages[message.project].push(message._id);
      }
      
      // Emitir evento de lectura a todos los proyectos afectados
      for (const [projectId, projectMessageIds] of Object.entries(projectMessages)) {
        io.to(`project:${projectId}`).emit('messages_read', {
          projectId,
          messageIds: projectMessageIds,
          userId: socket.user.id,
          username: socket.user.name,
          timestamp: new Date()
        });
      }
      
      // Confirmar la operación al cliente
      socket.emit('messages_read_ack', { 
        messageIds: messagesToMark.map(message => message._id),
        count: messagesToMark.length
      });
      
    } catch (error) {
      console.error('Error al marcar mensajes como leídos:', error);
      socket.emit('error', { 
        event: 'mark_read',
        message: 'Error al marcar mensajes como leídos',
        details: error.message
      });
    }
  });
  
  /**
   * Maneja la solicitud de mensajes no leídos
   */
  socket.on('get_unread_count', async () => {
    try {
      // Buscar proyectos donde el usuario es cliente o proveedor
      const projects = await Project.find({
        $or: [
          { client: socket.user.id },
          { provider: socket.user.id }
        ]
      }).select('_id');
      
      const projectIds = projects.map(p => p._id);
      
      // Contar mensajes no leídos
      const unreadCount = await Message.countDocuments({
        project: { $in: projectIds },
        sender: { $ne: socket.user.id },
        'readBy.user': { $ne: socket.user.id }
      });
      
      // Contar mensajes no leídos por proyecto
      const unreadByProject = await Message.aggregate([
        {
          $match: {
            project: { $in: projectIds },
            sender: { $ne: socket.user.id },
            'readBy.user': { $ne: socket.user.id }
          }
        },
        {
          $group: {
            _id: '$project',
            count: { $sum: 1 }
          }
        }
      ]);
      
      // Formatear resultado por proyecto
      const byProject = {};
      unreadByProject.forEach(item => {
        byProject[item._id.toString()] = item.count;
      });
      
      socket.emit('unread_count', {
        total: unreadCount,
        byProject
      });
      
    } catch (error) {
      console.error('Error al obtener conteo de no leídos:', error);
      socket.emit('error', { 
        event: 'get_unread_count',
        message: 'Error al obtener conteo',
        details: error.message
      });
    }
  });
  
  /**
   * Maneja la eliminación de un mensaje
   * @param {Object} data - Datos del mensaje a eliminar
   */
  socket.on('delete_message', async (data) => {
    try {
      const { messageId } = data;
      
      if (!messageId) {
        return socket.emit('error', { 
          event: 'delete_message',
          message: 'Se requiere messageId' 
        });
      }
      
      // Buscar el mensaje
      const message = await Message.findOne({
        _id: messageId,
        sender: socket.user.id // Solo se puede eliminar mensajes propios
      });
      
      if (!message) {
        return socket.emit('error', { 
          event: 'delete_message',
          message: 'Mensaje no encontrado o no autorizado para eliminarlo' 
        });
      }
      
      const projectId = message.project;
      
      // Eliminar el mensaje
      await Message.deleteOne({ _id: messageId });
      
      // Notificar a todos los usuarios en la sala del proyecto
      io.to(`project:${projectId}`).emit('message_deleted', {
        messageId,
        projectId,
        deletedBy: socket.user.id,
        timestamp: new Date()
      });
      
      // Confirmar eliminación al cliente
      socket.emit('message_deleted_ack', { 
        messageId,
        success: true
      });
      
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      socket.emit('error', { 
        event: 'delete_message',
        message: 'Error al eliminar mensaje',
        details: error.message
      });
    }
  });
  
  /**
   * Maneja la carga de historial de mensajes
   * @param {Object} data - Parámetros para cargar mensajes
   */
  socket.on('load_messages', async (data) => {
    try {
      const { 
        projectId, 
        page = 1, 
        limit = 20, 
        before = null 
      } = data;
      
      if (!projectId) {
        return socket.emit('error', { 
          event: 'load_messages',
          message: 'Se requiere projectId' 
        });
      }
      
      // Verificar que el usuario tiene acceso al proyecto
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { client: socket.user.id },
          { provider: socket.user.id }
        ]
      });
      
      if (!project) {
        return socket.emit('error', { 
          event: 'load_messages',
          message: 'Proyecto no encontrado o acceso denegado' 
        });
      }
      
      // Construir filtro para mensajes
      const filter = { project: projectId };
      
      // Si se especifica 'before', cargar mensajes anteriores a ese timestamp
      if (before) {
        filter.timestamp = { $lt: new Date(before) };
      }
      
      // Calcular salto para paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Cargar mensajes
      const messages = await Message.find(filter)
        .populate({
          path: 'sender',
          select: 'name avatar walletAddress'
        })
        .sort({ timestamp: -1 }) // Más recientes primero
        .skip(skip)
        .limit(parseInt(limit));
      
      // Contar total para paginación
      const total = await Message.countDocuments(filter);
      
      // Formatear mensajes con estado de lectura para el usuario
      const formattedMessages = messages.map(message => {
        const isRead = message.readBy.some(read => 
          read.user.toString() === socket.user.id
        );
        
        return {
          id: message._id,
          project: message.project,
          sender: message.sender,
          content: message.content,
          type: message.type,
          attachment: message.attachment,
          read: isRead,
          timestamp: message.timestamp
        };
      });
      
      // Enviar mensajes al cliente
      socket.emit('messages_loaded', {
        messages: formattedMessages.reverse(), // Invertir para orden cronológico
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          hasMore: total > skip + messages.length
        }
      });
      
      // Marcar automáticamente como leídos si es necesario
      if (formattedMessages.length > 0) {
        const unreadMessageIds = formattedMessages
          .filter(msg => !msg.read && msg.sender.id !== socket.user.id)
          .map(msg => msg.id);
        
        if (unreadMessageIds.length > 0) {
          // Usar el mismo mecanismo de mark_read
          socket.emit('mark_read', { messageIds: unreadMessageIds });
        }
      }
      
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
      socket.emit('error', { 
        event: 'load_messages',
        message: 'Error al cargar mensajes',
        details: error.message
      });
    }
  });
};