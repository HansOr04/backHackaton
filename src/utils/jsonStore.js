/**
 * jsonStore.js
 * Utilidad para manejar el almacenamiento y recuperación de datos en archivos JSON
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Ruta al directorio de datos
const DATA_DIR = path.join(__dirname, '../../data');

/**
 * Asegura que el directorio de datos exista
 */
const initDataDirectory = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    console.log(`Directorio de datos inicializado: ${DATA_DIR}`);
  } catch (error) {
    console.error('Error al inicializar directorio de datos:', error);
    throw error;
  }
};

/**
 * Genera un ID único (similar a los ObjectId de MongoDB)
 * @returns {string} ID generado
 */
const generateId = () => {
  return crypto.randomBytes(12).toString('hex');
};

/**
 * Lee datos de un archivo JSON
 * @param {string} collection - Nombre de la colección/archivo
 * @returns {Promise<Array>} Datos del archivo
 */
const readData = async (collection) => {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      // Si el archivo no existe, devolver array vacío
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error al leer ${collection}.json:`, error);
    throw error;
  }
};

/**
 * Escribe datos a un archivo JSON
 * @param {string} collection - Nombre de la colección/archivo
 * @param {Array} data - Datos a escribir
 * @returns {Promise<void>}
 */
const writeData = async (collection, data) => {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error al escribir en ${collection}.json:`, error);
    throw error;
  }
};

/**
 * Busca documentos que coincidan con criterios
 * @param {string} collection - Nombre de la colección
 * @param {Object} criteria - Criterios de búsqueda
 * @returns {Promise<Array>} Documentos encontrados
 */
const find = async (collection, criteria = {}) => {
  const data = await readData(collection);
  
  // Si no hay criterios, devolver todos
  if (Object.keys(criteria).length === 0) {
    return data;
  }
  
  // Filtrar basado en criterios
  return data.filter(item => {
    for (const [key, value] of Object.entries(criteria)) {
      // Manejar operador $or
      if (key === '$or' && Array.isArray(value)) {
        const orMatches = value.some(condition => {
          for (const [condKey, condValue] of Object.entries(condition)) {
            if (!compareValues(item[condKey], condValue)) {
              return false;
            }
          }
          return true;
        });
        
        if (!orMatches) return false;
        continue;
      }
      
      // Manejar comparación regular
      if (!compareValues(item[key], value)) {
        return false;
      }
    }
    return true;
  });
};

/**
 * Busca un documento que coincida con criterios
 * @param {string} collection - Nombre de la colección
 * @param {Object} criteria - Criterios de búsqueda
 * @returns {Promise<Object|null>} Documento encontrado o null
 */
const findOne = async (collection, criteria = {}) => {
  const results = await find(collection, criteria);
  return results.length > 0 ? results[0] : null;
};

/**
 * Busca un documento por su ID
 * @param {string} collection - Nombre de la colección
 * @param {string} id - ID del documento
 * @returns {Promise<Object|null>} Documento encontrado o null
 */
const findById = async (collection, id) => {
  return findOne(collection, { id });
};

/**
 * Inserta un nuevo documento
 * @param {string} collection - Nombre de la colección
 * @param {Object} document - Documento a insertar
 * @returns {Promise<Object>} Documento insertado
 */
const insertOne = async (collection, document) => {
  const data = await readData(collection);
  
  // Generar ID si no se proporciona
  if (!document.id) {
    document.id = generateId();
  }
  
  // Añadir timestamps
  if (!document.createdAt) {
    document.createdAt = new Date().toISOString();
  }
  document.updatedAt = new Date().toISOString();
  
  data.push(document);
  await writeData(collection, data);
  
  return document;
};

/**
 * Actualiza un documento
 * @param {string} collection - Nombre de la colección
 * @param {Object} criteria - Criterios para encontrar el documento
 * @param {Object} updates - Campos a actualizar
 * @returns {Promise<Object>} Resultado de la actualización
 */
