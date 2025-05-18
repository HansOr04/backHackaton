/**
 * worldPaymentController.js
 * Controlador para operaciones de pago con World Pay
 */

const asyncHandler = require('../utils/asyncHandler');
const jsonStore = require('../utils/jsonStore');
const { success, error } = require('../utils/responseFormatter');
const { SERVICE_UNLOCK_COST, TRANSACTION_STATUS } = require('../config/constants');
const { SIMULATE_PAYMENT } = require('../config/worldConfig');

/**
 * Inicia un proceso de pago para desbloquear un servicio
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.initiatePayment = asyncHandler(async (req, res) => {
  const { serviceId } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Verificar que el servicio existe
  const service = await jsonStore.findById('services', serviceId);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Verificar si ya está desbloqueado
  const unlockedServices = await jsonStore.find('unlockedServices');
  const alreadyUnlocked = unlockedServices.some(
    unlocked => 
      unlocked.serviceId === serviceId && 
      unlocked.userId === req.user.id &&
      new Date(unlocked.expiresAt) > new Date() // No expirado
  );
  
  if (alreadyUnlocked) {
    return error(res, 'Este servicio ya está desbloqueado', 400);
  }
  
  // Cargar información del proveedor
  const users = await jsonStore.find('users');
  const provider = users.find(user => user.id === service.provider);
  
  if (!provider) {
    return error(res, 'Proveedor del servicio no encontrado', 404);
  }
  
  // Generar referencia única para el pago
  const reference = `unlock_${serviceId}_${req.user.id}_${Date.now()}`;
  
  // En entorno de desarrollo, se puede simular un pago exitoso
  if (SIMULATE_PAYMENT && process.env.NODE_ENV !== 'production') {
    return success(res, {
      reference,
      amount: SERVICE_UNLOCK_COST,
      token: 'WLD',
      recipient: provider.walletAddress,
      description: `Desbloquear servicio: ${service.title}`,
      serviceId,
      simulationEnabled: true,
      message: 'Puedes usar /api/payment/simulate para simular un pago exitoso en entorno de desarrollo'
    });
  }
  
  // En una implementación real, aquí se crearía la solicitud de pago en World Pay
  
  return success(res, {
    reference,
    amount: SERVICE_UNLOCK_COST,
    token: 'WLD',
    recipient: provider.walletAddress,
    description: `Desbloquear servicio: ${service.title}`,
    serviceId
  });
});

/**
 * Confirma y verifica un pago realizado
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.confirmPayment = asyncHandler(async (req, res) => {
  const { transaction_id, reference } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  if (!transaction_id || !reference) {
    return error(res, 'Se requieren ID de transacción y referencia', 400);
  }
  
  // Parsear la referencia para obtener el serviceId
  const parts = reference.split('_');
  if (parts.length < 3 || parts[0] !== 'unlock') {
    return error(res, 'Referencia inválida', 400);
  }
  
  const serviceId = parts[1];
  
  // Verificar que el usuario coincide con el de la referencia
  if (parts[2] !== req.user.id) {
    return error(res, 'Usuario no coincide con la referencia', 401);
  }
  
  // Verificar que el servicio existe
  const service = await jsonStore.findById('services', serviceId);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // En una implementación real, aquí se verificaría el pago con World Pay API
  // Para este ejemplo, simulamos una verificación exitosa
  
  // Simular verificación de pago - En producción, esto se haría con la API real
  const transactionStatus = TRANSACTION_STATUS.COMPLETED;
  
  if (transactionStatus === TRANSACTION_STATUS.COMPLETED) {
    // Desbloquear el servicio para el usuario
    const unlockedServices = await jsonStore.find('unlockedServices');
    
    // Verificar si ya está desbloqueado
    const existingIndex = unlockedServices.findIndex(
      unlocked => unlocked.serviceId === serviceId && unlocked.userId === req.user.id
    );
    
    // Calcular fecha de expiración (30 días desde ahora)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    if (existingIndex !== -1) {
      // Actualizar registro existente
      unlockedServices[existingIndex].transactionId = transaction_id;
      unlockedServices[existingIndex].unlockedAt = new Date().toISOString();
      unlockedServices[existingIndex].expiresAt = expiryDate.toISOString();
    } else {
      // Añadir nuevo registro de desbloqueo
      unlockedServices.push({
        id: jsonStore.generateId(),
        userId: req.user.id,
        serviceId,
        transactionId: transaction_id,
        unlockedAt: new Date().toISOString(),
        expiresAt: expiryDate.toISOString()
      });
    }
    
    await jsonStore.writeData('unlockedServices', unlockedServices);
    
    // Registrar la transacción
    const transactions = await jsonStore.find('transactions') || [];
    transactions.push({
      id: jsonStore.generateId(),
      reference,
      transactionId: transaction_id,
      userId: req.user.id,
      serviceId,
      amount: SERVICE_UNLOCK_COST,
      token: 'WLD',
      status: TRANSACTION_STATUS.COMPLETED,
      timestamp: new Date().toISOString()
    });
    
    await jsonStore.writeData('transactions', transactions);
    
    return success(res, {
      success: true,
      transaction: {
        id: transaction_id,
        status: TRANSACTION_STATUS.COMPLETED,
        amount: SERVICE_UNLOCK_COST,
        token: 'WLD',
        timestamp: new Date().toISOString()
      },
      service: {
        id: serviceId,
        title: service.title,
        unlocked: true,
        expiresAt: expiryDate.toISOString()
      }
    });
  } else {
    return error(res, 'El pago no se completó correctamente', 400);
  }
});

/**
 * Simula un pago para desarrollo (solo para entorno no productivo)
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.simulatePayment = asyncHandler(async (req, res) => {
  // Solo permitir en entorno de desarrollo
  if (process.env.NODE_ENV === 'production' || !SIMULATE_PAYMENT) {
    return error(res, 'Esta función solo está disponible en entorno de desarrollo', 403);
  }
  
  const { serviceId, reference } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Si no se proporciona referencia, crear una
  const paymentReference = reference || `unlock_${serviceId}_${req.user.id}_${Date.now()}`;
  
  // Verificar que el servicio existe
  const service = await jsonStore.findById('services', serviceId);
  
  if (!service) {
    return error(res, 'Servicio no encontrado', 404);
  }
  
  // Simular un ID de transacción
  const transaction_id = `sim_${Date.now()}`;
  
  // Desbloquear el servicio para el usuario
  const unlockedServices = await jsonStore.find('unlockedServices');
  
  // Verificar si ya está desbloqueado
  const existingIndex = unlockedServices.findIndex(
    unlocked => unlocked.serviceId === serviceId && unlocked.userId === req.user.id
  );
  
  // Calcular fecha de expiración (30 días desde ahora)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  
  if (existingIndex !== -1) {
    // Actualizar registro existente
    unlockedServices[existingIndex].transactionId = transaction_id;
    unlockedServices[existingIndex].unlockedAt = new Date().toISOString();
    unlockedServices[existingIndex].expiresAt = expiryDate.toISOString();
  } else {
    // Añadir nuevo registro de desbloqueo
    unlockedServices.push({
      id: jsonStore.generateId(),
      userId: req.user.id,
      serviceId,
      transactionId: transaction_id,
      unlockedAt: new Date().toISOString(),
      expiresAt: expiryDate.toISOString()
    });
  }
  
  await jsonStore.writeData('unlockedServices', unlockedServices);
  
  return success(res, {
    success: true,
    simulated: true,
    transaction: {
      id: transaction_id,
      reference: paymentReference,
      status: TRANSACTION_STATUS.COMPLETED,
      amount: SERVICE_UNLOCK_COST,
      token: 'WLD',
      timestamp: new Date().toISOString()
    },
    service: {
      id: serviceId,
      title: service.title,
      unlocked: true,
      expiresAt: expiryDate.toISOString()
    }
  });
});

/**
 * Obtiene el historial de transacciones del usuario
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getTransactionHistory = asyncHandler(async (req, res) => {
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Cargar transacciones
  const transactions = await jsonStore.find('transactions') || [];
  
  // Filtrar por usuario
  const userTransactions = transactions.filter(
    transaction => transaction.userId === req.user.id
  );
  
  // Ordenar por timestamp (más recientes primero)
  userTransactions.sort((a, b) => 
    new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  // Añadir información de servicios
  const services = await jsonStore.find('services');
  
  const transactionsWithDetails = userTransactions.map(transaction => {
    const service = services.find(s => s.id === transaction.serviceId);
    
    return {
      ...transaction,
      service: service ? {
        id: service.id,
        title: service.title
      } : null
    };
  });
  
  return success(res, transactionsWithDetails);
});