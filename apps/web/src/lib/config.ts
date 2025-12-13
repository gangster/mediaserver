/**
 * Application configuration
 * 
 * Provides centralized configuration for API URLs and other settings.
 * Uses relative URLs in production for portability.
 */

/**
 * Get the API base URL.
 * In development, this uses localhost:3000 (API server).
 * In production, it uses relative URLs (same origin).
 */
export function getApiBaseUrl(): string {
  // Check for explicitly configured API URL first
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  // In browser, detect if we're in development
  if (typeof window !== 'undefined') {
    const { hostname, port } = window.location;
    
    // Development: web runs on 8081, API on 3000
    if (port === '8081' || hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // Production: use relative URL (same origin)
    return '';
  }
  
  // Server-side rendering fallback
  return '';
}

/**
 * Get the full URL for an API endpoint
 */
export function getApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * Get the URL for an image from the API
 */
export function getImageUrl(path: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  if (!path) return '';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return getApiUrl(`/api/images${cleanPath}?size=${size}`);
}

/**
 * Get the URL for a media item's image (poster, backdrop, still)
 */
export function getMediaImageUrl(
  mediaType: 'movies' | 'shows' | 'episodes',
  mediaId: string,
  imageType: 'poster' | 'backdrop' | 'still',
  size: 'small' | 'medium' | 'large' = 'medium'
): string {
  return getApiUrl(`/api/images/${mediaType}/${mediaId}/${imageType}?size=${size}`);
}

/**
 * Get the URL for a logo image (network, studio)
 */
export function getLogoUrl(logoPath: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
  if (!logoPath) return '';
  const cleanPath = logoPath.startsWith('/') ? logoPath : `/${logoPath}`;
  return getApiUrl(`/api/images/logo${cleanPath}?size=${size}`);
}

