/**
 * server.js
 * Punto de entrada para la aplicación
 */

// Cargar variables de entorno
require('dotenv').config();

// Imports
const http = require('http');
const app = require('./app');

// Puerto
const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const server = http.createServer(app);

// Configurar WebSockets (opcional)
if (process.env.ENABLE_WEBSOCKETS === 'true') {
  const socketIO = require('socket.io');
  const io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });
  
  // Configuración básica de WebSockets
  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    
    socket.on('disconnect', () => {
      console.log('Cliente desconectado:', socket.id);
    });
    
    // Puedes añadir más manejadores de eventos aquí
  });
  
  // Hacer disponible io para otros módulos
  app.set('io', io);
}

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV}`);
  console.log(`URL: http://localhost:${PORT}`);
});

// Manejar errores no capturados
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
  console.error('Cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado');
    process.exit(1);
  });
  
  // Si el servidor no se cierra en 10 segundos, forzar cierre
  setTimeout(() => {
    console.error('Forzando cierre del servidor');
    process.exit(1);
  }, 10000);
});

// Manejar promesas rechazadas no capturadas
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no capturada:', reason);
  // No cerramos el servidor para mantenerlo funcionando
});