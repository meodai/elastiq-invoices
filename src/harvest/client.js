const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Harvest API client with authentication and rate limiting
 */
class HarvestClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.harvest.baseUrl,
      headers: {
        'Harvest-Account-Id': config.harvest.accountId,
        Authorization: `Bearer ${config.harvest.token}`,
        'User-Agent': 'custom-swissqr-invoicer',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor for logging
    this.client.interceptors.request.use(
      requestConfig => {
        logger.debug(
          `Making request to: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`
        );
        return requestConfig;
      },
      error => {
        logger.error('Request error:', error.message);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling and rate limiting
    this.client.interceptors.response.use(
      response => {
        logger.debug(`Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      async error => {
        if (error.response?.status === 429) {
          // Rate limit exceeded - wait and retry
          const retryAfter = parseInt(error.response.headers['retry-after'], 10) || 60;
          logger.warn(`Rate limit exceeded. Retrying after ${retryAfter} seconds...`);

          await this.sleep(retryAfter * 1000);
          return this.client.request(error.config);
        }

        if (error.response?.status === 401) {
          logger.error('Authentication failed. Check your Harvest token and account ID.');
        }

        logger.error(`API error: ${error.response?.status} ${error.response?.statusText}`);
        return Promise.reject(error);
      }
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a GET request to the Harvest API
   * @param {string} path - API endpoint path
   * @param {object} params - Query parameters
   * @returns {Promise<any>} API response data
   */
  async get(path, params = {}) {
    try {
      const response = await this.client.get(path, { params });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Make a POST request to the Harvest API
   * @param {string} path - API endpoint path
   * @param {object} data - Request body
   * @returns {Promise<any>} API response data
   */
  async post(path, data = {}) {
    try {
      const response = await this.client.post(path, data);
      return response.data;
    } catch (error) {
      logger.error(`Failed to post to ${path}:`, error.message);
      throw error;
    }
  }
}

module.exports = new HarvestClient();
