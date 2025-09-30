const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

const { AddressDTO, LineItemDTO, InvoiceDTO } = require('./dto');
const { roundCurrency, parseAmount } = require('./money');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Map Harvest invoice/estimate data to internal DTOs
 */
class DataMapper {
  /**
   * Map Harvest invoice to InvoiceDTO
   * @param {object} harvestInvoice - Harvest invoice data
   * @param {object} harvestClient - Harvest client data
   * @returns {InvoiceDTO} Mapped invoice
   */
  mapInvoiceFromHarvest(harvestInvoice, harvestClient) {
    logger.debug('Mapping Harvest invoice to InvoiceDTO');

    const creditor = this.mapCompanyToAddress();
    const debtor = this.mapClientToAddress(harvestClient);
    const items = this.mapLineItems(harvestInvoice.line_items || []);

    const invoice = new InvoiceDTO({
      number: harvestInvoice.number,
      issueDate: this.parseDate(harvestInvoice.issue_date),
      dueDate: this.parseDate(harvestInvoice.due_date),
      creditor,
      debtor,
      items,
      subtotal: roundCurrency(parseAmount(harvestInvoice.amount) - parseAmount(harvestInvoice.tax_amount || 0)),
      taxTotal: roundCurrency(parseAmount(harvestInvoice.tax_amount || 0)),
      total: roundCurrency(parseAmount(harvestInvoice.amount)),
      currency: harvestInvoice.currency || config.company.currency,
      notes: harvestInvoice.notes || '',
    });

    // Don't recalculate totals - use the values from Harvest as they include proper tax calculation
    // invoice.calculateTotals();

    logger.debug(`Mapped invoice ${invoice.number} with ${items.length} items`);
    return invoice;
  }

  /**
   * Map Harvest estimate to InvoiceDTO
   * @param {object} harvestEstimate - Harvest estimate data
   * @param {object} harvestClient - Harvest client data
   * @returns {InvoiceDTO} Mapped estimate as invoice
   */
  mapEstimateFromHarvest(harvestEstimate, harvestClient) {
    logger.debug('Mapping Harvest estimate to InvoiceDTO');

    const creditor = this.mapCompanyToAddress();
    const debtor = this.mapClientToAddress(harvestClient);
    const items = this.mapLineItems(harvestEstimate.line_items || []);

    const invoice = new InvoiceDTO({
      number: harvestEstimate.number,
      issueDate: this.parseDate(harvestEstimate.issue_date),
      dueDate: null, // Estimates typically don't have due dates
      creditor,
      debtor,
      items,
      subtotal: roundCurrency(parseAmount(harvestEstimate.amount) - parseAmount(harvestEstimate.tax_amount || 0)),
      taxTotal: roundCurrency(parseAmount(harvestEstimate.tax_amount || 0)),
      total: roundCurrency(parseAmount(harvestEstimate.amount)),
      currency: harvestEstimate.currency || config.company.currency,
      notes: harvestEstimate.notes || '',
    });

    // Don't recalculate totals - use the values from Harvest as they include proper tax calculation
    // invoice.calculateTotals();

    logger.debug(`Mapped estimate ${invoice.number} with ${items.length} items`);
    return invoice;
  }

  /**
   * Map company configuration to AddressDTO
   * @returns {AddressDTO} Company address
   */
  mapCompanyToAddress() {
    return new AddressDTO({
      name: config.company.name,
      street: config.company.street,
      zip: config.company.zip,
      city: config.company.city,
      country: config.company.country,
    });
  }

  /**
   * Map Harvest client to AddressDTO
   * @param {object} harvestClient - Harvest client data
   * @returns {AddressDTO} Client address
   */
  mapClientToAddress(harvestClient) {
    // Parse address - Harvest sometimes puts everything in the address field
    let street = harvestClient.address || '';
    let zip = harvestClient.postal_code || '';
    let city = harvestClient.city || '';

    // If address contains line breaks, try to parse it
    if (street.includes('\r\n') || street.includes('\n')) {
      const lines = street.split(/\r?\n/);
      if (lines.length >= 2) {
        street = lines[0].trim();
        const lastLine = lines[lines.length - 1].trim();
        
        // Try to extract zip and city from last line (format: "8004 Zürich")
        const zipCityMatch = lastLine.match(/^(\d{4,5})\s+(.+)$/);
        if (zipCityMatch) {
          zip = zipCityMatch[1];
          city = zipCityMatch[2];
        }
      }
    }

    return new AddressDTO({
      name: harvestClient.name,
      street: street,
      zip: zip,
      city: city,
      country: harvestClient.country || 'CH',
    });
  }

  /**
   * Map Harvest line items to LineItemDTO array
   * @param {Array} harvestLineItems - Harvest line items
   * @returns {LineItemDTO[]} Mapped line items
   */
  mapLineItems(harvestLineItems) {
    return harvestLineItems.map(item => {
      const quantity = parseFloat(item.quantity) || 1;
      const unitPrice = parseAmount(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_percentage) || 0;

      return new LineItemDTO({
        description: item.description || item.kind || 'Service',
        quantity,
        unitPrice: roundCurrency(unitPrice),
        taxRate,
        total: roundCurrency(parseAmount(item.amount) || quantity * unitPrice),
      });
    });
  }

  /**
   * Parse date string to dayjs object
   * @param {string} dateString - Date string from Harvest
   * @returns {dayjs.Dayjs|null} Parsed date or null
   */
  parseDate(dateString) {
    if (!dateString) {
      return null;
    }

    try {
      return dayjs(dateString).tz(config.timezone);
    } catch (error) {
      logger.warn(`Failed to parse date: ${dateString}`);
      return null;
    }
  }

  /**
   * Format date for display
   * @param {dayjs.Dayjs|null} date - Date to format
   * @param {string} format - Date format (default: DD.MM.YYYY)
   * @returns {string} Formatted date or empty string
   */
  formatDate(date, format = 'DD.MM.YYYY') {
    if (!date) {
      return '';
    }
    return date.format(format);
  }
}

module.exports = new DataMapper();
