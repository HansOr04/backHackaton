/**
 * Project.js
 * Modelo para proyectos activos derivados de propuestas aceptadas
 */

const mongoose = require('mongoose');
const { PROJECT_STATUS } = require('../config/constants');

const projectSchema = new mongoose.Schema({
  // Propuesta que originó el proyecto
  proposal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proposal',
    required: [true, 'La propuesta es obligatoria']
  },
  
  // Cliente del proyecto
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El cliente es obligatorio']
  },
  
  // Proveedor del servicio
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El proveedor es obligatorio']
  },
  
  // Título del proyecto (heredado de la propuesta)
  title: {
    type: String,
    required: [true, 'El título del proyecto es obligatorio'],
    trim: true
  },
  
  // Descripción del proyecto (heredado de la propuesta)
  description: {
    type: String,
    required: [true, 'La descripción del proyecto es obligatoria'],
    trim: true
  },
  
  // Precio acordado
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
  
  // Tiempo de entrega acordado (en días)
  deliveryTime: {
    type: Number,
    required: [true, 'El tiempo de entrega es obligatorio'],
    min: [1, 'El tiempo de entrega debe ser al menos 1 día']
  },
  
  // Fecha límite calculada
  deadline: {
    type: Date
  },
  
  // Estado actual del proyecto
  status: {
    type: String,
    enum: Object.values(PROJECT_STATUS),
    default: PROJECT_STATUS.IN_PROGRESS
  },
  
  // Aprobación del cliente para finalizar
  clientApproved: {
    type: Boolean,
    default: false
  },
  
  // Aprobación del proveedor para finalizar
  providerApproved: {
    type: Boolean,
    default: false
  },
  
  // Fecha de inicio del proyecto
  startDate: {
    type: Date,
    default: Date.now
  },
  
  // Fecha de finalización del proyecto
  completionDate: {
    type: Date
  },
  
  // Hitos o entregables del proyecto
  milestones: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    dueDate: {
      type: Date
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    }
  }],
  
  // Archivos entregados por el proveedor
  deliverables: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    fileUrl: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Notas adicionales
  notes: {
    type: String,
    trim: true
  },
  
  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas eficientes
projectSchema.index({ client: 1, status: 1 });
projectSchema.index({ provider: 1, status: 1 });
projectSchema.index({ startDate: -1 });
projectSchema.index({ deadline: 1 });
projectSchema.index({ status: 1 });

// Middleware pre-save para actualizar timestamp y deadline
projectSchema.pre('save', function(next) {
  // Actualizar fecha de modificación
  this.updatedAt = Date.now();
  
  // Calcular deadline si es un nuevo proyecto
  if (this.isNew && this.deliveryTime && !this.deadline) {
    this.deadline = new Date(this.startDate.getTime() + this.deliveryTime * 24 * 60 * 60 * 1000);
  }
  
  // Si ambas partes han aprobado, marcar como completado
  if (this.clientApproved && this.providerApproved && this.status !== PROJECT_STATUS.COMPLETED) {
    this.status = PROJECT_STATUS.COMPLETED;
    this.completionDate = Date.now();
  }
  
  next();
});

// Middleware para poblar referencias automáticamente
projectSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'client',
    select: 'name avatar walletAddress'
  }).populate({
    path: 'provider',
    select: 'name avatar walletAddress'
  }).populate({
    path: 'proposal',
    select: 'service title price deliveryTime'
  });
  
  next();
});

// Método para verificar si está atrasado
projectSchema.methods.isOverdue = funct