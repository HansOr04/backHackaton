/**
 * allJsonSearch.js
 * Utilidad para buscar en todos los archivos JSON
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Busca en todos los archivos JSON de la carpeta data
 * @param {string} searchPath - Ruta de búsqueda
 * @param {string} [query] - Término de búsqueda opcional
 * @returns {Promise<Array>} - Lista de resultados
 */
async function searchAllJson(searchPath = 'data', query) {
  try {
    const dataDir = path.join(__dirname, '..', '..', searchPath);
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const results = [];
    
    for (const file of jsonFiles) {
      const fullPath = path.join(dataDir, file);
      const data = require(fullPath);
      
      // Si hay una consulta, filtrar por ella
      if (query) {
        const filteredData = data.filter(item => {
          return Object.values(item).some(value => 
            typeof value === 'string' && value.toLowerCase().includes(query.toLowerCase())
          );
        });
        results.push(...filteredData);
      } else {
        results.push(...data);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error searching JSON files:', error);
    return [];
  }
}

module.exports = {
  searchAllJson
};
