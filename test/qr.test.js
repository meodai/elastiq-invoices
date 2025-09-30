const { QRBillDTO } = require('../src/domain/dto');
const qrGenerator = require('../src/domain/qr');

describe('QR-bill Generator', () => {
  describe('QRBillDTO validation', () => {
    const validQRData = {
      account: 'CH4431999123000889012',
      creditor: {
        name: 'Test Company GmbH',
        street: 'Teststrasse 1',
        zip: '8001',
        city: 'Zürich',
        country: 'CH',
      },
      debtor: {
        name: 'Test Customer',
        street: 'Kundenstrasse 2',
        zip: '8002',
        city: 'Zürich',
        country: 'CH',
      },
      amount: 1234.56,
      currency: 'CHF',
      referenceType: 'SCOR',
      reference: 'RF18539007547034',
      additionalInfo: 'Test invoice',
    };

    test('should validate valid QR-bill data', () => {
      const qrBill = new QRBillDTO(validQRData);
      expect(() => qrBill.validate()).not.toThrow();
    });

    test('should reject invalid currency', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        currency: 'USD',
      });
      expect(() => qrBill.validate()).toThrow('Currency must be CHF or EUR');
    });

    test('should reject invalid reference type', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        referenceType: 'INVALID',
      });
      expect(() => qrBill.validate()).toThrow('Reference type must be QRR, SCOR, or NON');
    });

    test('should require QR-IBAN for QRR reference type', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        account: 'CH4432000123000889012', // Regular IBAN (IID 32000)
        referenceType: 'QRR',
        reference: '123456789012345678901234567',
      });
      expect(() => qrBill.validate()).toThrow('QRR reference type requires a QR-IBAN');
    });

    test('should accept QR-IBAN for QRR reference type', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        account: 'CH4431000123456789012', // QR-IBAN (IID 31000)
        referenceType: 'QRR',
        reference: '123456789012345678901234567',
      });
      expect(() => qrBill.validate()).not.toThrow();
    });

    test('should validate QRR reference format', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        account: 'CH4431000123456789012',
        referenceType: 'QRR',
        reference: '12345', // Too short
      });
      expect(() => qrBill.validate()).toThrow('QRR reference must be exactly 27 digits');
    });

    test('should validate SCOR reference format', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        referenceType: 'SCOR',
        reference: 'INVALID123', // Wrong format
      });
      expect(() => qrBill.validate()).toThrow('SCOR reference must start with RF');
    });

    test('should validate amount range', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        amount: 0, // Too low
      });
      expect(() => qrBill.validate()).toThrow('Amount must be between 0.01 and 999,999,999.99');
    });

    test('should accept valid amount range', () => {
      const qrBill = new QRBillDTO({
        ...validQRData,
        amount: 999999999.99,
      });
      expect(() => qrBill.validate()).not.toThrow();
    });
  });

  describe('Reference generation', () => {
    test('should generate valid modulo 10 check digits for QRR', () => {
      const reference = '12345678901234567890123456';
      const checkDigit = qrGenerator.calculateMod10CheckDigits(reference);
      expect(checkDigit).toMatch(/^\d$/);
    });

    test('should generate valid RF97 check digits for SCOR', () => {
      const reference = '12345678';
      const checkDigits = qrGenerator.calculateRF97CheckDigits(reference);
      expect(checkDigits).toMatch(/^\d{2}$/);
      expect(parseInt(checkDigits, 10)).toBeGreaterThanOrEqual(1);
      expect(parseInt(checkDigits, 10)).toBeLessThanOrEqual(98);
    });
  });

  describe('IBAN validation', () => {
    test('should identify QR-IBAN correctly', () => {
      expect(qrGenerator.isQRIBAN('CH4431000123456789012')).toBe(true); // IID 31000
      expect(qrGenerator.isQRIBAN('CH4432000123456789012')).toBe(false); // IID 32000 (outside range)
      expect(qrGenerator.isQRIBAN('CH4430000123456789012')).toBe(true); // IID 30000
    });

    test('should validate Swiss IBAN format', () => {
      expect(qrGenerator.isValidIBAN('CH4431999123000889012')).toBe(true);
      expect(qrGenerator.isValidIBAN('CH44 3199 9123 0008 8901 2')).toBe(true);
      expect(qrGenerator.isValidIBAN('DE89370400440532013000')).toBe(false);
      expect(qrGenerator.isValidIBAN('INVALID')).toBe(false);
    });
  });
});
