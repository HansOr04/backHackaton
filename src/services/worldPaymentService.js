/**
 * worldPaymentService.js
 * Servicio para gestionar pagos con World Pay
 */

const crypto = require('crypto');
const fetch = require('node-fetch');
const { 
  TRANSACTION_STATUS_ENDPOINT, 
  WORLD_APP_ID, 
  DEV_PORTAL_API_KEY 
} = require('../config/worldConfig');
const { TOKENS, TRANSACTION_STATUS } = require('../config/constants');
const PaymentReference = require('../models/PaymentReference');
const Transaction = require('../models/Transaction');
const Project = require('../models/Project');

/**
 * Servicio para manejar pagos con World Pay
 */
const worldPaymentService = {
  /**
   * Crea una referencia de pago para iniciar una transacción
   * @param {Object} paymentDetails - Detalles del pago a realizar
   * @returns {Promise<Object>} Referencia de pago generada
   */
  async createPaymentReference(paymentDetails) {
    try {
      const { 
        projectId, 
        clientId, 
        providerId, 
        amount, 
        token = TOKENS.WLD,
        description = 'Pago por servicios' 
      } = paymentDetails;
      
      // Generar referencia única
      const reference = crypto.randomUUID().replace(/-/g, '');
      
      // Verificar monto mínimo (World Pay requiere al menos 0.1)
      if (amount < 0.1) {
        throw new Error('El monto mínimo para pagos es 0.1');
      }
      
      // Verificar que el proyecto existe
      const project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Proyecto no encontrado');
      }
      
      // Crear referencia de pago
      const paymentRef = new PaymentReference({
        reference,
        project: projectId,
        client: clientId,
        provider: providerId,
        amount,
        token,
        description
      });
      
      await paymentRef.save();
      
      return {
        reference,
        description,
        amount,
        token
      };
    } catch (error) {
      console.error('Error creating payment reference:', error);
      throw error;
    }
  },
  
  /**
   * Verifica el estado de una transacción con World Pay
   * @param {string} transactionId - ID de transacción de World Pay
   * @param {string} reference - Referencia de pago
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verifyTransaction(transactionId, reference) {
    try {
      // Verificar que la referencia existe y no ha sido usada
      const paymentRef = await PaymentReference.findOne({ 
        reference, 
        used: false 
      });
      
      if (!paymentRef) {
        return {
          success: false,
          message: 'Referencia de pago inválida o ya utilizada'
        };
      }
      
      // Consultar estado de la transacción en World
      const response = await fetch(
        `${TRANSACTION_STATUS_ENDPOINT}/${transactionId}?app_id=${WORLD_APP_ID}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${DEV_PORTAL_API_KEY}`,
            'Content-Type': 'application/json'
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('World Pay API error:', errorData);
        return {
          success: false,
          message: 'Error al verificar transacción con World Pay',
          details: errorData
        };
      }
      
      const transaction = await response.json();
      
      // Verificar la referencia y el estado de la transacción
      if (transaction.reference !== reference) {
        return {
          success: false,
          message: 'La referencia de la transacción no coincide'
        };
      }
      
      if (transaction.status === 'failed') {
        return {
          success: false,
          message: 'La transacción ha fallado en la blockchain',
          details: transaction
        };
      }
      
      // Marcar la referencia como utilizada
      paymentRef.used = true;
      await paymentRef.save();
      
      // Determinar el estado de la transacción
      let txStatus;
      if (transaction.status === 'mined') {
        txStatus = TRANSACTION_STATUS.COMPLETED;
      } else {
        txStatus = TRANSACTION_STATUS.PENDING;
      }
      
      // Guardar la transacción en la base de datos
      const txModel = new Transaction({
        project: paymentRef.project,
        client: paymentRef.client,
        provider: paymentRef.provider,
        amount: paymentRef.amount,
        token: paymentRef.token,
        status: txStatus,
        txHash: transaction.tx_hash || null,
        reference,
        transactionId,
        network: transaction.network || 'worldchain',
        metadata: {
          originalResponse: transaction
        }
      });
      
      await txModel.save();
      
      // Si la transacción está completada, actualizar el proyecto
      if (txStatus === TRANSACTION_STATUS.COMPLETED) {
        const project = await Project.findById(paymentRef.project);
        if (project) {
          project.status = 'completed';
          project.completionDate = new Date();
          await project.save();
        }
      }
      
      return {
        success: true,
        transaction: txModel,
        status: transaction.status,
        txHash: transaction.tx_hash
      };
    } catch (error) {
      console.error('Transaction verification error:', error);
      return {
        success: false,
        message: error.message || 'Error al verificar la transacción'
      };
    }
  },
  
  /**
   * Consulta el estado actual de una transacción
   * @param {string} transactionId - ID de transacción
   * @returns {Promise<Object>} Estado actual de la transacción
   */
  async getTransactionStatus(transactionId) {
    try {
      // Consultar transacción en la base de datos
      const transaction = await Transaction.findOne({ transactionId });
      
      if (!transaction) {
        return {
          success: false,
          message: 'Transacción no encontrada'
        };
      }
      
      // Si está pendiente, consultar estado actual en World Pay
      if (transaction.status === TRANSACTION_STATUS.PENDING) {
        const response = await fetch(
          `${TRANSACTION_STATUS_ENDPOINT}/${transactionId}?app_id=${WORLD_APP_ID}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${DEV_PORTAL_API_KEY}`,
              'Content-Type': 'application/json'
            },
          }
        );
        
        if (response.ok) {
          const txData = await response.json();
          
          // Actualizar estado si ha cambiado
          if (txData.status === 'mined' && transaction.status !== TRANSACTION_STATUS.COMPLETED) {
            transaction.status = TRANSACTION_STATUS.COMPLETED;
            transaction.confirmedAt = new Date();
            await transaction.save();
            
            // Actualizar proyecto si es necesario
            const project = await Project.findById(transaction.project);
            if (project && project.status !== 'completed') {
              project.status = 'completed';
              project.completionDate = new Date();
              await project.save();
            }
          } else if (txData.status === 'failed' && transaction.status !== TRANSACTION_STATUS.FAILED) {
            transaction.status = TRANSACTION_STATUS.FAILED;
            await transaction.save();
          }
        }
      }
      
      return {
        success: true,
        transaction: transaction.toPublic()
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return {
        success: false,
        message: error.message || 'Error al consultar estado de transacción'
      };
    }
  },
  
  /**
   * Calcula el monto equivalente en tokens WLD o USDC según el precio en USD
   * @param {number} usdAmount - Monto en dólares
   * @param {string} token - Token a convertir (WLD o USDC)
   * @returns {Promise<number>} Monto equivalente en tokens
   */
  async calculateTokenAmount(usdAmount, token = TOKENS.WLD) {
    try {
      // Si es USDC, la conversión es 1:1
      if (token === TOKENS.USDCE) {
        return usdAmount;
      }
      
      // Para WLD, consultar el precio actual
      // Nota: En un escenario real, consultarías una API de precios
      // Por ahora, usamos un valor de ejemplo (1 WLD = 1.5 USD)
      const wldPrice = 1.5;
      
      // Calcular monto en WLD
      return usdAmount / wldPrice;
    } catch (error) {
      console.error('Error calculating token amount:', error);
      throw error;
    }
  }
};

module.exports = worldPaymentService;