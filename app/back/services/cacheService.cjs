// Servicio de caché en memoria simple para optimizar consultas frecuentes
// TTL (Time To Live) configurable por tipo de dato

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5 minutos por defecto
    this.maxSize = 1000; // Máximo de entradas en caché
  }

  // Obtener una clave de caché
  getKey(prefix, params = {}) {
    const paramsStr = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    return `${prefix}${paramsStr ? `|${paramsStr}` : ''}`;
  }

  // Obtener del caché
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Guardar en caché
  set(key, data, ttl = null) {
    // Si el caché está lleno, eliminar la entrada más antigua
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    const ttlMs = ttl || this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now()
    });
  }

  // Invalidar entrada específica
  invalidate(pattern) {
    if (typeof pattern === 'string') {
      // Invalidar por prefijo
      for (const key of this.cache.keys()) {
        if (key.startsWith(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidar clave exacta
      this.cache.delete(pattern);
    }
  }

  // Limpiar todo el caché
  clear() {
    this.cache.clear();
  }

  // Obtener estadísticas del caché
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      maxSize: this.maxSize
    };
  }

  // Limpiar entradas expiradas
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Instancia singleton
const cacheService = new CacheService();

// Limpiar entradas expiradas cada 10 minutos
setInterval(() => {
  cacheService.cleanup();
}, 10 * 60 * 1000);

module.exports = cacheService;

