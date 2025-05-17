/**
 * db.js
 * Configuración y conexión a MongoDB
 */

const mongoose = require('mongoose');

/**
 * Establece la conexión con MongoDB
 * Usa la URI proporcionada en las variables de entorno
 */
const connectDB = async () => {
  try {
    // Opciones de configuración para Mongoose
    const options = {
      // Usa el nuevo parser de URL de MongoDB
      useNewUrlParser: true,
      // Usa la nueva topología del servidor
      useUnifiedTopology: true,
    };

    // Conectar a MongoDB usando la URI de las variables de entorno
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Salir del proceso con error
    process.exit(1);
  }
};

module.exports = { connectDB };