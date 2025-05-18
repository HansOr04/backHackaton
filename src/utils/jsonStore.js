const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');

/**
 * Inicializa el directorio data si no existe
 */
const initDataDirectory = async () => {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error inicializando directorio data:', error);
    throw error;
  }
};

const generateId = () => crypto.randomBytes(12).toString('hex');

const readData = async (collection) => {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    console.error(`Error leyendo archivo ${collection}.json:`, error);
    throw error;
  }
};

const writeData = async (collection, data) => {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error escribiendo archivo ${collection}.json:`, error);
    throw error;
  }
};

/**
 * Carga datos de un archivo JSON dado el slug (nombre del archivo)
 */
const loadDataByCategorySlug = async (slug) => {
  try {
    const filePath = path.join(DATA_DIR, `${slug}.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    console.error(`Error cargando archivo ${slug}.json:`, error);
    throw error;
  }
};

const compareValues = (itemValue, criteriaValue) => {
  if (criteriaValue !== null && typeof criteriaValue === 'object' && !Array.isArray(criteriaValue)) {
    return true;
  }
  return itemValue === criteriaValue;
};

const find = async (collection, criteria = {}) => {
  const data = await readData(collection);
  if (Object.keys(criteria).length === 0) return data;

  return data.filter(item => {
    for (const [key, value] of Object.entries(criteria)) {
      if (key === '$or' && Array.isArray(value)) {
        const orMatches = value.some(condition => {
          for (const [condKey, condValue] of Object.entries(condition)) {
            if (!compareValues(item[condKey], condValue)) return false;
          }
          return true;
        });
        if (!orMatches) return false;
        continue;
      }
      if (!compareValues(item[key], value)) return false;
    }
    return true;
  });
};

const findOne = async (collection, criteria = {}) => {
  const results = await find(collection, criteria);
  return results.length > 0 ? results[0] : null;
};

const findById = async (collection, id) => {
  return findOne(collection, { id });
};

const insertOne = async (collection, document) => {
  const data = await readData(collection);
  if (!document.id) document.id = generateId();
  if (!document.createdAt) document.createdAt = new Date().toISOString();
  document.updatedAt = new Date().toISOString();
  data.push(document);
  await writeData(collection, data);
  return document;
};

const updateOne = async (collection, criteria, updates) => {
  const data = await readData(collection);
  let updated = false;

  const updatedData = data.map(item => {
    let matches = true;
    for (const [key, value] of Object.entries(criteria)) {
      if (!compareValues(item[key], value)) {
        matches = false;
        break;
      }
    }
    if (matches) {
      updated = true;
      return { ...item, ...updates, updatedAt: new Date().toISOString() };
    }
    return item;
  });

  if (updated) await writeData(collection, updatedData);

  const updatedItem = updatedData.find(item => {
    for (const [key, value] of Object.entries(criteria)) {
      if (!compareValues(item[key], value)) return false;
    }
    return true;
  });

  return { updated, data: updatedItem || null };
};

const deleteOne = async (collection, criteria) => {
  const data = await readData(collection);
  let deleted = false;

  const filteredData = data.filter(item => {
    for (const [key, value] of Object.entries(criteria)) {
      if (!compareValues(item[key], value)) return true;
    }
    deleted = true;
    return false;
  });

  if (deleted) await writeData(collection, filteredData);
  return { deleted };
};

const countDocuments = async (collection, criteria = {}) => {
  const results = await find(collection, criteria);
  return results.length;
};

const initializeWithDefaults = async () => {
  await initDataDirectory();

  const createDefaultCategories = async () => {
    const existingCategories = await readData('categories');
    if (existingCategories.length === 0) {
      const { CATEGORIES, POPULAR_CATEGORIES } = require('../config/constants');

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
          text: 'Marketplace de Servicios conecta a clientes con proveedores de servicios...',
          suggestions: ['Ver categorías', 'Servicios populares', '¿Cómo pagar?'],
          priority: 1,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      await writeData('chatResponses', defaultResponses);
    }
  };

  await createDefaultCategories();
  await createDefaultChatResponses();
};

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

function generateKeywords(slug) {
  const name = slug.replace(/-/g, ' ');
  const words
= name.split(' ');
const keywords = new Set(words);
keywords.add(name);
return Array.from(keywords);
}

module.exports = {
initDataDirectory,
generateId,
find,
findOne,
findById,
insertOne,
updateOne,
deleteOne,
countDocuments,
loadDataByCategorySlug,
initializeWithDefaults
};