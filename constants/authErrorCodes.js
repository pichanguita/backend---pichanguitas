/**
 * Códigos de error de autenticación.
 *
 * Contrato estable entre backend y frontend: el frontend reacciona a estos
 * códigos (no a los textos de los mensajes, que pueden cambiar o traducirse).
 * El espejo en el frontend vive en src/config/authErrorCodes.js.
 */
const AUTH_ERROR_CODES = {
  TOKEN_MISSING: 'AUTH_TOKEN_MISSING', // No se envió el header Authorization
  TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED', // El JWT venció (exp superado)
  TOKEN_INVALID: 'AUTH_TOKEN_INVALID', // El JWT es ilegible / firma inválida
};

module.exports = { AUTH_ERROR_CODES };
