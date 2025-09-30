const {
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
} = require('../src/domain/money');

describe('Money utilities', () => {
  describe('roundCurrency', () => {
    test('should round to 2 decimal places', () => {
      expect(roundCurrency(123.456)).toBe(123.46);
      expect(roundCurrency(123.454)).toBe(123.45);
      expect(roundCurrency(123.455)).toBe(123.46); // Banker's rounding
    });

    test('should handle edge cases', () => {
      expect(roundCurrency(0)).toBe(0);
      expect(roundCurrency(0.001)).toBe(0);
      expect(roundCurrency(0.005)).toBe(0.01);
    });
  });

  describe('roundSwissCash', () => {
    test('should round to nearest 0.05', () => {
      expect(roundSwissCash(1.23)).toBe(1.25);
      expect(roundSwissCash(1.22)).toBe(1.2);
      expect(roundSwissCash(1.225)).toBe(1.25);
    });

    test('should handle exact values', () => {
      expect(roundSwissCash(1.25)).toBe(1.25);
      expect(roundSwissCash(1.0)).toBe(1.0);
    });
  });

  describe('formatCurrency', () => {
    test('should format CHF correctly', () => {
      const formatted = formatCurrency(1234.56, 'CHF', 'de-CH');
      expect(formatted).toContain('CHF');
      expect(formatted).toContain('234.56'); // Check for the decimal part
    });

    test('should format EUR correctly', () => {
      const formatted = formatCurrency(1234.56, 'EUR', 'de-CH');
      expect(formatted).toContain('EUR');
      expect(formatted).toContain('234.56'); // Check for the decimal part
    });

    test('should use default values', () => {
      const formatted = formatCurrency(100);
      expect(formatted).toContain('100.00');
    });
  });

  describe('calculatePercentage', () => {
    test('should calculate percentage correctly', () => {
      expect(calculatePercentage(100, 7.7)).toBe(7.7);
      expect(calculatePercentage(1000, 8.1)).toBe(81.0);
      expect(calculatePercentage(123.45, 19)).toBe(23.46);
    });

    test('should handle zero percentage', () => {
      expect(calculatePercentage(100, 0)).toBe(0);
    });
  });

  describe('calculateTax', () => {
    test('should calculate Swiss VAT correctly', () => {
      expect(calculateTax(100, 7.7)).toBe(7.7);
      expect(calculateTax(1000, 8.1)).toBe(81.0);
    });
  });

  describe('calculateGross', () => {
    test('should calculate gross amount from net', () => {
      expect(calculateGross(100, 7.7)).toBe(107.7);
      expect(calculateGross(1000, 8.1)).toBe(1081.0);
    });
  });

  describe('calculateNet', () => {
    test('should calculate net amount from gross', () => {
      expect(calculateNet(107.7, 7.7)).toBe(100.0);
      expect(calculateNet(1081.0, 8.1)).toBe(1000.0);
    });

    test('should handle rounding in reverse calculation', () => {
      const gross = 123.45;
      const taxRate = 7.7;
      const net = calculateNet(gross, taxRate);
      const backToGross = calculateGross(net, taxRate);
      expect(Math.abs(backToGross - gross)).toBeLessThan(0.01);
    });
  });

  describe('sumAmounts', () => {
    test('should sum amounts with proper rounding', () => {
      expect(sumAmounts([1.11, 2.22, 3.33])).toBe(6.66);
      expect(sumAmounts([0.1, 0.2, 0.3])).toBe(0.6);
    });

    test('should handle empty array', () => {
      expect(sumAmounts([])).toBe(0);
    });

    test('should handle single amount', () => {
      expect(sumAmounts([123.45])).toBe(123.45);
    });
  });

  describe('isValidCurrency', () => {
    test('should validate supported currencies', () => {
      expect(isValidCurrency('CHF')).toBe(true);
      expect(isValidCurrency('EUR')).toBe(true);
      expect(isValidCurrency('USD')).toBe(false);
      expect(isValidCurrency('GBP')).toBe(false);
      expect(isValidCurrency('')).toBe(false);
    });
  });

  describe('getCurrencySymbol', () => {
    test('should return correct symbols', () => {
      expect(getCurrencySymbol('CHF')).toBe('CHF');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('USD')).toBe('USD');
    });
  });

  describe('parseAmount', () => {
    test('should parse numeric values', () => {
      expect(parseAmount(123.45)).toBe(123.45);
      expect(parseAmount(0)).toBe(0);
    });

    test('should parse string values', () => {
      expect(parseAmount('123.45')).toBe(123.45);
      expect(parseAmount('123,45')).toBe(123.45);
      expect(parseAmount('CHF 123.45')).toBe(123.45);
      expect(parseAmount('€ 123,45')).toBe(123.45);
    });

    test('should handle invalid values', () => {
      expect(parseAmount('')).toBe(0);
      expect(parseAmount('invalid')).toBe(0);
      expect(parseAmount(null)).toBe(0);
      expect(parseAmount(undefined)).toBe(0);
    });

    test('should clean currency symbols and spaces', () => {
      expect(parseAmount('CHF 1,234.56')).toBe(1234.56);
      expect(parseAmount('€ 1 234,56')).toBe(1234.56);
      expect(parseAmount("1'234.56 CHF")).toBe(1234.56);
    });
  });
});
