const { SwissQRBill } = require('swissqrbill/svg');
const { QRBillDTO } = require('./dto');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Swiss QR-bill generator
 */
class QRBillGenerator {
  /**
   * Build QRBillDTO from InvoiceDTO
   * @param {InvoiceDTO} invoice - Invoice data
   * @returns {QRBillDTO} QR-bill data
   */
  buildQRBillData(invoice) {
    logger.debug(`Building QR-bill data for invoice ${invoice.number}`);

    const qrBillData = new QRBillDTO({
      account: config.company.iban,
      creditor: invoice.creditor,
      debtor: invoice.debtor,
      amount: invoice.total,
      currency: invoice.currency,
      referenceType: config.company.qrReferenceType,
      reference: this.generateReference(invoice),
      additionalInfo: this.buildAdditionalInfo(invoice),
    });

    // Validate the QR-bill data
    qrBillData.validate();

    logger.debug(`QR-bill data validated for invoice ${invoice.number}`);
    return qrBillData;
  }

  /**
   * Generate reference number based on configuration and invoice
   * @param {InvoiceDTO} invoice - Invoice data
   * @returns {string} Reference number
   */
  generateReference(invoice) {
    const referenceType = config.company.qrReferenceType;

    if (referenceType === 'NON') {
      return '';
    }

    if (referenceType === 'SCOR') {
      // Use configured SCOR reference or generate one
      if (config.company.qrReference) {
        return config.company.qrReference;
      }

      // Generate SCOR reference with invoice number
      const invoiceNum = invoice.number.replace(/[^0-9]/g, '').padStart(8, '0');
      const checkDigits = this.calculateRF97CheckDigits(invoiceNum);
      return `RF${checkDigits}${invoiceNum}`;
    }

    if (referenceType === 'QRR') {
      // Use configured QRR reference or generate one
      if (config.company.qrReference) {
        return config.company.qrReference;
      }

      // Generate QRR reference with invoice number
      const invoiceNum = invoice.number.replace(/[^0-9]/g, '').padStart(20, '0');
      const checkDigits = this.calculateMod10CheckDigits(invoiceNum);
      return `${invoiceNum}${checkDigits}`;
    }

    return '';
  }

  /**
   * Calculate RF97 check digits for SCOR reference
   * @param {string} reference - Reference without check digits
   * @returns {string} Two-digit check digits
   */
  calculateRF97CheckDigits(reference) {
    // Move RF to the end and replace with 2715
    const rearranged = reference + '2715';

    // Calculate mod 97
    let remainder = 0;
    for (let i = 0; i < rearranged.length; i++) {
      remainder = (remainder * 10 + parseInt(rearranged[i], 10)) % 97;
    }

    const checkDigits = 98 - remainder;
    return checkDigits.toString().padStart(2, '0');
  }

  /**
   * Calculate modulo 10 check digits for QRR reference
   * @param {string} reference - Reference without check digits
   * @returns {string} Check digits
   */
  calculateMod10CheckDigits(reference) {
    const digits = reference.split('').map(Number);
    let carry = 0;

    const table = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

    for (const digit of digits) {
      carry = table[(carry + digit) % 10];
    }

    return ((10 - carry) % 10).toString();
  }

  /**
   * Build additional information for QR-bill
   * @param {InvoiceDTO} invoice - Invoice data
   * @returns {string} Additional information
   */
  buildAdditionalInfo(invoice) {
    const parts = [];

    if (invoice.number) {
      parts.push(`Rechnung ${invoice.number}`);
    }

    if (invoice.notes && invoice.notes.trim()) {
      parts.push(invoice.notes.trim());
    }

    return parts.join(' / ').substring(0, 140); // Max 140 characters
  }

  /**
   * Sanitize text for Swiss QR-bill compatibility
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  sanitizeText(text) {
    if (!text) return '';
    
    // Replace common German umlauts and special characters
    return text
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      // Remove other non-ASCII characters that might cause issues
      .replace(/[^\x00-\x7F]/g, '');
  }

  /**
   * Generate Swiss QR-bill SVG
   * @param {QRBillDTO} qrBillData - QR-bill data
   * @returns {string} SVG content
   */
  generateSVG(qrBillData) {
    logger.debug('Generating Swiss QR-bill SVG');

    try {
      // Map our DTO to swissqrbill v4 format
      const swissQRBillData = {
        currency: qrBillData.currency,
        amount: qrBillData.amount,
        creditor: {
          account: qrBillData.account.replace(/\s/g, ''), // Remove spaces from IBAN
          name: this.sanitizeText(qrBillData.creditor.name),
          address: this.sanitizeText(qrBillData.creditor.street),
          zip: qrBillData.creditor.zip,
          city: this.sanitizeText(qrBillData.creditor.city),
          country: qrBillData.creditor.country,
        },
        debtor: {
          name: this.sanitizeText(qrBillData.debtor.name),
          address: this.sanitizeText(qrBillData.debtor.street),
          zip: qrBillData.debtor.zip || '',
          city: this.sanitizeText(qrBillData.debtor.city),
          country: qrBillData.debtor.country,
        },
        additionalInformation: this.sanitizeText(qrBillData.additionalInfo?.replace(/\r\n/g, ' ').replace(/\n/g, ' ') || ''),
      };

      // Add reference only if it exists and is valid
      if (qrBillData.reference && qrBillData.reference.trim()) {
        swissQRBillData.reference = qrBillData.reference;
      }

      // Generate the QR-bill SVG
      const qrBill = new SwissQRBill(swissQRBillData);
      const svgContent = qrBill.toString();
      
      logger.debug('Successfully generated Swiss QR-bill SVG');
      return svgContent;
    } catch (error) {
      logger.error('Failed to generate QR-bill SVG:', error.message);
      throw new Error(`QR-bill generation failed: ${error.message}`);
    }
  }

  /**
   * Generate complete QR-bill from invoice
   * @param {InvoiceDTO} invoice - Invoice data
   * @returns {string} SVG content
   */
  generateFromInvoice(invoice) {
    const qrBillData = this.buildQRBillData(invoice);
    return this.generateSVG(qrBillData);
  }

  /**
   * Validate QR-IBAN format
   * @param {string} iban - IBAN to validate
   * @returns {boolean} True if valid QR-IBAN
   */
  isQRIBAN(iban) {
    // QR-IBAN has IID (Institution ID) between 30000-31999
    // Pattern: CH + 2 check digits + 3 (first digit of IID) + 0000-1999 (rest of IID range)
    const qrIbanPattern = /^CH\d{2}3[01]\d{3}\d{12}$/;
    if (!qrIbanPattern.test(iban)) {
      return false;
    }
    
    // Extract the IID (positions 4-8)
    const iid = parseInt(iban.substring(4, 9), 10);
    return iid >= 30000 && iid <= 31999;
  }

  /**
   * Validate IBAN format (basic check)
   * @param {string} iban - IBAN to validate
   * @returns {boolean} True if valid format
   */
  isValidIBAN(iban) {
    // Basic Swiss IBAN format check
    const ibanPattern = /^CH\d{19}$/;
    return ibanPattern.test(iban.replace(/\s/g, ''));
  }
}

module.exports = new QRBillGenerator();
