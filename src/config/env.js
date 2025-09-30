const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

/**
 * Validates and exports environment configuration
 */
class EnvConfig {
  constructor() {
    this.validateRequired();
  }

  validateRequired() {
    const required = [
      'HARVEST_BASE_URL',
      'HARVEST_ACCOUNT_ID',
      'HARVEST_TOKEN',
      'COMPANY_NAME',
      'COMPANY_STREET',
      'COMPANY_ZIP',
      'COMPANY_CITY',
      'COMPANY_COUNTRY',
      'COMPANY_IBAN',
      'COMPANY_QR_REFERENCE_TYPE',
      'COMPANY_CURRENCY',
      'COMPANY_EMAIL',
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate currency
    if (!['CHF', 'EUR'].includes(process.env.COMPANY_CURRENCY)) {
      throw new Error('COMPANY_CURRENCY must be CHF or EUR');
    }

    // Validate reference type
    if (!['QRR', 'SCOR', 'NON'].includes(process.env.COMPANY_QR_REFERENCE_TYPE)) {
      throw new Error('COMPANY_QR_REFERENCE_TYPE must be QRR, SCOR, or NON');
    }

    // Validate QRR reference requirements
    if (process.env.COMPANY_QR_REFERENCE_TYPE === 'QRR') {
      if (!process.env.COMPANY_QR_REFERENCE) {
        throw new Error('COMPANY_QR_REFERENCE is required when using QRR reference type');
      }
      if (!/^\d{27}$/.test(process.env.COMPANY_QR_REFERENCE)) {
        throw new Error('QRR reference must be exactly 27 digits');
      }
    }

    // Validate SCOR reference format
    if (process.env.COMPANY_QR_REFERENCE_TYPE === 'SCOR' && process.env.COMPANY_QR_REFERENCE) {
      if (!/^RF\d{2}[A-Za-z0-9]+$/.test(process.env.COMPANY_QR_REFERENCE)) {
        throw new Error(
          'SCOR reference must start with RF followed by 2 digits and alphanumeric characters'
        );
      }
    }
  }

  get harvest() {
    return {
      baseUrl: process.env.HARVEST_BASE_URL,
      accountId: process.env.HARVEST_ACCOUNT_ID,
      token: process.env.HARVEST_TOKEN,
    };
  }

  get company() {
    return {
      name: process.env.COMPANY_NAME,
      street: process.env.COMPANY_STREET,
      zip: process.env.COMPANY_ZIP,
      city: process.env.COMPANY_CITY,
      country: process.env.COMPANY_COUNTRY,
      iban: process.env.COMPANY_IBAN,
      qrReferenceType: process.env.COMPANY_QR_REFERENCE_TYPE,
      qrReference: process.env.COMPANY_QR_REFERENCE || '',
      currency: process.env.COMPANY_CURRENCY,
      email: process.env.COMPANY_EMAIL,
    };
  }

  get timezone() {
    return process.env.TIMEZONE || 'Europe/Zurich';
  }
}

module.exports = new EnvConfig();
