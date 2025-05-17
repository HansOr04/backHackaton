/**
 * messageService.js
 * Servicio para gestionar mensajes entre clientes y proveedores
 */

const Message = require('../models/Message');
const Project = require('../models/Project');
const { getIO } = require('../webSockets/socket');

/**
 * Servicio para manejar mensajes entre usuarios
 */
const messageService = {
  /**
   * Envía un nuevo mensaje en un proyecto
   * @param {Object} messageData - Datos del mensaje a enviar
   * @returns {Promise<Object>} Mensaje creado
   */
  async sendMessage(messageData) {
    try {
      const { 
        projectId, 
        senderId, 
        content, 
        type = 'text',
        attachment = null
      } = messageData;
      
      // Verificar que el proyecto existe
      const project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Proyecto no encontrado');
      }
      
      // Verificar que el usuario pertenece al proyecto
      const isClient = project.client.toString() === senderId;
      const isProvider = project.provider.toString() === senderId;
      
      if (!isClient && !isProvider) {
        throw new Error('No tienes permiso para enviar mensajes en este proyecto');
      }
      
      // Crear el mensaje
      const message = new Message({
        project: projectId,
        sender: senderId,
        content,
        type,
        attachment,
        read: false,
        readBy: []
      });
      
      await message.save();
      
      // Poblar información del remitente para la respuesta
      await message.populate({
        path: 'sender',
        select: 'name avatar walletAddress'
      });
      
      // Emitir evento a través de WebSockets si está disponible
      try {
        const io = getIO();
        io.to(`project:${projectId}`).emit('new_message', {
          message: message.toPublic()
        });
      } catch (socketError) {
        console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
      }
      
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },
  
  /**
   * Obtiene los mensajes de un proyecto
   * @param {string} projectId - ID del proyecto
   * @param {Object} options - Opciones de paginación
   * @returns {Promise<Array>} Lista de mensajes
   */
  async getProjectMessages(projectId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        sort = '-timestamp'
      } = options;
      
      // Calcular salto para paginación
      const skip = (page - 1) * limit;
      
      // Obtener mensajes
      const messages = await Message.find({ project: projectId })
        .populate({
          path: 'sender',
          select: 'name avatar walletAddress'
        })
        .sort(sort)
        .skip(skip)
        .limit(limit);
      
      // Contar total para paginación
      const total = await Message.countDocuments({ project: projectId });
      
      return {
        messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting project messages:', error);
      throw error;
    }
  },
  
  /**
   * Marca mensajes como leídos por un usuario
   * @param {Array<string>} messageIds - IDs de los mensajes a marcar
   * @param {string} userId - ID del usuario que lee los mensajes
   * @returns {Promise<number>} Número de mensajes actualizados
   */
  async markMessagesAsRead(messageIds, userId) {
    try {
      // Verificar que los IDs son válidos
      if (!messageIds || !messageIds.length) {
        return 0;
      }
      
      // Obtener mensajes que no son del usuario y no han sido leídos por él
      const messagesToMark = await Message.find({
        _id: { $in: messageIds },
        sender: { $ne: userId }, // No marcar los mensajes propios
        'readBy.user': { $ne: userId } // No actualizar si ya están marcados
      });
      
      if (!messagesToMark.length) {
        return 0;
      }
      
      // Actualizar cada mensaje
      const updatePromises = messagesToMark.map(message => 
        message.markReadBy(userId)
      );
      
      await Promise.all(updatePromises);
      
      // Notificar a través de WebSockets
      try {
        const io = getIO();
        messagesToMark.forEach(message => {
          io.to(`project:${message.project}`).emit('message_read', {
            messageId: message._id,
            readBy: userId,
            timestamp: new Date()
          });
        });
      } catch (socketError) {
        console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
      }
      
      return messagesToMark.length;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },
  
  /**
   * Obtiene mensajes no leídos para un usuario
   * @param {string} userId - ID del usuario
   * @param {boolean} count - Solo devolver conteo o mensajes completos
   * @returns {Promise<Object>} Conteo o lista de mensajes no leídos
   */
  async getUnreadMessages(userId, count = false) {
    try {
      // Obtener proyectos donde el usuario es cliente o proveedor
      const projects = await Project.find({
        $or: [
          { client: userId },
          { provider: userId }
        ]
      }).select('_id');
      
      const projectIds = projects.map(p => p._id);
      
      // Construir consulta base
      const query = {
        project: { $in: projectIds },
        sender: { $ne: userId }, // No incluir mensajes propios
        'readBy.user': { $ne: userId } // No leídos por el usuario
      };
      
      // Si solo se requiere el conteo
      if (count) {
        const unreadCount = await Message.countDocuments(query);
        return { count: unreadCount };
      }
      
      // Obtener mensajes no leídos
      const unreadMessages = await Message.find(query)
        .populate({
          path: 'sender',
          select: 'name avatar walletAddress'
        })
        .populate({
          path: 'project',
          select: 'title'
        })
        .sort('-timestamp');
      
      return { messages: unreadMessages };
    } catch (error) {
      console.error('Error getting unread messages:', error);
      throw error;
    }
  },
  
  /**
   * Borra un mensaje (solo permitido para mensajes propios)
   * @param {string} messageId - ID del mensaje a borrar
   * @param {string} userId - ID del usuario que solicita el borrado
   * @returns {Promise<boolean>} Resultado de la operación
   */
  async deleteMessage(messageId, userId) {
    try {
      // Buscar el mensaje
      const message = await Message.findOne({
        _id: messageId,
        sender: userId // Solo permitir borrar mensajes propios
      });
      
      if (!message) {
        return false;
      }
      
      const projectId = message.project;
      
      // Eliminar el mensaje
      await Message.deleteOne({ _id: messageId });
      
      // Notificar a través de WebSockets
      try {
        const io = getIO();
        io.to(`project:${projectId}`).emit('message_deleted', {
          messageId,
          deletedBy: userId,
          timestamp: new Date()
        });
      } catch (socketError) {
        console.log('WebSocket no disponible para notificación en tiempo real:', socketError.message);
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }
};

module.exports = messageService;
