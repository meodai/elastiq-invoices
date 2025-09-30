const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { marked } = require('marked');
const config = require('../config/env');
const qrGenerator = require('../domain/qr');
const logger = require('../utils/logger');

/**
 * PDF renderer for Swiss QR invoices
 */
class InvoiceRenderer {
  constructor() {
    this.templatePath = path.join(__dirname, 'template.html');
    this.stylesPath = path.join(__dirname, 'styles.css');
    this.fontsPath = path.join(__dirname, 'fonts.css');
    this.logoPath = path.join(__dirname, 'logo.svg');
  }

  /**
   * Render invoice to PDF
   * @param {InvoiceDTO} invoice - Invoice data
   * @param {string} outputPath - Output PDF path
   * @returns {Promise<string>} Path to generated PDF
   */
  async renderToPDF(invoice, outputPath) {
    logger.info(`Rendering invoice ${invoice.number} to PDF...`);

    try {
      // Generate QR-bill SVG
      const qrBillSVG = qrGenerator.generateFromInvoice(invoice);

      // Load and compile template
      const html = await this.compileTemplate(invoice, qrBillSVG);
      

      // Try to generate PDF with puppeteer, fallback to HTML if Chrome is not available
      try {
        await this.generatePDF(html, outputPath);
        logger.info(`Successfully generated PDF: ${outputPath}`);
        return outputPath;
      } catch (puppeteerError) {
        logger.warn('Puppeteer failed, generating HTML file instead:', puppeteerError.message);

        // Generate HTML file as fallback
        const htmlPath = outputPath.replace('.pdf', '.html');
        await this.generateHTML(html, htmlPath);

        logger.info(`Generated HTML file: ${htmlPath}`);
        logger.info('To convert to PDF, please:');
        logger.info('1. Install Google Chrome: brew install --cask google-chrome');
        logger.info('2. Or open the HTML file in a browser and print to PDF');

        return htmlPath;
      }
    } catch (error) {
      logger.error(`Failed to render: ${error.message}`);
      throw error;
    }
  }

  /**
   * Compile HTML template with invoice data
   * @param {InvoiceDTO} invoice - Invoice data
   * @param {string} qrBillSVG - QR-bill SVG content
   * @returns {Promise<string>} Compiled HTML
   */
  async compileTemplate(invoice, qrBillSVG) {
    logger.debug('Compiling HTML template...');

    try {
      // Load template, styles, fonts, and logo
      const [templateContent, stylesContent, fontsContent, logoContent] = await Promise.all([
        fs.readFile(this.templatePath, 'utf-8'),
        fs.readFile(this.stylesPath, 'utf-8'),
        fs.readFile(this.fontsPath, 'utf-8'),
        fs.readFile(this.logoPath, 'utf-8'),
      ]);

      // Combine fonts and styles
      const combinedStyles = fontsContent + '\n\n' + stylesContent;

      // Prepare template data
      const templateData = this.prepareTemplateData(
        invoice,
        qrBillSVG,
        combinedStyles,
        logoContent
      );

      // Simple template replacement (no external template engine needed)
      let html = templateContent;

      // Handle loops (line items) FIRST - before global replacements
      html = this.processLineItems(html, invoice.items, invoice.currency);

      // Handle conditional blocks
      html = this.processConditionals(html, templateData);

      // Replace all template variables LAST - to avoid conflicts with line item placeholders
      Object.entries(templateData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value || '');
      });

