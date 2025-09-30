const client = require('./client');
const logger = require('../utils/logger');

/**
 * Harvest invoice and estimate operations
 */
class HarvestInvoices {
  /**
   * Fetch invoice by ID
   * @param {string|number} id - Invoice ID
   * @returns {Promise<object>} Invoice data with line items
   */
  async getInvoice(id) {
    logger.info(`Fetching invoice ${id}...`);

    try {
      const invoice = await client.get(`/invoices/${id}`);

      if (!invoice) {
        throw new Error(`Invoice ${id} not found`);
      }

      logger.info(`Successfully fetched invoice ${invoice.number}`);
      return invoice;
    } catch (error) {
      logger.error(`Failed to fetch invoice ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch estimate by ID
   * @param {string|number} id - Estimate ID
   * @returns {Promise<object>} Estimate data with line items
   */
  async getEstimate(id) {
    logger.info(`Fetching estimate ${id}...`);

    try {
      const estimate = await client.get(`/estimates/${id}`);

      if (!estimate) {
        throw new Error(`Estimate ${id} not found`);
      }

      logger.info(`Successfully fetched estimate ${estimate.number}`);
      return estimate;
    } catch (error) {
      logger.error(`Failed to fetch estimate ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch client by ID
   * @param {string|number} id - Client ID
   * @returns {Promise<object>} Client data with address information
   */
  async getClient(id) {
    logger.info(`Fetching client ${id}...`);

    try {
      const clientData = await client.get(`/clients/${id}`);

      if (!clientData) {
        throw new Error(`Client ${id} not found`);
      }

      logger.info(`Successfully fetched client ${clientData.name}`);
      return clientData;
    } catch (error) {
      logger.error(`Failed to fetch client ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Get invoice with related client data
   * @param {string|number} id - Invoice ID
   * @returns {Promise<{invoice: object, client: object}>} Invoice and client data
   */
  async getInvoiceWithClient(id) {
    const invoice = await this.getInvoice(id);
    const clientData = await this.getClient(invoice.client.id);

    return { invoice, client: clientData };
  }

  /**
   * Get estimate with related client data
   * @param {string|number} id - Estimate ID
   * @returns {Promise<{estimate: object, client: object}>} Estimate and client data
   */
  async getEstimateWithClient(id) {
    const estimate = await this.getEstimate(id);
    const clientData = await this.getClient(estimate.client.id);

    return { estimate, client: clientData };
  }
}

module.exports = new HarvestInvoices();
