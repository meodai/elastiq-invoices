# Swiss QR Invoice Generator

A production-ready Node.js service that fetches invoice and estimate data from the Harvest API and generates Swiss QR-bill compliant PDFs with proper German localization.

## Features

- 🏦 **Swiss QR-bill Compliance**: Generates fully compliant Swiss QR-bills with payment part and receipt
- 📊 **Harvest Integration**: Seamlessly fetches invoice/estimate data from Harvest API v2
- 🇩🇪 **German Localization**: All labels and text in German (no i18n system needed)
- 📄 **Professional PDFs**: Clean, branded A4 invoice layout with proper typography
- ⚡ **CLI Interface**: Simple command-line tool for generating invoices
- 🧮 **Accurate Calculations**: Proper rounding and tax calculations for CHF/EUR
- 🔧 **Production Ready**: Error handling, logging, rate limiting, and validation

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: Plain JavaScript (no TypeScript)
- **Package Manager**: npm
- **HTTP Client**: axios
- **PDF Generation**: HTML/CSS → PDF via puppeteer
- **QR-bill**: swissqrbill package (SVG generation)
- **Date/Time**: dayjs
- **Environment**: dotenv
- **Linting**: ESLint + Prettier
- **Testing**: Jest
- **Development**: nodemon

## Installation

1. **Clone and install dependencies**:
   ```bash
   git clone <repository-url>
   cd di08-invoices
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up your environment variables** (see [Configuration](#configuration))

## Configuration

Copy `.env.example` to `.env` and configure the following variables:

### Harvest API Configuration
```env
HARVEST_BASE_URL=https://api.harvestapp.com/v2
HARVEST_ACCOUNT_ID=your_harvest_account_id
HARVEST_TOKEN=your_personal_access_token
```

### Company Information
```env
COMPANY_NAME=Your GmbH
COMPANY_STREET=Zentralstrasse 43
COMPANY_ZIP=8003
COMPANY_CITY=Zürich
COMPANY_COUNTRY=CH
COMPANY_IBAN=CHxx xxxx xxxx xxxx xxxx x
COMPANY_QR_REFERENCE_TYPE=SCOR
COMPANY_QR_REFERENCE=
COMPANY_CURRENCY=CHF
COMPANY_EMAIL=billing@yourdomain.ch
```

### Application Settings
```env
TIMEZONE=Europe/Zurich
```

## Swiss QR-bill Reference Types

The system supports all three Swiss QR-bill reference types:

### QRR (QR Reference)
- **Use case**: Structured reference with automatic reconciliation
- **Requirements**: 
  - Must use QR-IBAN (IID 30000-31999)
  - Reference must be exactly 27 digits
- **Example**: `123456789012345678901234567`

### SCOR (Creditor Reference ISO 11649)
- **Use case**: International structured reference
- **Requirements**: 
  - Can use regular IBAN or QR-IBAN
  - Reference format: RF + 2 check digits + alphanumeric string
- **Example**: `RF18539007547034`

### NON (No Reference)
- **Use case**: Simple payments without structured reference
- **Requirements**: 
  - Can use regular IBAN or QR-IBAN
  - No reference number required

## Usage

### Command Line Interface

Generate an invoice PDF:
```bash
node src/cli/generate-invoice.js --id 12345
```

Generate an estimate PDF:
```bash
node src/cli/generate-invoice.js --id 67890 --type estimate
```

### Available Scripts

```bash
# Generate invoice (using nodemon for development)
npm run dev

# Generate invoice (production)
npm run gen:invoice -- --id 12345

# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### CLI Options

```bash
Usage:
  node src/cli/generate-invoice.js --id <ID> [--type <TYPE>]
  
Options:
  --id <ID>       Harvest invoice or estimate ID (required)
  --type <TYPE>   Document type: 'invoice' or 'estimate' (default: invoice)
  --help, -h      Show help message
```

## Project Structure

```
/src
  /config
    env.js                # Environment configuration and validation
  /harvest
    client.js             # Axios instance with auth headers and rate limiting
    invoices.js           # Harvest API functions (getInvoice, getEstimate, getClient)
  /domain
    dto.js                # Data Transfer Objects (InvoiceDTO, QRBillDTO, etc.)
    mapping.js            # Map Harvest data to internal DTOs
    money.js              # Currency rounding and calculation helpers
    qr.js                 # Swiss QR-bill data builder and SVG generator
  /render
    template.html         # HTML invoice template with German labels
    styles.css            # Print-optimized CSS with QR-bill compliance
    render.js             # PDF generation with puppeteer
  /cli
    generate-invoice.js   # Command-line interface
  /utils
    logger.js             # Simple console logger
/test
  qr.test.js             # QR-bill validation and generation tests
  money.test.js          # Money calculation and rounding tests
```

## Output

Generated PDFs are saved to the `./out/` directory with the following naming pattern:
- Invoices: `invoice-{number}-{date}.pdf`
- Estimates: `estimate-{number}-{date}.pdf`

## Validation

The generated QR-bills comply with Swiss payment standards. However, it's recommended to validate sample PDFs with the official SIX validator:
- [SIX QR-bill Validator](https://validation.iso-payments.ch/)

## Error Handling

The application includes comprehensive error handling for:
- Missing environment variables
- Invalid Harvest API credentials
- Network timeouts and rate limiting
- Invalid QR-bill configurations
- PDF generation failures

## Development

### Running Tests
```bash
npm test
```

### Code Quality
```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

### Development Mode
```bash
npm run dev
```

This uses nodemon to automatically restart when files change.

## Troubleshooting

### Common Issues

1. **Authentication Error (401)**
   - Verify your `HARVEST_TOKEN` and `HARVEST_ACCOUNT_ID` in `.env`
   - Ensure your Harvest personal access token has the required permissions

2. **QR-bill Validation Error**
   - For QRR reference type, ensure you're using a QR-IBAN (IID 30000-31999)
   - Verify your reference format matches the selected reference type
   - Check that currency is CHF or EUR

3. **Invoice Not Found (404)**
   - Verify the invoice/estimate ID exists in your Harvest account
   - Ensure you have access to the specific invoice/estimate

4. **PDF Generation Error**
   - Check that puppeteer can launch (may need additional dependencies on some systems)
   - Ensure output directory is writable

### Environment Validation

The application validates all required environment variables on startup and provides clear error messages for missing or invalid configurations.

### Debug Mode

Set `DEBUG=true` in your environment to enable detailed logging:
```bash
DEBUG=true node src/cli/generate-invoice.js --id 12345
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if needed
5. Ensure linting passes: `npm run lint`
6. Submit a pull request

## License

MIT

## Support

For issues related to:
- **Swiss QR-bill standards**: Consult the [official SIX documentation](https://www.six-group.com/en/products-services/financial-information/payment-systems/iso20022.html)
- **Harvest API**: Check the [Harvest API documentation](https://help.getharvest.com/api-v2/)
- **This application**: Open an issue in the repository

---

**Note**: Always validate generated QR-bills with the official SIX validator before using them for actual payments.
