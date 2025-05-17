/**
 * Transaction.js
 * Modelo para transacciones de pago con World Coin
 */

const mongoose = require('mongoose');
const { TRANSACTION_STATUS, TOKENS } = require('../config/constants');

const transactionSchema = new mongoose.Schema({
  // Proyecto asociado a la transacción
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'El proyecto es obligatorio']
  },
  
  // Cliente que realiza el pago
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El cliente es obligatorio']
  },
  
  // Proveedor que recibe el pago
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El proveedor es obligatorio']
  },
  
  // Monto de la transacción
  amount: {
    type: Number,
    required: [true, 'El monto es obligatorio'],
    min: [0, 'El monto no puede ser negativo']
  },
  
  // Token utilizado para el pago
  token: {
    type: String,
    enum: Object.values(TOKENS),
    default: TOKENS.WLD
  },
  
  // Estado de la transacción
  status: {
    type: String,
    enum: Object.values(TRANSACTION_STATUS),
    default: TRANSACTION_STATUS.PENDING
  },
  
  // Hash de la transacción en la blockchain
  txHash: {
    type: String,
    trim: true
  },
  
  // Referencia única generada para esta transacción
  reference: {
    type: String,
    required: [true, 'La referencia es obligatoria'],
    unique: true,
    trim: true
  },
  
  // ID de transacción devuelto por World Pay
  transactionId: {
    type: String,
    trim: true
  },
  
  // Dirección del contrato (si aplica)
  contractAddress: {
    type: String,
    trim: true
  },
  
  // Red blockchain utilizada
  network: {
    type: String,
    default: 'worldchain'
  },
  
  // Información adicional sobre la transacción
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Fecha de la transacción
  timestamp: {
    type: Date,
    default: Date.now
  },
  
  // Fecha de confirmación (cuando se completa)
  confirmedAt: {
    type: Date
  },
  
  // Fecha de última actualización
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas eficientes
transactionSchema.index({ project: 1 });
transactionSchema.index({ client: 1 });
transactionSchema.index({ provider: 1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ timestamp: -1 });

// Middleware pre-save para actualizar timestamp
transactionSchema.pre('save', function(next) {
  // Actualizar fecha de modificación
  this.updatedAt = Date.now();
  
  // Si el estado cambia a completado, actualizar la fecha de confirmación
  if (this.isModified('status') && this.status === TRANSACTION_STATUS.COMPLETED && !this.confirmedAt) {
    this.confirmedAt = Date.now();
  }
  
  next();
});

// Middleware para poblar referencias automáticamente
transactionSchema.pre(/^find/, function(next) {
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
transactionSchema.statics.findByReference = function(reference) {
  return this.findOne({ reference });
};

// Método estático para buscar por transactionId de World
transactionSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({ transactionId });
};

// Método para calcular el equivalente en USD (ejemplo)
transactionSchema.methods.getUsdValue = async function() {
  // Esta función debería implementar la lógica para obtener el valor en USD
  // usando un servicio externo o una API de precios
  return this.amount * 1.5; // Valor de ejemplo, implementar lógica real
};

// Método para formato público
transactionSchema.methods.toPublic = function() {
  return {
    id: this._id,
    project: this.project,
    client: this.client,
    provider: this.provider,
    amount: this.amount,
    token: this.token,
    status: this.status,
    txHash: this.txHash,
    reference: this.reference,
    network: this.network,
    timestamp: this.timestamp,
    confirmedAt: this.confirmedAt
  };
};

// Crear y exportar el modelo
const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;