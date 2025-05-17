/**
 * Message.js
 * Modelo para mensajes entre clientes y proveedores en un proyecto
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Proyecto al que pertenece el mensaje
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'El proyecto es obligatorio']
  },
  
  // Usuario que envía el mensaje
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El remitente es obligatorio']
  },
  
  // Contenido del mensaje
  content: {
    type: String,
    required: [true, 'El contenido del mensaje es obligatorio'],
    trim: true,
    maxlength: [5000, 'El mensaje no puede tener más de 5000 caracteres']
  },
  
  // Tipo de mensaje (texto, archivo, sistema)
  type: {
    type: String,
    enum: ['text', 'file', 'system'],
    default: 'text'
  },
  
  // Archivo adjunto (si type es 'file')
  attachment: {
    filename: {
      type: String
    },
    url: {
      type: String
    },
    mimeType: {
      type: String
    },
    size: {
      type: Number
    }
  },
  
  // Estado de lectura del mensaje
  read: {
    type: Boolean,
    default: false
  },
  
  // Usuarios que han leído el mensaje
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Fecha y hora de envío
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas eficientes
messageSchema.index({ project: 1, timestamp: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ timestamp: -1 });

// Middleware para poblar referencias automáticamente
messageSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'sender',
    select: 'name avatar walletAddress'
  });
  
  next();
});

// Método para marcar como leído por un usuario
messageSchema.methods.markReadBy = async function(userId) {
  // Verificar si ya fue leído por este usuario
  const alreadyRead = this.readBy.some(r => r.user.toString() === userId.toString());
  
  if (!alreadyRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
    
    // Actualizar estado general de lectura
    this.read = true;
    
    await this.save();
  }
  
  return this;
};

// Método para verificar si fue leído por un usuario específico
messageSchema.methods.isReadBy = function(userId) {
  return this.readBy.some(r => r.user.toString() === userId.toString());
};

// Método para formato público
messageSchema.methods.toPublic = function(requestUserId) {
  return {
    id: this._id,
    project: this.project,
    sender: this.sender,
    content: this.content,
    type: this.type,
    attachment: this.attachment,
    read: this.read,
    isRead: requestUserId ? this.isReadBy(requestUserId) : false,
    timestamp: this.timestamp
  };
};

// Crear y exportar el modelo
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;