/**
 * apiRoutes.js
 * Definición de rutas de la API
 */

const express = require('express');
const router = express.Router();

// Importar controladores
const categoryController = require('../controllers/categoryController');
const serviceController = require('../controllers/serviceController');
const worldPaymentController = require('../controllers/worldPaymentController');
const worldVerifyController = require('../controllers/worldVerifyController');
const worldWalletController = require('../controllers/worldWalletController');
const chatController = require('../controllers/chatController');

// Importar middlewares
const { authGuard, requireAuth, requireVerificationLevel } = require('../middlewares/worldWalletAuthMiddleware');
const { VERIFICATION_LEVELS } = require('../config/constants');

// Middleware para añadir autenticación a todas las rutas
router.use(authGuard);

// Rutas de verificación World ID
router.post('/worldverify', worldVerifyController.verifyProof);
router.get('/worldverify/check', requireAuth, worldVerifyController.checkVerificationLevel);
router.get('/worldverify/info', worldVerifyController.getVerificationInfo);

// Rutas de autorización de wallet
router.post('/walletauth/request', worldWalletController.requestWalletAuthorization);
router.post('/walletauth/complete', worldWalletController.completeWalletAuthorization);
router.get('/walletauth/check', requireAuth, worldWalletController.checkWalletAuthorization);
router.post('/walletauth/disconnect', requireAuth, worldWalletController.disconnectWallet);

// Rutas de categorías
router.get('/categories', categoryController.getAllCategories);
router.get('/categories/search', categoryController.searchCategories);
router.get('/categories/popular', categoryController.getPopularCategories);
router.get('/categories/:id', categoryController.getCategoryById);
router.get('/categories/slug/:slug', categoryController.getCategoryBySlug);
router.get('/categories/:id/services', categoryController.getCategoryServices);

// Rutas de servicios
router.get('/services/popular', serviceController.getPopularServices);
router.get('/services/search', serviceController.searchServices);
router.get('/services/:id', serviceController.getServiceById);
router.get('/services/:id/unlocked', requireAuth, serviceController.checkServiceUnlocked);

// Rutas de pagos
router.post('/payment/initiate', requireAuth, requireVerificationLevel(VERIFICATION_LEVELS.DEVICE), worldPaymentController.initiatePayment);
router.post('/payment/confirm', requireAuth, worldPaymentController.confirmPayment);
router.get('/payment/history', requireAuth, worldPaymentController.getTransactionHistory);

// Ruta de simulación de pago (solo desarrollo)
if (process.env.NODE_ENV !== 'production') {
  router.post('/payment/simulate', requireAuth, worldPaymentController.simulatePayment);
}

// Rutas de chat
router.post('/chat/message', chatController.sendMessage);
router.get('/chat/suggestions', chatController.getChatSuggestions);

module.exports = router;