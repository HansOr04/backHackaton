/**
 * worldPaymentController.js
 * Controlador para operaciones de pago con World Pay
 */

const asyncHandler = require('../utils/asyncHandler');
const Project = require('../models/Project');
const Transaction = require('../models/Transaction');
const worldPaymentService = require('../services/worldPaymentService');
const worldVerifyService = require('../services/worldVerifyService');
const { success, error } = require('../utils/responseFormatter');
const { PROJECT_STATUS, TOKENS, VERIFICATION_LEVELS } = require('../config/constants');

/**
 * Inicia un proceso de pago generando una referencia única
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.initiatePayment = asyncHandler(async (req, res) => {
  const { projectId, token = TOKENS.WLD } = req.body;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Verificar que el proyecto existe
  const project = await Project.findById(projectId)
    .populate('client', 'walletAddress name')
    .populate('provider', 'walletAddress name');
  
  if (!project) {
    return error(res, 'Proyecto no encontrado', 404);
  }
  
  // Verificar que el usuario es el cliente del proyecto
  if (project.client._id.toString() !== req.user.id) {
    return error(res, 'Solo el cliente puede iniciar pagos para este proyecto', 403);
  }
  
  // Verificar que el proyecto está completado o en estado de pago
  if (project.status !== PROJECT_STATUS.COMPLETED && 
      !project.clientApproved && 
      !project.providerApproved) {
    return error(res, 'El proyecto debe estar completado o aprobado para realizar pagos', 400);
  }
  
  // Verificar que el usuario tiene nivel de verificación necesario
  const hasVerification = await worldVerifyService.hasRequiredVerificationLevel(
    req.user.id,
    VERIFICATION_LEVELS.PHONE
  );
  
  if (!hasVerification) {
    return error(res, 'Se requiere verificación de teléfono para realizar pagos', 403);
  }
  
  // Verificar si ya existe un pago exitoso para este proyecto
  const existingTransaction = await Transaction.findOne({
    project: projectId,
    status: 'completed'
  });
  
  if (existingTransaction) {
    return error(res, 'Este proyecto ya tiene un pago completado', 400);
  }
  
  try {
    // Generar referencia de pago usando el servicio
    const paymentRef = await worldPaymentService.createPaymentReference({
      projectId,
      clientId: project.client._id,
      providerId: project.provider._id,
      amount: project.price,
      token,
      description: `Pago por: ${project.title}`
    });
    
    // Devolver la información para iniciar el pago en el frontend
    return success(res, {
      reference: paymentRef.reference,
      amount: project.price,
      token,
      recipient: project.provider.walletAddress,
      description: `Pago a ${project.provider.name} por: ${project.title}`,
      projectId
    });
  } catch (err) {
    console.error('Error al iniciar pago:', err);
    return error(res, `Error al generar referencia de pago: ${err.message}`, 500);
  }
});

/**
 * Confirma y verifica un pago realizado con World Pay
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
  
  try {
    // Verificar el pago usando el servicio
    const verificationResult = await worldPaymentService.verifyTransaction(
      transaction_id,
      reference
    );
    
    if (!verificationResult.success) {
      return error(res, verificationResult.message || 'Error al verificar el pago', 400);
    }
    
    // Si el pago está completado, actualizar el proyecto si es necesario
    const transaction = verificationResult.transaction;
    
    if (transaction.status === 'completed') {
      const project = await Project.findById(transaction.project);
      
      if (project && project.status !== PROJECT_STATUS.COMPLETED) {
        project.status = PROJECT_STATUS.COMPLETED;
        project.completionDate = new Date();
        await project.save();
      }
    }
    
    return success(res, {
      success: true,
      transaction: {
        id: transaction._id,
        status: transaction.status,
        amount: transaction.amount,
        token: transaction.token,
        txHash: transaction.txHash,
        timestamp: transaction.timestamp
      }
    });
  } catch (err) {
    console.error('Error al confirmar pago:', err);
    return error(res, `Error al verificar pago: ${err.message}`, 500);
  }
});

/**
 * Obtiene el estado de una transacción específica
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getTransactionStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  try {
    // Buscar la transacción
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      return error(res, 'Transacción no encontrada', 404);
    }
    
    // Verificar que el usuario es parte del proyecto
    const userId = req.user.id;
    if (transaction.client.toString() !== userId && 
        transaction.provider.toString() !== userId && 
        !req.user.isAdmin) {
      return error(res, 'No autorizado para ver esta transacción', 403);
    }
    
    // Si la transacción está pendiente, consultar estado actual
    if (transaction.status === 'pending') {
      const currentStatus = await worldPaymentService.getTransactionStatus(
        transaction.transactionId
      );
      
      if (currentStatus.success) {
        return success(res, currentStatus.transaction);
      }
    }
    
    // Si no se pudo obtener estado actualizado o no era necesario
    return success(res, transaction.toPublic());
  } catch (err) {
    console.error('Error al obtener estado de transacción:', err);
    return error(res, `Error al consultar estado: ${err.message}`, 500);
  }
});

/**
 * Obtiene el historial de transacciones del usuario
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getTransactionHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role = 'all' } = req.query;
  
  // Requiere middleware de autenticación previo
  if (!req.user) {
    return error(res, 'Se requiere autenticación', 401);
  }
  
  // Calcular salto para paginación
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Construir filtro según rol
  const filter = {};
  
  if (role === 'client') {
    filter.client = req.user.id;
  } else if (role === 'provider') {
    filter.provider = req.user.id;
  } else {
    // 'all' - transacciones donde el usuario es cliente o proveedor
    filter.$or = [
      { client: req.user.id },
      { provider: req.user.id }
    ];
  }
  
  // Ejecutar consulta con paginación
  const transactions = await Transaction.find(filter)
    .populate('client', 'name walletAddress')
    .populate('provider', 'name walletAddress')
    .populate('project', 'title')
    .skip(skip)
    .limit(parseInt(limit))
    .sort('-timestamp');
  
  // Contar total para paginación
  const total = await Transaction.countDocuments(filter);
  
  // Transformar a formato público
  const formattedTransactions = transactions.map(tx => tx.toPublic());
  
  return success(res, {
    transactions: formattedTransactions,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * Calcula tarifas y obtiene información de precios para un pago
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.getPaymentInfo = asyncHandler(async (req, res) => {
  const { amount, token = TOKENS.WLD } = req.query;
  
  if (!amount) {
    return error(res, 'Se requiere especificar el monto', 400);
  }
  
  // Verificar token válido
  if (!Object.values(TOKENS).includes(token)) {
    return error(res, 'Token no soportado', 400);
  }
  
  try {
    // Calcular tarifas del servicio (ejemplo)
    const numAmount = parseFloat(amount);
    const serviceFee = 0; // World App no cobra tarifas por ahora
    const totalAmount = numAmount;
    
    // Obtener precio en USD si es posible
    let usdEquivalent = null;
    try {
      const tokenAmount = await worldPaymentService.calculateTokenAmount(numAmount, 'USD');
      usdEquivalent = tokenAmount;
    } catch (e) {
      console.log('No se pudo obtener el equivalente en USD');
    }
    
    return success(res, {
      amount: numAmount,
      fee: serviceFee,
      total: totalAmount,
      token,
      usdEquivalent: usdEquivalent,
      minAmount: 0.1, // Monto mínimo para World Pay
      tokenInfo: {
        symbol: token,
        network: 'worldchain',
        decimals: token === TOKENS.WLD ? 18 : 6
      }
    });
  } catch (err) {
    console.error('Error al calcular información de pago:', err);
    return error(res, `Error al obtener información: ${err.message}`, 500);
  }
});

/**
 * Convierte montos entre diferentes tokens y USD
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 */
exports.convertCurrency = asyncHandler(async (req, res) => {
  const { amount, from, to } = req.query;
  
  if (!amount || !from || !to) {
    return error(res, 'Se requieren amount, from y to', 400);
  }
  
  try {
    const numAmount = parseFloat(amount);
    
    // Si convertimos entre tokens soportados
    if (Object.values(TOKENS).includes(from) && Object.values(TOKENS).includes(to)) {
      // Primero convertimos a USD
      const usdAmount = await worldPaymentService.calculateTokenAmount(numAmount, from);
      // Luego convertimos de USD al token destino
      const targetAmount = await worldPaymentService.calculateTokenAmount(usdAmount, to);
      
      return success(res, {
        input: {
          amount: numAmount,
          currency: from
        },
        output: {
          amount: targetAmount,
          currency: to
        },
        rate: targetAmount / numAmount
      });
    }
    
    // Si convertimos de USD a token o viceversa
    if (from === 'USD' && Object.values(TOKENS).includes(to)) {
      const tokenAmount = await worldPaymentService.calculateTokenAmount(numAmount, to);
      
      return success(res, {
        input: {
          amount: numAmount,
          currency: 'USD'
        },
        output: {
          amount: tokenAmount,
          currency: to
        },
        rate: tokenAmount / numAmount
      });
    }
    
    if (Object.values(TOKENS).includes(from) && to === 'USD') {
      const usdAmount = await worldPaymentService.calculateTokenAmount(numAmount, from);
      
      return success(res, {
        input: {
          amount: numAmount,
          currency: from
        },
        output: {
          amount: usdAmount,
          currency: 'USD'
        },
        rate: usdAmount / numAmount
      });
    }
    
    return error(res, 'Conversión no soportada', 400);
  } catch (err) {
    console.error('Error en conversión de moneda:', err);
    return error(res, `Error al convertir: ${err.message}`, 500);
  }
});