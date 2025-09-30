#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const config = require('../config/env');
const harvestInvoices = require('../harvest/invoices');
const dataMapper = require('../domain/mapping');
const renderer = require('../render/render');
const logger = require('../utils/logger');

/**
 * CLI for generating Swiss QR invoices from Harvest data
 */
class InvoiceCLI {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'out');
  }

  /**
   * Parse command line arguments
   * @param {string[]} args - Command line arguments
   * @returns {object} Parsed arguments
   */
  parseArgs(args) {
    const parsed = {
      id: null,
      type: 'invoice',
      help: false,
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg === '--help' || arg === '-h') {
        parsed.help = true;
      } else if (arg === '--id') {
        parsed.id = args[++i];
      } else if (arg === '--type') {
        const type = args[++i];
        if (['invoice', 'estimate'].includes(type)) {
          parsed.type = type;
        } else {
          throw new Error(`Invalid type: ${type}. Must be 'invoice' or 'estimate'`);
        }
      }
    }

    return parsed;
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
Swiss QR Invoice Generator

Usage:
  node src/cli/generate-invoice.js [--id <ID>] [--type <TYPE>]
  
Options:
  --id <ID>       Harvest invoice or estimate ID (optional - uses most recent if not provided)
  --type <TYPE>   Document type: 'invoice' or 'estimate' (default: invoice)
  --help, -h      Show this help message

Examples:
  node src/cli/generate-invoice.js                              # Generate PDF for most recent invoice
  node src/cli/generate-invoice.js --type estimate              # Generate PDF for most recent estimate
  node src/cli/generate-invoice.js --id 12345                   # Generate PDF for specific invoice
  node src/cli/generate-invoice.js --id 12345 --type invoice    # Generate PDF for specific invoice
  node src/cli/generate-invoice.js --id 67890 --type estimate   # Generate PDF for specific estimate

Environment:
  Make sure to copy .env.example to .env and configure your Harvest API credentials
  and company information before running the generator.

Output:
  Generated PDFs will be saved to the ./out/ directory.
`);
  }

  /**
   * Generate invoice PDF
   * @param {string|null} id - Invoice/estimate ID (optional - will fetch latest if not provided)
   * @param {string} type - Document type (invoice or estimate)
   */
  async generateInvoice(id, type) {
    try {
      if (id) {
        logger.info(`Starting ${type} generation for ID: ${id}`);
      } else {
        logger.info(`Starting ${type} generation for most recent ${type}`);
      }

      // Fetch data from Harvest
      let harvestData, harvestClient;
      if (type === 'invoice' && id) {
        const result = await harvestInvoices.getInvoiceWithClient(id);
        harvestData = result.invoice;
        harvestClient = result.client;
      } else if (type === 'invoice' && !id) {
        const result = await harvestInvoices.getLatestInvoiceWithClient();
        harvestData = result.invoice;
        harvestClient = result.client;
        logger.info(`Using most recent invoice ID: ${harvestData.id}`);
      } else if (type === 'estimate' && id) {
        const result = await harvestInvoices.getEstimateWithClient(id);
        harvestData = result.estimate;
        harvestClient = result.client;
      } else if (type === 'estimate' && !id) {
        const result = await harvestInvoices.getLatestEstimateWithClient();
        harvestData = result.estimate;
        harvestClient = result.client;
        logger.info(`Using most recent estimate ID: ${harvestData.id}`);
      }

      logger.info(`Successfully fetched ${type} ${harvestData.number}`);

      // Map to internal DTO
      let invoice;
      if (type === 'invoice') {
        invoice = dataMapper.mapInvoiceFromHarvest(harvestData, harvestClient);
      } else {
        invoice = dataMapper.mapEstimateFromHarvest(harvestData, harvestClient);
      }

      logger.info(`Mapped ${type} data successfully`);

      // Ensure output directory exists
      await this.ensureOutputDir();

      // Generate output filename
      const filename = this.generateFilename(invoice, type);
      const outputPath = path.join(this.outputDir, filename);

      // Render to PDF
      await renderer.renderToPDF(invoice, outputPath);

      logger.info(`✅ Successfully generated ${type} PDF: ${outputPath}`);
      console.log(
        `\n🎉 ${type.charAt(0).toUpperCase() + type.slice(1)} PDF generated successfully!`
      );
      console.log(`📄 File: ${outputPath}`);
      console.log(`💰 Total: ${invoice.currency} ${invoice.total.toFixed(2)}`);

      return outputPath;
    } catch (error) {
      logger.error(`Failed to generate ${type}:`, error.message);
      console.error(`\n❌ Error: ${error.message}`);

      if (error.response?.status === 404) {
        if (id) {
          console.error(
            `${type.charAt(0).toUpperCase() + type.slice(1)} with ID ${id} not found in Harvest.`
          );
        } else {
          console.error(`No ${type}s found in Harvest or failed to fetch the most recent ${type}.`);
        }
      } else if (error.response?.status === 401) {
        console.error('Authentication failed. Please check your Harvest credentials in .env file.');
      } else if (error.message.includes('Missing required environment variables')) {
        console.error('Please copy .env.example to .env and configure all required variables.');
      }

      process.exit(1);
    }
  }

  /**
   * Generate output filename
   * @param {InvoiceDTO} invoice - Invoice data
   * @param {string} type - Document type
   * @returns {string} Filename
   */
  generateFilename(invoice, type) {
    const number = invoice.number.replace(/[^a-zA-Z0-9]/g, '');
    const companyName = config.company.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (type === 'estimate') {
      return `Estimate_${number}_${companyName}.pdf`;
    } else {
      return `Invoice_${number}_${companyName}.pdf`;
    }
  }

  /**
   * Ensure output directory exists
   */
  async ensureOutputDir() {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Main CLI entry point
   * @param {string[]} args - Command line arguments
   */
  async run(args = process.argv.slice(2)) {
    try {
      const parsed = this.parseArgs(args);

      if (parsed.help) {
        this.showHelp();
        return;
      }

      // ID is now optional - if not provided, we'll fetch the latest document

      // Validate environment before starting
      try {
        require('../config/env');
      } catch (error) {
        console.error('❌ Environment configuration error:');
        console.error(error.message);
        console.error('\nPlease copy .env.example to .env and configure all required variables.');
        process.exit(1);
      }

      await this.generateInvoice(parsed.id, parsed.type);
    } catch (error) {
      logger.error('CLI error:', error.message);
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  const cli = new InvoiceCLI();
  cli.run().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = InvoiceCLI;
