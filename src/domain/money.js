/**
 * Money and rounding utilities for CHF/EUR calculations
 */

/**
 * Round amount to 2 decimal places (standard for CHF/EUR)
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
function roundCurrency(amount) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Round amount to nearest 0.05 (Swiss rounding for cash payments)
 * @param {number} amount - Amount to round
 * @returns {number} Rounded amount
 */
function roundSwissCash(amount) {
  return Math.round(amount * 20) / 20;
}

/**
 * Format currency amount with proper locale
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (CHF or EUR)
 * @param {string} locale - Locale for formatting (default: de-CH)
 * @returns {string} Formatted amount
 */
function formatCurrency(amount, currency = 'CHF', locale = 'de-CH') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Calculate percentage of amount
 * @param {number} amount - Base amount
 * @param {number} percentage - Percentage (e.g., 7.7 for 7.7%)
 * @returns {number} Calculated percentage amount
 */
function calculatePercentage(amount, percentage) {
  return roundCurrency(amount * (percentage / 100));
}

/**
 * Calculate tax amount
 * @param {number} netAmount - Net amount before tax
 * @param {number} taxRate - Tax rate percentage
 * @returns {number} Tax amount
 */
function calculateTax(netAmount, taxRate) {
  return calculatePercentage(netAmount, taxRate);
}

/**
 * Calculate gross amount from net amount and tax rate
 * @param {number} netAmount - Net amount before tax
 * @param {number} taxRate - Tax rate percentage
 * @returns {number} Gross amount including tax
 */
function calculateGross(netAmount, taxRate) {
  return roundCurrency(netAmount + calculateTax(netAmount, taxRate));
}

/**
 * Calculate net amount from gross amount and tax rate
 * @param {number} grossAmount - Gross amount including tax
 * @param {number} taxRate - Tax rate percentage
 * @returns {number} Net amount before tax
 */
function calculateNet(grossAmount, taxRate) {
  return roundCurrency(grossAmount / (1 + taxRate / 100));
}

/**
 * Sum array of amounts with proper rounding
 * @param {number[]} amounts - Array of amounts to sum
 * @returns {number} Rounded sum
 */
function sumAmounts(amounts) {
  const sum = amounts.reduce((total, amount) => total + amount, 0);
  return roundCurrency(sum);
}

/**
 * Validate currency code
 * @param {string} currency - Currency code to validate
 * @returns {boolean} True if valid
 */
function isValidCurrency(currency) {
  return ['CHF', 'EUR'].includes(currency);
}

/**
 * Get currency symbol
 * @param {string} currency - Currency code
 * @returns {string} Currency symbol
 */
function getCurrencySymbol(currency) {
  const symbols = {
    CHF: 'CHF',
    EUR: '€',
  };
  return symbols[currency] || currency;
}

/**
 * Parse amount from string, handling various formats
 * @param {string|number} value - Value to parse
 * @returns {number} Parsed amount
 */
function parseAmount(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    // Remove currency symbols and spaces, but keep numbers, dots, commas, and apostrophes
    let cleaned = value.replace(/[^\d.,''-]/g, '');
    
    // Handle Swiss/European number formatting
    // If there are multiple dots and commas, assume the last one is decimal separator
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    
    if (lastDot > lastComma) {
      // Dot is decimal separator, remove commas and apostrophes
      cleaned = cleaned.replace(/[,']/g, '');
    } else if (lastComma > lastDot) {
      // Comma is decimal separator, remove dots and apostrophes, then replace comma with dot
      cleaned = cleaned.replace(/[.']/g, '').replace(',', '.');
    } else {
      // No decimal separator or only one type, remove apostrophes
      cleaned = cleaned.replace(/'/g, '');
    }
    
    return parseFloat(cleaned) || 0;
  }

  return 0;
}

module.exports = {
  roundCurrency,
  roundSwissCash,
  formatCurrency,
  calculatePercentage,
  calculateTax,
  calculateGross,
  calculateNet,
  sumAmounts,
  isValidCurrency,
  getCurrencySymbol,
  parseAmount,
};
