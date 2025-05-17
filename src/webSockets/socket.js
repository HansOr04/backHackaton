/**
 * socket.js
 * Configuración e inicialización de WebSockets con Socket.IO
 */

const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');

// Variable para almacenar la instancia de Socket.IO
let io;

/**
 * Inicializa el servidor de WebSockets
 * @param {Object} server - Servidor HTTP
 * @returns {Object} Instancia de Socket.IO
 */
const initializeSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || '*', // En producción, limitar a dominio específico
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  
  // Middleware de autenticación para las conexiones WebSocket
  io.use(async (socket, next) => {
    // Obtener token de los parámetros de conexión o headers
    const token = socket.handshake.auth.token || 
                 socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Autenticación requerida'));
    }
    
    try {
      // Verificar token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario por ID
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('Usuario no encontrado'));
      }
      
      // Almacenar información del usuario en el objeto socket
      socket.user = {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        name: user.name || 'Usuario'
      };
      
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      return next(new Error('Token inválido o expirado'));
    }
  });
  
  // Manejar conexiones
  io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.user.id}`);
    
    // Unir al usuario a una sala con su ID para mensajes personales
    socket.join(`user:${socket.user.id}`);
    
    // Manejar unión a salas de proyectos
    socket.on('join_project', async (projectId) => {
      try {
        // Verificar que el usuario pertenece al proyecto
        const project = await Project.findOne({
          _id: projectId,
          $or: [
            { client: socket.user.id },
            { provider: socket.user.id }
          ]
        });
        
        if (!project) {
          socket.emit('error', { 
            message: 'Proyecto no encontrado o acceso denegado' 
          });
          return;
        }
        
        // Unir al usuario a la sala del proyecto
        socket.join(`project:${projectId}`);
        console.log(`Usuario ${socket.user.id} unido al proyecto ${projectId}`);
        
        // Informar al usuario que se unió correctamente
        socket.emit('joined_project', { 
          projectId, 
          timestamp: new Date() 
        });
        
        // Notificar a otros usuarios del proyecto (opcional)
        socket.to(`project:${projectId}`).emit('user_joined', {
          projectId,
          user: {
            id: socket.user.id,
            name: socket.user.name
          },
          timestamp: new Date()
        });
      } catch (err) {
        console.error('Error al unirse al proyecto:', err);
        socket.emit('error', { 
          message: 'Error al unirse al proyecto',
          details: err.message
        });
      }
    });
    
    // Manejar salida de salas de proyectos
    socket.on('leave_project', (projectId) => {
      socket.leave(`project:${projectId}`);
      console.log(`Usuario ${socket.user.id} salió del proyecto ${projectId}`);
      
      // Notificar a otros usuarios del proyecto (opcional)
      socket.to(`project:${projectId}`).emit('user_left', {
        projectId,
        user: {
          id: socket.user.id,
          name: socket.user.name
        },
        timestamp: new Date()
      });
    });
    
    // Estado de typing
    socket.on('typing_start', ({ projectId }) => {
      socket.to(`project:${projectId}`).emit('user_typing', {
        projectId,
        user: {
          id: socket.user.id,
          name: socket.user.name
        },
        typing: true,
        timestamp: new Date()
      });
    });
    
    socket.on('typing_end', ({ projectId }) => {
      socket.to(`project:${projectId}`).emit('user_typing', {
        projectId,
        user: {
          id: socket.user.id,
          name: socket.user.name
        },
        typing: false,
        timestamp: new Date()
      });
    });
    
    // Indicador de presencia
    socket.on('set_presence', ({ status }) => {
      // Almacenar estado de presencia en el socket
      socket.presence = status;
      
      // Emitir a todos los proyectos en los que el usuario está
      const rooms = Array.from(socket.rooms)
        .filter(room => room.startsWith('project:'));
      
      rooms.forEach(room => {
        socket.to(room).emit('user_presence', {
          user: {
            id: socket.user.id,
            name: socket.user.name
          },
          status,
          timestamp: new Date()
        });
      });
    });
    
    // Manejar desconexión
    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.user.id}`);
      
      // Emitir evento de desconexión a todas las salas de proyecto
      const rooms = Array.from(socket.rooms)
        .filter(room => room.startsWith('project:'));
      
      rooms.forEach(room => {
        socket.to(room).emit('user_offline', {
          user: {
            id: socket.user.id,
            name: socket.user.name
          },
          timestamp: new Date()
        });
      });
    });
  });
  
  console.log('Servidor WebSocket inicializado');
  return io;
};

/**
 * Obtiene la instancia de Socket.IO
 * @returns {Object} Instancia de Socket.IO
 * @throws {Error} Si Socket.IO no ha sido inicializado
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado. Llama a initializeSocket primero.');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIO
};