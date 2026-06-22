'use strict'

/**
 * Returns true when hostname is localhost or a loopback address.
 * @param {string} hostname
 * @returns {boolean}
 */
function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

/**
 * Returns true when value is a permitted app URL:
 * - Any valid https: URL
 * - An http: URL whose hostname is localhost or loopback
 * @param {string} value
 * @returns {boolean}
 */
function isValidAppUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') {
      return true
    }
    if (url.protocol === 'http:') {
      return isLocalHost(url.hostname)
    }
    return false
  } catch {
    return false
  }
}

/**
 * Returns true when external URL may be opened in the system browser.
 * HTTPS and mailto are always allowed. HTTP is only allowed for localhost/loopback.
 * @param {string} value
 * @returns {boolean}
 */
function canOpenExternalUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'mailto:') {
      return true
    }
    return url.protocol === 'http:' && isLocalHost(url.hostname)
  } catch {
    return false
  }
}

module.exports = { isLocalHost, isValidAppUrl, canOpenExternalUrl }
