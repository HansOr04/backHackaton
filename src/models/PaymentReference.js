/**
 * PaymentReference.js
 * Modelo para referencias de pago temporales
 * Estas referencias se usan para iniciar transacciones de pago con World Pay
 */

const mongoose = require('mongoose');
const { TOKENS } = require('../config/constants');

const paymentReferenceSchema = new mongoose.Schema({
  // Referencia única generada para este pago
  reference: {
    type: String,
    required: [true, 'La referencia es obligatoria'],
    unique: true,
    trim: true
  },
  
  // Proyecto asociado al pago
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'El proyecto es obligatorio']
  },
  
  // Cliente que realizará el pago
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El cliente es obligatorio']
  },
  
  // Proveedor que recibirá el pago
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El proveedor es obligatorio']
  },
  
  // Monto a pagar
  amount: {
    type: Number,
    required: [true, 'El monto es obligatorio'],
    min: [0.1, 'El monto mínimo es 0.1'] // Mínimo requerido por World Pay
  },
  
  // Token a utilizar para el pago
  token: {
    type: String,
    enum: Object.values(TOKENS),
    default: TOKENS.WLD
  },
  
  // Descripción del pago (se mostrará al usuario)
  description: {
    type: String,
    trim: true,
    default: 'Pago por servicios'
  },
  
  // Indica si la referencia ya ha sido utilizada
  used: {
    type: Boolean,
    default: false
  },
  
  // Red blockchain a utilizar
  network: {
    type: String,
    default: 'worldchain'
  },
  
  // Fecha de creación (con expiración automática)
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 // La referencia expira después de 1 hora
  }
});

// Índices para búsquedas eficientes
paymentReferenceSchema.index({ reference: 1 });
paymentReferenceSchema.index({ project: 1 });
paymentReferenceSchema.index({ client: 1 });
paymentReferenceSchema.index({ used: 1 });
paymentReferenceSchema.index({ createdAt: 1 });

// Middleware para poblar referencias automáticamente
paymentReferenceSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'client',
    select: 'name walletAddress'
  }).populate({
    path: 'provider',
    select: 'name walletAddress'
  }).populate({
    path: 'project',
    select: 'title'
  });
  
  next();
});

// Método estático para buscar por referencia
paymentReferenceSchema.statics.findByReference = function(reference) {
  return this.findOne({ reference, used: false });
};

// Método estático para marcar como utilizada
paymentReferenceSchema.statics.markAsUsed = async function(reference) {
  const paymentRef = await this.findOne({ reference, used: false });
  
  if (paymentRef) {
    paymentRef.used = true;
    await paymentRef.save();
    return paymentRef;
  }
  
  return null;
};

// Método para validar si está activa
paymentReferenceSchema.methods.isValid = function() {
  // Verifica que no esté usada y que no haya expirado
  return !this.used && (new Date() - this.createdAt) < 3600000;
};

// Método para formato público
paymentReferenceSchema.methods.toPublic = function() {
  return {
    reference: this.reference,
    project: this.project,
    amount: this.amount,
    token: this.token,
    description: this.description,
    network: this.network,
    createdAt: this.createdAt
  };
};

// Crear y exportar el modelo
const PaymentReference = mongoose.model('PaymentReference', paymentReferenceSchema);

module.exports = PaymentReference;