const updateOne = async (collection, criteria, updates) => {
  const data = await readData(collection);
  let updated = false;
  
  const updatedData = data.map(item => {
    let matches = true;
    
    // Verificar si el elemento coincide con los criterios
    for (const [key, value] of Object.entries(criteria)) {
      if (!compareValues(item[key], value)) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      // Aplicar actualizaciones
      const updatedItem = { 
        ...item, 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      updated = true;
      return updatedItem;
    }
    
    return item;
  });
  
  if (updated) {
    await writeData(collection, updatedData);
  }
  
  // Buscar el documento actualizado
  const updatedItem = updatedData.find(item => {
    for (const [key, value] of Object.entries(criteria)) {
      if (!compareValues(item[key], value)) {
        return false;
      }
    }
    return true;
  });
  
  return { 
    updated, 
    data: updatedItem || null
  };
};

/**
 * Elimina un documento
 * @param {string} collection - Nombre de la colección
 * @param {Object} criteria - Criterios para encontrar el documento
 * @returns {Promise<Object>} Resultado de la eliminación
 */
const deleteOne = async (collection, criteria) => {
  const data = await readData(collection);
  let deleted = false;
  
  const filteredData = data.filter(item => {
    for (const [key, value] of Object.entries(criteria)) {
      if (!compareValues(item[key], value)) {
        return true;
      }
    }
    deleted = true;
    return false;
  });
  
  if (deleted) {
    await writeData(collection, filteredData);
  }
  
  return { deleted };
};

/**
 * Cuenta documentos que coinciden con criterios
 * @param {string} collection - Nombre de la colección
 * @param {Object} criteria - Criterios de búsqueda
 * @returns {Promise<number>} Cantidad de documentos
 */
const countDocuments = async (collection, criteria = {}) => {
  const results = await find(collection, criteria);
  return results.length;
};

/**
 * Inicializa el almacenamiento con datos por defecto
 * @returns {Promise<void>}
 */
const initializeWithDefaults = async () => {
  await initDataDirectory();
  
  const createDefaultCategories = async () => {
    const existingCategories = await readData('categories');
    
    if (existingCategories.length === 0) {
      // Importar constantes
      const { CATEGORIES, POPULAR_CATEGORIES } = require('../config/constants');
      
      // Crear categorías por defecto
      const defaultCategories = CATEGORIES.map((slug, index) => ({
        id: generateId(),
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug,
        description: `Servicios relacionados con ${slug.replace(/-/g, ' ')}`,
        icon: getCategoryIcon(slug),
        order: index,
        active: true,
        popular: POPULAR_CATEGORIES.includes(slug),
        keywords: generateKeywords(slug),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      await writeData('categories', defaultCategories);
      console.log('Categorías por defecto creadas');
    }
  };
  
  const createDefaultChatResponses = async () => {
    const existingResponses = await readData('chatResponses');
    
    if (existingResponses.length === 0) {
      const defaultResponses = [
        {
          id: generateId(),
          keywords: ['hola', 'buenos dias', 'buenas tardes', 'saludos', 'hey'],
          text: '¡Hola! Soy el asistente virtual de Marketplace de Servicios. ¿En qué puedo ayudarte hoy?',
          suggestions: ['Ver categorías populares', 'Buscar servicios', '¿Cómo funciona?'],
          priority: 1,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: generateId(),
          keywords: ['como funciona', 'explicar', 'plataforma', 'ayuda', 'info'],
          text: 'Marketplace de Servicios conecta a clientes con proveedores de servicios. Puedes explorar categorías, buscar servicios específicos y contratar profesionales. Para ver detalles completos y contactar a un proveedor, debes desbloquear el servicio pagando con World Coin.',
          suggestions: ['Ver categorías', 'Servicios populares', '¿Cómo pagar?'],
          priority: 1,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      await writeData('chatResponses', defaultResponses);
      console.log('Respuestas de chat por defecto creadas');
    }
  };
  
  // Ejecutar inicializaciones
  await createDefaultCategories();
  await createDefaultChatResponses();
};

/**
 * Compara valores para filtrado
 * @param {*} itemValue - Valor del documento
 * @param {*} criteriaValue - Valor del criterio
 * @returns {boolean} Si los valores coinciden
 */
function compareValues(itemValue, criteriaValue) {
  // Si el valor del criterio es un objeto (para operadores como $gt, $lt, etc.)
  if (criteriaValue !== null && typeof criteriaValue === 'object' && !Array.isArray(criteriaValue)) {
    // Implementar operadores si es necesario
    return true;
  }
  
  // Comparación simple
  return itemValue === criteriaValue;
}

/**
 * Obtiene un icono para una categoría
 * @param {string} slug - Slug de la categoría
 * @returns {string} Icono (emoji)
 */
function getCategoryIcon(slug) {
  const icons = {
    'web-development': '🌐',
    'software-architecture': '🏗️',
    'mobile-app-development': '📱',
    'android': '🤖',
    'ios-development': '🍎',
    'machine-learning': '🧠',
    'desktop-app': '💻',
    'game-development': '🎮',
    'api': '🔌',
    'database-development': '🗄️',
    'web-scraping': '🕸️',
    'article-writing': '📝',
    'content-writing': '✍️',
    'ghostwriting': '👻',
    'copywriting': '📣',
    'research-writing': '🔍',
    'graphic-design': '🎨',
    'logo-design': '⭐',
    'photoshop': '📷',
    'illustrator': '🖌️',
    'user-interface-ia': '📱',
    'website-design': '🖥️',
    'data-entry': '📊',
    'virtual-assistant': '👩‍💼',
    'customer-support': '🎧',
    'excel': '📊',
    'web-search': '🔎',
    'engineering': '⚙️',
    'electrical-engineering': '⚡',
    'electronics': '🔌',
    'mechanical-engineering': '🔧',
    'cad-cam': '📐',
    'product-design': '🏭',
    'accounting': '💰',
    'finance': '📈',
    'business-analysis': '📊',
    'project-management': '📋',
    'human-resources': '👥',
    'legal': '⚖️',
    'internet-marketing': '📣',
    'seo': '🔍',
    'facebook-marketing': '👍',
    'social-media-marketing': '📱',
    'sales': '💼',
    'translation': '🌍',
    'english-uk-translator': '🇬🇧',
    'english-us-translator': '🇺🇸',
    'spanish-translator': '🇪🇸',
    'french-translator': '🇫🇷',
    'general-labor': '👷',
    'handyman': '🔨',
    'education-tutoring': '📚',
    'psychology': '🧠',
    'nutrition': '🥗',
    'health': '🏥'
  };
  
  return icons[slug] || '📁';
}

/**
 * Genera palabras clave para una categoría
 * @param {string} slug - Slug de la categoría
 * @returns {Array} Lista de palabras clave
 */
function generateKeywords(slug) {
  const name = slug.replace(/-/g, ' ');
  const words = name.split(' ');
  
  const keywords = [
    name,
    ...words,
    // Añadir algunas variantes
    `servicio de ${name}`,
    `${name} profesional`,
    `contratar ${name}`
  ];
  
  // Añadir palabras clave específicas para algunas categorías
  const specificKeywords = {
    'web-development': ['página web', 'sitio web', 'desarrollo web', 'crear web', 'programación web'],
    'mobile-app-development': ['app', 'aplicación móvil', 'desarrollo app', 'programar app'],
    'graphic-design': ['diseño', 'logo', 'identidad visual', 'branding'],
    'content-writing': ['redacción', 'contenido', 'blog', 'artículos', 'escribir']
  };
  
  if (specificKeywords[slug]) {
    keywords.push(...specificKeywords[slug]);
  }
  
  return keywords;
}

module.exports = {
  initDataDirectory,
  generateId,
  readData,
  writeData,
  find,
  findOne,
  findById,
  insertOne,
updateOne,
  deleteOne,
  countDocuments,
  initializeWithDefaults
};