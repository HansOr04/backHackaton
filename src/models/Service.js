/**
 * Service.js
 * Modelo para servicios ofrecidos en la plataforma
 */

const mongoose = require('mongoose');
const { PRICE_TYPES } = require('../config/constants');

const serviceSchema = new mongoose.Schema({
  // Título del servicio
  title: {
    type: String,
    required: [true, 'El título del servicio es obligatorio'],
    trim: true,
    maxlength: [100, 'El título no puede tener más de 100 caracteres']
  },
  
  // Descripción detallada del servicio
  description: {
    type: String,
    required: [true, 'La descripción del servicio es obligatoria'],
    trim: true,
    maxlength: [2000, 'La descripción no puede tener más de 2000 caracteres']
  },
  
  // Categoría a la que pertenece el servicio
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'La categoría es obligatoria']
  },
  
  // Usuario que ofrece el servicio
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El proveedor es obligatorio']
  },
  
  // Precio base del servicio
  price: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  
  // Tipo de precio (fijo, por hora, negociable)
  priceType: {
    type: String,
    enum: Object.values(PRICE_TYPES),
    default: PRICE_TYPES.FIXED
  },
  
  // Token utilizado para el pago
  token: {
    type: String,
    default: 'WLD'
  },
  
  // Tiempo estimado de entrega (en días)
  deliveryTime: {
    type: Number,
    min: [0, 'El tiempo de entrega no puede ser negativo']
  },
  
  // Imágenes o capturas del servicio (URLs)
  images: [{
    type: String
  }],
  
  // Etiquetas o palabras clave
  tags: [{
    type: String,
    trim: true
  }],
  
  // Calificación promedio del servicio
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  // Número de valoraciones recibidas
  ratingCount: {
    type: Number,
    default: 0
  },
  
  // Número de ventas/contrataciones
  sales: {
    type: Number,
    default: 0
  },
  
  // Estado del servicio (activo/inactivo)
  active: {
    type: Boolean,
    default: true
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
serviceSchema.index({ title: 'text', description: 'text', tags: 'text' });
serviceSchema.index({ category: 1 });
serviceSchema.index({ provider: 1 });
serviceSchema.index({ price: 1 });
serviceSchema.index({ createdAt: -1 });

// Middleware pre-save para actualizar timestamp
serviceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware para poblar referencias automáticamente
serviceSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'provider',
    select: 'name avatar rating walletAddress'
  }).populate({
    path: 'category',
    select: 'name slug'
  });
  
  next();
});

// Método para formato público
serviceSchema.methods.toPublic = function() {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    category: this.category,
    provider: this.provider,
    price: this.price,
    priceType: this.priceType,
    token: this.token,
    deliveryTime: this.deliveryTime,
    images: this.images,
    tags: this.tags,
    rating: this.rating,
    ratingCount: this.ratingCount,
    sales: this.sales,
    createdAt: this.createdAt
  };
};

// Crear y exportar el modelo
const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;