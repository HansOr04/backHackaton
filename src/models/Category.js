/**
 * Category.js
 * Modelo para categorías de servicios
 */

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  // Nombre de la categoría
  name: {
    type: String,
    required: [true, 'El nombre de la categoría es obligatorio'],
    unique: true,
    trim: true
  },
  
  // Slug para URLs amigables
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Descripción de la categoría
  description: {
    type: String,
    trim: true
  },
  
  // Icono para representar la categoría (código o URL)
  icon: {
    type: String
  },
  
  // Orden de visualización (para ordenar en la UI)
  order: {
    type: Number,
    default: 0
  },
  
  // Estado de la categoría (activa/inactiva)
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

// Middleware pre-save para generar el slug a partir del nombre
categorySchema.pre('save', function(next) {
  // Solo generar el slug si el nombre ha cambiado o es nuevo
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  
  // Actualizar fecha de modificación
  this.updatedAt = Date.now();
  
  next();
});

// Método estático para buscar por slug
categorySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug: slug });
};

// Método para obtener datos públicos
categorySchema.methods.toPublic = function() {
  return {
    id: this._id,
    name: this.name,
    slug: this.slug,
    description: this.description,
    icon: this.icon
  };
};

// Crear y exportar el modelo
const Category = mongoose.model('Category', categorySchema);

module.exports = Category;