      logger.debug('Template compiled successfully');
      return html;
    } catch (error) {
      logger.error(`Template compilation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepare data for template rendering
   * @param {InvoiceDTO} invoice - Invoice data
   * @param {string} qrBillSVG - QR-bill SVG content
   * @param {string} stylesContent - CSS styles content
   * @param {string} logoContent - Logo SVG content
   * @returns {object} Template data
   */
  prepareTemplateData(invoice, qrBillSVG, stylesContent, logoContent) {
    const isEstimate = invoice.getType() === 'estimate';

    const templateData = {
      // Document info
      documentType: isEstimate ? 'Estimate' : 'Invoice',
      documentTitle: isEstimate ? 'Estimate' : 'Invoice',
      invoiceNumber: invoice.number,
      issueDate: this.formatDate(invoice.issueDate),
      dueDate: invoice.dueDate ? this.formatDate(invoice.dueDate) : null,
      currency: invoice.currency,

      // Company info
      companyName: config.company.name,
      companyStreet: config.company.street,
      companyZip: config.company.zip,
      companyCity: config.company.city,
      companyCountry: config.company.country,
      companyEmail: config.company.email,

      // Debtor info
      debtorName: invoice.debtor.name,
      debtorStreet: invoice.debtor.street,
      debtorZip: invoice.debtor.zip,
      debtorCity: invoice.debtor.city,
      debtorCountry: invoice.debtor.country,

      // Amounts
      subtotal: this.formatAmount(invoice.subtotal),
      taxTotal: this.formatAmount(invoice.taxTotal),
      taxRate: this.calculateTaxRate(invoice),
      total: this.formatAmount(invoice.total),
      totalHours: this.formatQuantity(invoice.getTotalHours()),

      // Content
      notes: this.processMarkdown(invoice.notes),
      qrBillSVG: qrBillSVG,
      logoSVG: logoContent,
      styles: stylesContent,
    };

    // Debug: Log template data
    logger.debug('Template data amounts:', {
      subtotal: templateData.subtotal,
      taxTotal: templateData.taxTotal,
      taxRate: templateData.taxRate,
      total: templateData.total,
    });

    return templateData;
  }

  /**
   * Process conditional template blocks
   * @param {string} html - HTML content
   * @param {object} data - Template data
   * @returns {string} Processed HTML
   */
  processConditionals(html, data) {
    // Handle {{#if condition}} blocks
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;

    return html.replace(ifRegex, (match, condition, content) => {
      return data[condition] ? content : '';
    });
  }

  /**
   * Process line items loop
   * @param {string} html - HTML content
   * @param {LineItemDTO[]} items - Line items
   * @param {string} currency - Currency code
   * @returns {string} Processed HTML
   */
  processLineItems(html, items, _currency) {
    const eachRegex = /{{#each\s+lineItems}}([\s\S]*?){{\/each}}/g;

    return html.replace(eachRegex, (match, template) => {
      return items
        .map(item => {
          let itemHtml = template;

          // Replace item properties
          itemHtml = itemHtml.replace(/{{description}}/g, this.escapeHtml(item.description));
          itemHtml = itemHtml.replace(/{{quantity}}/g, this.formatQuantity(item.quantity));
          itemHtml = itemHtml.replace(/{{unitPrice}}/g, this.formatAmount(item.unitPrice));
          itemHtml = itemHtml.replace(
            /{{taxRate}}/g,
            item.taxRate > 0 ? item.taxRate.toFixed(1) : ''
          );
          
          itemHtml = itemHtml.replace(/{{total}}/g, this.formatAmount(item.total));

          return itemHtml;
        })
        .join('');
    });
  }

  /**
   * Generate PDF using puppeteer
   * @param {string} html - HTML content
   * @param {string} outputPath - Output file path
   */
  async generatePDF(html, outputPath) {
    logger.debug('Generating PDF with puppeteer...');

    let browser;
    try {
      // Launch browser with increased timeouts and better error handling
      browser = await puppeteer.launch({
        headless: "new",
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
        timeout: 60000, // 60 second timeout for browser launch
      });

      const page = await browser.newPage();

      // Set longer timeouts
      page.setDefaultTimeout(60000);
      page.setDefaultNavigationTimeout(60000);

      logger.debug('Setting page content...');

      // Set content with simpler wait conditions to avoid hanging
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait a bit for any remaining rendering
      await page.waitForTimeout(1000);

      logger.debug('Generating PDF...');

      // Ensure output directory exists
      await this.ensureOutputDir(outputPath);

      // Generate PDF with A4 dimensions
      await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
        printBackground: true,
        preferCSSPageSize: true,
        timeout: 30000,
      });

      logger.debug('PDF generated successfully');
    } catch (error) {
      logger.error('PDF generation error:', error.message);
      throw error;
    } finally {
      if (browser) {
        try {
          await browser.close();
          logger.debug('Browser closed successfully');
        } catch (closeError) {
          logger.warn('Error closing browser:', closeError.message);
        }
      }
    }
  }

  /**
   * Generate HTML file as fallback when PDF generation fails
   * @param {string} html - HTML content
   * @param {string} outputPath - Output file path
   */
  async generateHTML(html, outputPath) {
    logger.debug('Generating HTML file...');

    // Ensure output directory exists
    await this.ensureOutputDir(outputPath);

    // Write HTML to file
    const fs = require('fs').promises;
    await fs.writeFile(outputPath, html, 'utf8');

    logger.debug('HTML file generated successfully');
  }

  /**
   * Calculate the effective tax rate from invoice data
   * @param {InvoiceDTO} invoice - Invoice data
   * @returns {string} Tax rate as formatted percentage
   */
  calculateTaxRate(invoice) {
    if (invoice.subtotal === 0 || invoice.taxTotal === 0) {
      return '0.0';
    }
    const rate = (invoice.taxTotal / invoice.subtotal) * 100;
    return rate.toFixed(1);
  }

  /**
   * Format date for display
   * @param {dayjs.Dayjs} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate(date) {
    if (!date) {
      return '';
    }
    return date.format('DD.MM.YYYY');
  }

  /**
   * Format monetary amount
   * @param {number} amount - Amount to format
   * @returns {string} Formatted amount
   */
  formatAmount(amount) {
    // Use Swiss number formatting with apostrophe as thousands separator
    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format quantity with appropriate decimal places
   * @param {number} quantity - Quantity to format
   * @returns {string} Formatted quantity
   */
  formatQuantity(quantity) {
    // Use Swiss number formatting, show decimals only if needed
    if (quantity % 1 === 0) {
      return new Intl.NumberFormat('de-CH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(quantity);
    } else {
      return new Intl.NumberFormat('de-CH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(quantity);
    }
  }

  /**
   * Process markdown content to HTML
   * @param {string} markdown - Markdown content
   * @returns {string} HTML content
   */
  processMarkdown(markdown) {
    if (!markdown) return '';

    try {
      // Configure marked for safe rendering
      marked.setOptions({
        breaks: true, // Convert line breaks to <br>
        gfm: true, // GitHub Flavored Markdown
        sanitize: false, // We'll handle escaping ourselves if needed
      });

      return marked(markdown);
    } catch (error) {
      logger.warn('Failed to process markdown:', error.message);
      // Fallback to escaped plain text if markdown processing fails
      return this.escapeHtml(markdown);
    }
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) {
      return '';
    }

    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };

    return text.replace(/[&<>"']/g, match => htmlEscapes[match]);
  }

  /**
   * Ensure output directory exists
   * @param {string} filePath - File path
   */
  async ensureOutputDir(filePath) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
  }
}

module.exports = new InvoiceRenderer();
