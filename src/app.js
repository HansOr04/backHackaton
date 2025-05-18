/**
 * app.js
 * Configuración de Express
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const { join } = require('path');
const errorHandler = require('./middlewares/errorHandler');
const { initializeWithDefaults } = require('./utils/jsonStore');
const apiRoutes = require('./routes/apiRoutes');

// Crear aplicación Express
const app = express();

// Inicializar almacenamiento JSON
(async () => {
  try {
    await initializeWithDefaults();
    console.log('Almacenamiento JSON inicializado correctamente');
  } catch (error) {
    console.error('Error al inicializar almacenamiento JSON:', error);
  }
})();

// Middleware de seguridad
app.use(helmet());

// Configuración CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Parseo de cookies
app.use(cookieParser(process.env.COOKIE_SECRET));

// Logging
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Parseo de JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir archivos estáticos
app.use(express.static(join(__dirname, '../public')));

// Ruta base
app.get('/', (req, res) => {
  res.json({
    name: 'Marketplace de Servicios API',
    version: '1.0.0',
    status: 'online'
  });
});

// Rutas API
app.use('/api', apiRoutes);

// Middleware para manejar rutas no encontradas
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Ruta no encontrada',
      path: req.path
    }
  });
});

// Middleware para manejo de errores
app.use(errorHandler);

module.exports = app;