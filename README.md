# Free PDF Tools

A privacy-first, client-side PDF manipulation studio that runs entirely in your browser.

## Features

- **Complete Privacy**: All operations happen locally - no uploads, no servers
- **Comprehensive Tools**: View, edit, convert, and manipulate PDF files
- **Works Offline**: Functions completely offline once loaded
- **No Registration**: No accounts or sign-up required

### Core Capabilities

- **View & Organize**: Open, merge, split, extract, reorder, and rotate pages
- **Edit**: Add page numbers, headers/footers, watermarks, crop pages, manage colors and bookmarks
- **Layout**: N-up layouts, posterize, interleave pages with advanced options
- **Convert**: Images/text to PDF, PDF to images, OCR text recognition
- **Forms**: Fill and flatten forms, basic form designer
- **Security**: Encrypt/decrypt, permissions, digital signatures, redaction
- **Optimize**: Compress, repair, sanitize, metadata management

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for app state
- **PDF Processing**: pdf-lib + pdfjs-dist
- **OCR**: Tesseract.js with language packs
- **Workers**: Web Workers via Comlink for heavy operations
- **PWA**: Service Worker for offline capabilities

## Privacy & Security

✅ **No data transmission** - Everything processes locally  
✅ **No tracking** - Zero analytics or telemetry  
✅ **No storage** - Files only in memory during use  
✅ **Open source** - Fully auditable code  
✅ **Offline capable** - Works without internet  

## Browser Requirements

- Modern browser with WebAssembly support
- Chrome 90+, Firefox 88+, Safari 14+
- Recommended: 4GB+ RAM for large files

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

## Architecture

```
/src
  /components     # Reusable UI components
  /workers       # Web Workers for heavy processing
  /lib           # Core utilities and helpers
  /routes        # Page components
  /state         # Zustand stores
  /tools         # PDF manipulation tools
  /styles        # Global styles and Tailwind config
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [PDF-lib](https://pdf-lib.js.org/) for PDF manipulation
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- [Tesseract.js](https://tesseract.projectnaptha.com/) for OCR
- [React](https://reactjs.org/) and the entire ecosystem

---

**Free PDF Tools** - Where your privacy meets powerful PDF processing.