/**
 * aiChatConfig.js
 * Configuración para el chat con respuestas automáticas
 */

module.exports = {
  // Umbral de coincidencia para las respuestas del chat
  MATCH_THRESHOLD: 0.6,
  
  // Máximo número de resultados a devolver
  MAX_RESULTS: {
    CATEGORIES: 3,
    SERVICES: 5,
    SUGGESTIONS: 4
  },
  
  // Palabras clave globales para cada categoría
  CATEGORY_KEYWORDS: {
    'web-development': [
      'web', 'página', 'sitio', 'website', 'desarrollo web', 'html', 'css', 
      'javascript', 'react', 'angular', 'vue', 'frontend', 'backend', 'full stack'
    ],
    'mobile-app-development': [
      'app', 'aplicación', 'móvil', 'android', 'ios', 'celular', 'smartphone', 
      'flutter', 'react native', 'swift', 'kotlin'
    ],
    'graphic-design': [
      'diseño', 'logo', 'branding', 'identidad', 'visual', 'gráfico', 
      'ilustración', 'photoshop', 'illustrator', 'creativo'
    ],
    'content-writing': [
      'contenido', 'texto', 'redacción', 'copywriting', 'artículos', 'blog', 
      'escritura', 'redactor', 'seo', 'guiones'
    ]
  },
  
  // Respuestas por defecto cuando no hay coincidencias
  DEFAULT_RESPONSES: [
    "No he encontrado información específica sobre eso. ¿Podrías darme más detalles?",
    "No tengo una respuesta para eso. ¿Te gustaría ver las categorías disponibles?",
    "No estoy seguro de entender tu consulta. ¿Qué tipo de servicio estás buscando?",
    "Parece que no tenemos esa categoría específica. ¿Puedo mostrarte alternativas similares?"
  ],
  
  // Sugerencias por defecto para mostrar al usuario
  DEFAULT_SUGGESTIONS: [
    "Ver todas las categorías",
    "Servicios más populares",
    "¿Cómo funciona la plataforma?",
    "Necesito un desarrollo web",
    "Busco diseño gráfico"
  ],
  
  // Frases de saludo para detectar inicios de conversación
  GREETING_PHRASES: [
    "hola", "hello", "hi", "buenos días", "buenas tardes", "buenas noches",
    "qué tal", "saludos", "hey"
  ],
  
  // Frases de despedida para detectar fines de conversación
  FAREWELL_PHRASES: [
    "adiós", "bye", "chao", "hasta luego", "nos vemos", "gracias"
  ],
  
  // Configuración de procesamiento de lenguaje natural
  NLP: {
    // Palabras a ignorar (artículos, preposiciones, etc.)
    STOP_WORDS: [
      "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "a", "ante", 
      "con", "en", "para", "por", "sin", "sobre", "tras", "y", "o", "pero", "que", "si"
    ],
    
    // Pesos para diferentes tipos de coincidencias
    WEIGHTS: {
      EXACT_MATCH: 1.0,
      PARTIAL_MATCH: 0.7,
      RELATED_TERM: 0.4
    }
  }
};