/**
 * authSocket.js
 * Módulo para manejar la autenticación y aspectos de seguridad en WebSockets
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware de autenticación para Socket.IO
 * Verifica el token JWT y adjunta la información del usuario al socket
 * @param {Object} socket - Socket de conexión
 * @param {Function} next - Función para continuar o rechazar la conexión
 */
const authenticateSocket = async (socket, next) => {
  try {
    // Obtener token de los parámetros de conexión o headers
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Autenticación requerida. Proporcione un token JWT válido.'));
    }
    
    // Verificar token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return next(new Error('Token expirado. Por favor, renueve su sesión.'));
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return next(new Error('Token inválido. Por favor, inicie sesión nuevamente.'));
      }
      
      throw jwtError;
    }
    
    // Buscar usuario por ID
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('Usuario no encontrado. La cuenta puede haber sido eliminada.'));
    }
    
    // Verificar si el usuario está activo
    if (!user.isActive) {
      return next(new Error('Cuenta desactivada. Contacte con soporte para más información.'));
    }
    
    // Almacenar información del usuario en el objeto socket
    socket.user = {
      id: user._id.toString(),
      walletAddress: user.walletAddress,
      name: user.name || 'Usuario',
      verificationLevel: user.verificationLevel
    };
    
    // Registrar la conexión (opcional)
    console.log(`WebSocket autenticado: ${socket.user.id} (${socket.user.name})`);
    
    // Continuar con la conexión
    next();
  } catch (error) {
    console.error('Error en autenticación de WebSocket:', error);
    return next(new Error('Error de autenticación. Intente nuevamente.'));
  }
};

/**
 * Verifica si un usuario tiene permiso para acceder a una sala de proyecto
 * @param {string} userId - ID del usuario
 * @param {string} projectId - ID del proyecto
 * @returns {Promise<boolean>} Resultado de la verificación
 */
const canAccessProjectRoom = async (userId, projectId) => {
  try {
    const Project = require('../models/Project');
    
    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { client: userId },
        { provider: userId }
      ]
    }).select('_id');
    
    return !!project;
  } catch (error) {
    console.error('Error verificando acceso a proyecto:', error);
    return false;
  }
};

/**
 * Verifica si un usuario tiene nivel de verificación suficiente para una acción
 * @param {Object} socket - Socket de conexión con usuario autenticado
 * @param {string} requiredLevel - Nivel de verificación requerido ('device', 'phone', 'orb')
 * @returns {boolean} Si el usuario cumple con el nivel requerido
 */
const hasRequiredVerificationLevel = (socket, requiredLevel) => {
  const levelPriority = {
    'device': 1,
    'phone': 2,
    'orb': 3
  };
  
  const userLevel = socket.user.verificationLevel;
  
  return levelPriority[userLevel] >= levelPriority[requiredLevel];
};

/**
 * Configura los manejadores de eventos relacionados con la autenticación
 * @param {Object} io - Instancia global de Socket.IO
 * @param {Object} socket - Conexión de socket individual
 */
const setupAuthHandlers = (io, socket) => {
  // Evento para actualizar token (similar a refresh token)
  socket.on('update_token', async (data) => {
    try {
      const { token } = data;
      
      if (!token) {
        return socket.emit('auth_error', { 
          message: 'Se requiere token' 
        });
      }
      
      // Verificar nuevo token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Buscar usuario
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return socket.emit('auth_error', { 
          message: 'Usuario no encontrado' 
        });
      }
      
      // Actualizar información de usuario en el socket
      socket.user = {
        id: user._id.toString(),
        walletAddress: user.walletAddress,
        name: user.name || 'Usuario',
        verificationLevel: user.verificationLevel
      };
      
      socket.emit('token_updated', { 
        success: true,
        user: {
          id: user._id,
          name: user.name,
          verificationLevel: user.verificationLevel
        }
      });
    } catch (error) {
      console.error('Error actualizando token:', error);
      socket.emit('auth_error', { 
        message: 'Error actualizando token',
        details: error.message
      });
    }
  });
  
  // Evento para verificar autenticación actual
  socket.on('check_auth', () => {
    socket.emit('auth_status', {
      authenticated: true,
      user: {
        id: socket.user.id,
        name: socket.user.name,
        verificationLevel: socket.user.verificationLevel
      }
    });
  });
};

/**
 * Middleware para verificar permisos en eventos específicos
 * @param {Function} handler - Manejador original del evento
 * @param {Function} permissionCheck - Función que verifica el permiso
 * @returns {Function} Manejador con verificación de permisos
 */
const withPermission = (handler, permissionCheck) => {
  return async (data, callback) => {
    try {
      const hasPermission = await permissionCheck(this, data);
      
      if (!hasPermission) {
        if (typeof callback === 'function') {
          return callback({ error: 'Permiso denegado' });
        }
        return this.emit('error', { message: 'Permiso denegado' });
      }
      
      return handler.call(this, data, callback);
    } catch (error) {
      console.error('Error en verificación de permisos:', error);
      if (typeof callback === 'function') {
        return callback({ error: error.message });
      }
      return this.emit('error', { message: error.message });
    }
  };
};

module.exports = {
  authenticateSocket,
  canAccessProjectRoom,
  hasRequiredVerificationLevel,
  setupAuthHandlers,
  withPermission
};