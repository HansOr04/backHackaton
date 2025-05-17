/**
 * User.js
 * Modelo de usuario para la aplicación
 */

const mongoose = require('mongoose');
const { VERIFICATION_LEVELS } = require('../config/constants');

const userSchema = new mongoose.Schema({
  // Dirección de wallet Ethereum (utilizada para autenticación con World ID)
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  
  // Nombre de usuario en World (opcional)
  worldUsername: {
    type: String,
    trim: true
  },
  
  // Nombre público del usuario
  name: {
    type: String,
    trim: true
  },
  
  // Biografía o descripción del usuario
  bio: {
    type: String,
    trim: true
  },
  
  // Avatar o imagen de perfil (URL)
  avatar: {
    type: String
  },
  
  // Nivel de verificación con World ID
  verificationLevel: {
    type: String,
    enum: Object.values(VERIFICATION_LEVELS),
    default: VERIFICATION_LEVELS.DEVICE
  },
  
  // Habilidades o especialidades del usuario
  skills: [{
    type: String,
    trim: true
  }],
  
  // Calificación promedio (de 0 a 5)
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  
  // Número total de trabajos completados
  completedJobs: {
    type: Number,
    default: 0
  },
  
  // Estado del usuario (activo/inactivo)
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Fechas de creación y actualización
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pre-save para actualizar el campo updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para generar el perfil público del usuario
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    walletAddress: this.walletAddress,
    worldUsername: this.worldUsername,
    name: this.name,
    bio: this.bio,
    avatar: this.avatar,
    verificationLevel: this.verificationLevel,
    skills: this.skills,
    rating: this.rating,
    completedJobs: this.completedJobs
  };
};

// Crear y exportar el modelo
const User = mongoose.model('User', userSchema);

module.exports = User;