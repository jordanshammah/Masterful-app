/**
 * OAuth Redirect URL Utility
 * Handles OAuth redirect URLs for both desktop and mobile devices
 *
 * On mobile devices, localhost is not accessible, so we need to use
 * the actual network IP address or the current origin.
 */

/**
 * Get the OAuth redirect URL that works on both desktop and mobile
 * @param callbackPath - The callback path (e.g., '/auth/callback')
 * @param queryParams - Optional query parameters to append
 * @returns The full redirect URL
 */
export function getOAuthRedirectUrl(
  callbackPath: string = '/auth/callback',
  queryParams?: Record<string, string | boolean>
): string {
  // Get the current origin (this will be the network IP if accessed from mobile)
  let origin = window.location.origin;
  
  // Check if we're in development and using localhost
  const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
  
  // If using localhost and we have an environment variable override, use it
  // This is useful for development when you want to specify the network IP
  const envRedirectUrl = import.meta.env.VITE_OAUTH_REDIRECT_URL;
  if (isLocalhost && envRedirectUrl) {
    origin = envRedirectUrl;
  }
  
  // Build the callback URL
  let callbackUrl = `${origin}${callbackPath}`;
  
  // Add query parameters if provided
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      params.append(key, String(value));
    });
    callbackUrl += `?${params.toString()}`;
  }
  
  return callbackUrl;
}

/**
 * Check if the current environment is likely a mobile device
 * This is a heuristic based on user agent and screen size
 */
export function isLikelyMobileDevice(): boolean {
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  const isMobileUA = mobileRegex.test(userAgent);
  
  // Check screen size (mobile devices typically have smaller screens)
  const isSmallScreen = window.innerWidth < 768 || window.innerHeight < 768;
  
  // Check if touch is available (most mobile devices have touch)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  return isMobileUA || (isSmallScreen && hasTouch);
}

/**
 * Get the network IP address from the current location
 * This extracts the IP from window.location.hostname if it's not localhost
 */
export function getNetworkIP(): string | null {
  const hostname = window.location.hostname;
  
  // If it's already an IP address (not localhost), return it
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    // Check if it looks like an IP address (IPv4 or IPv6)
    const ipv4Regex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;
    
    if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
      return hostname;
    }
    
    // If it's a domain name, return it as-is (might be a production URL)
    return hostname;
  }
  
  return null;
}





