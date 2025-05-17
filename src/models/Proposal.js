/**
 * Proposal.js
 * Modelo para propuestas de contratación de servicios
 */

const mongoose = require('mongoose');
const { PROJECT_STATUS } = require('../config/constants');

const proposalSchema = new mongoose.Schema({
  // Servicio al que se refiere la propuesta (opcional, puede ser una solicitud directa)
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  },
  
  // Cliente que envía la propuesta
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El cliente es obligatorio']
  },
  
  // Proveedor que recibirá la propuesta
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El proveedor es obligatorio']
  },
  
  // Título de la propuesta
  title: {
    type: String,
    required: [true, 'El título de la propuesta es obligatorio'],
    trim: true,
    maxlength: [100, 'El título no puede tener más de 100 caracteres']
  },
  
  // Descripción detallada del trabajo solicitado
  description: {
    type: String,
    required: [true, 'La descripción de la propuesta es obligatoria'],
    trim: true,
    maxlength: [2000, 'La descripción no puede tener más de 2000 caracteres']
  },
  
  // Precio ofrecido
  price: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  
  // Token a utilizar para el pago
  token: {
    type: String,
    default: 'WLD'
  },
  
  // Tiempo de entrega solicitado (en días)
  deliveryTime: {
    type: Number,
    required: [true, 'El tiempo de entrega es obligatorio'],
    min: [1, 'El tiempo de entrega debe ser al menos 1 día']
  },
  
  // Archivos adjuntos a la propuesta (URLs)
  attachments: [{
    name: {
      type: String
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Estado de la propuesta
  status: {
    type: String,
    enum: Object.values(PROJECT_STATUS),
    default: PROJECT_STATUS.PENDING
  },
  
  // Motivo de rechazo (si aplica)
  rejectionReason: {
    type: String,
    trim: true
  },
  
  // Fecha límite para aceptar la propuesta
  expiresAt: {
    type: Date
  },
  
  // Fecha de creación
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas eficientes
proposalSchema.index({ client: 1, status: 1 });
proposalSchema.index({ provider: 1, status: 1 });
proposalSchema.index({ service: 1 });
proposalSchema.index({ createdAt: -1 });

// Middleware pre-save para actualizar timestamp
proposalSchema.pre('save', function(next) {
  // Actualizar fecha de modificación
  this.updatedAt = Date.now();
  
  // Establecer fecha de expiración por defecto (7 días) si no está definida
  if (!this.expiresAt && this.isNew) {
    this.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// Middleware para poblar referencias automáticamente
proposalSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'client',
    select: 'name avatar walletAddress'
  }).populate({
    path: 'provider',
    select: 'name avatar walletAddress'
  }).populate({
    path: 'service',
    select: 'title price category'
  });
  
  next();
});

// Método para verificar si ha expirado
proposalSchema.methods.hasExpired = function() {
  return this.expiresAt && this.expiresAt < new Date() && this.status === PROJECT_STATUS.PENDING;
};

// Método para formato público
proposalSchema.methods.toPublic = function() {
  return {
    id: this._id,
    service: this.service,
    client: this.client,
    provider: this.provider,
    title: this.title,
    description: this.description,
    price: this.price,
    token: this.token,
    deliveryTime: this.deliveryTime,
    attachments: this.attachments,
    status: this.status,
    rejectionReason: this.rejectionReason,
    expiresAt: this.expiresAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    hasExpired: this.hasExpired()
  };
};

// Crear y exportar el modelo
const Proposal = mongoose.model('Proposal', proposalSchema);

module.exports = Proposal;