/**
 * Data Transfer Objects for invoice processing
 */

/**
 * Address information
 */
class AddressDTO {
  constructor({ name, street, zip, city, country }) {
    this.name = name;
    this.street = street;
    this.zip = zip;
    this.city = city;
    this.country = country;
  }

  /**
   * Format address for display
   * @returns {string} Formatted address
   */
  format() {
    return `${this.name}\n${this.street}\n${this.zip} ${this.city}\n${this.country}`;
  }

  /**
   * Get address as single line
   * @returns {string} Single line address
   */
  formatSingleLine() {
    return `${this.name}, ${this.street}, ${this.zip} ${this.city}, ${this.country}`;
  }
}

/**
 * Line item on an invoice
 */
class LineItemDTO {
  constructor({ description, quantity, unitPrice, taxRate = 0, total }) {
    this.description = description;
    this.quantity = parseFloat(quantity) || 0;
    this.unitPrice = parseFloat(unitPrice) || 0;
    this.taxRate = parseFloat(taxRate) || 0;
    this.total = parseFloat(total) || this.quantity * this.unitPrice;
  }

  /**
   * Calculate line total before tax
   * @returns {number} Line total
   */
  getSubtotal() {
    return this.quantity * this.unitPrice;
  }

  /**
   * Calculate tax amount
   * @returns {number} Tax amount
   */
  getTaxAmount() {
    return this.getSubtotal() * (this.taxRate / 100);
  }

  /**
   * Calculate total including tax
   * @returns {number} Total with tax
   */
  getTotalWithTax() {
    return this.getSubtotal() + this.getTaxAmount();
  }
}

/**
 * Complete invoice data
 */
class InvoiceDTO {
  constructor({
    number,
    issueDate,
    dueDate,
    creditor,
    debtor,
    items = [],
    subtotal,
    taxTotal,
    total,
    currency,
    notes,
  }) {
    this.number = number;
    this.issueDate = issueDate;
    this.dueDate = dueDate;
    this.creditor = creditor instanceof AddressDTO ? creditor : new AddressDTO(creditor);
    this.debtor = debtor instanceof AddressDTO ? debtor : new AddressDTO(debtor);
    this.items = items.map(item => (item instanceof LineItemDTO ? item : new LineItemDTO(item)));
    this.subtotal = parseFloat(subtotal) || 0;
    this.taxTotal = parseFloat(taxTotal) || 0;
    this.total = parseFloat(total) || 0;
    this.currency = currency;
    this.notes = notes || '';
  }

  /**
   * Calculate totals from line items
   */
  calculateTotals() {
    this.subtotal = this.items.reduce((sum, item) => sum + item.getSubtotal(), 0);
    this.taxTotal = this.items.reduce((sum, item) => sum + item.getTaxAmount(), 0);
    this.total = this.subtotal + this.taxTotal;
  }

  /**
   * Get formatted currency amount
   * @param {number} amount - Amount to format
   * @returns {string} Formatted amount
   */
  formatAmount(amount) {
    return `${this.currency} ${amount.toFixed(2)}`;
  }

  /**
   * Get invoice type (invoice or estimate)
   * @returns {string} Document type
   */
  getType() {
    return this.number?.startsWith('E') ? 'estimate' : 'invoice';
  }
}

/**
 * Swiss QR-bill specific data
 */
class QRBillDTO {
  constructor({
    account,
    creditor,
    debtor,
    amount,
    currency,
    referenceType,
    reference,
    additionalInfo,
  }) {
    this.account = account;
    this.creditor = creditor instanceof AddressDTO ? creditor : new AddressDTO(creditor);
    this.debtor = debtor instanceof AddressDTO ? debtor : new AddressDTO(debtor);
    this.amount = parseFloat(amount) || 0;
    this.currency = currency;
    this.referenceType = referenceType; // QRR, SCOR, NON
    this.reference = reference || '';
    this.additionalInfo = additionalInfo || '';
  }

  /**
   * Validate QR-bill data
   * @throws {Error} If validation fails
   */
  validate() {
    if (!this.account) {
      throw new Error('Account (IBAN) is required');
    }

    if (!['CHF', 'EUR'].includes(this.currency)) {
      throw new Error('Currency must be CHF or EUR');
    }

    if (!['QRR', 'SCOR', 'NON'].includes(this.referenceType)) {
      throw new Error('Reference type must be QRR, SCOR, or NON');
    }

    // QR-IBAN validation for QRR
    if (this.referenceType === 'QRR') {
      // Check if it's a valid QR-IBAN (IID 30000-31999)
      const qrIbanPattern = /^CH\d{2}3[01]\d{3}\d{12}$/;
      if (!qrIbanPattern.test(this.account)) {
        throw new Error('QRR reference type requires a QR-IBAN (IID 30000-31999)');
      }
      
      // Extract and validate the IID range
      const iid = parseInt(this.account.substring(4, 9), 10);
      if (iid < 30000 || iid > 31999) {
        throw new Error('QRR reference type requires a QR-IBAN (IID 30000-31999)');
      }

      if (!this.reference || !/^\d{27}$/.test(this.reference)) {
        throw new Error('QRR reference must be exactly 27 digits');
      }
    }

    // SCOR reference validation
    if (this.referenceType === 'SCOR' && this.reference) {
      if (!/^RF\d{2}[A-Za-z0-9]+$/.test(this.reference)) {
        throw new Error(
          'SCOR reference must start with RF followed by 2 digits and alphanumeric characters'
        );
      }
    }

    if (this.amount < 0.01 || this.amount > 999999999.99) {
      throw new Error('Amount must be between 0.01 and 999,999,999.99');
    }
  }
}

module.exports = {
  AddressDTO,
  LineItemDTO,
  InvoiceDTO,
  QRBillDTO,
};
