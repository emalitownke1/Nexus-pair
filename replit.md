# Overview

The TREKKER-MD Session Generator is a web-based WhatsApp bot session management system built with Node.js and Express. It enables users to generate, validate, and manage WhatsApp bot authentication sessions through QR code scanning or phone number pairing. The system provides a complete solution for WhatsApp bot developers to handle authentication credentials securely.

# Recent Changes

**August 29, 2025**: Rebranded system from GIFTED-MD to TREKKER-MD with updated contact information. Enhanced the pairing system with automatic data cleanup and connection reset after successful session generation. The system now automatically clears all stored data, closes connections, and resets to default state after sending success messages to users, ensuring the server is ready for new requests.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The application uses a multi-page web interface with three main views:
- **Landing Page** (`index.html`): Marketing page with modern gradient design and navigation
- **QR Code Page**: Displays QR codes for WhatsApp authentication
- **Pair Code Page** (`pair.html`): Phone number-based pairing interface with real-time feedback
- **Validation Page** (`validate.html`): Session ID validation and testing interface

The frontend implements a responsive design with CSS custom properties for theming, supporting both light and dark modes. All pages use Font Awesome icons and modern CSS transitions for enhanced user experience.

## Backend Architecture
The system follows an Express.js MVC pattern with modular routing:

### Core Components
- **Main Server** (`index.js`): Express application setup with middleware configuration
- **Router Modules**: Separate route handlers for different functionalities
  - `/qr` - QR code generation and scanning
  - `/code` - Phone number pairing
  - `/giftedValidate.php` - Session validation
- **Library Module** (`lib/index.js`): Shared utilities and database operations

### Session Management
The application uses a hybrid storage approach:
- **In-Memory Storage**: Map-based session storage for temporary data during authentication
- **MongoDB Integration**: Persistent storage for validated sessions with connection pooling
- **File System**: Temporary credential files for processing and validation

### Authentication Flow
1. **QR Code Method**: Generates unique QR codes using WhatsApp's Baileys library
2. **Pair Code Method**: Phone number validation and pairing code generation
3. **Session Processing**: Credential extraction and secure storage
4. **Session Delivery**: Sending session credentials and confirmation messages to users
5. **Auto-Cleanup**: Automatic clearing of stored data, connection reset, and system preparation for new requests
6. **Validation**: Session ID verification and integrity checking

## Data Storage Solutions

### MongoDB Database
- **Database Name**: `sessions`
- **Connection**: Uses MongoDB Atlas or self-hosted instances
- **Features**: Connection pooling, automatic reconnection, timeout handling
- **Credentials Storage**: Encrypted session data with generated session IDs

### File System Storage
- **Temporary Files**: `/temp` directory for processing credentials
- **Session Files**: JSON format for WhatsApp authentication state
- **Cleanup**: Automatic removal of temporary files after processing

### In-Memory Cache
- **NodeCache**: Caching layer for frequently accessed session data
- **Session Storage**: Map-based storage for active authentication sessions
- **Performance**: Reduces database queries for temporary operations

## External Dependencies

### WhatsApp Integration
- **@whiskeysockets/baileys**: Primary WhatsApp Web API library for bot functionality
- **QR Code Generation**: Real-time QR code creation for device pairing
- **Phone Number Validation**: International phone number format validation using `awesome-phonenumber`

### Database Services
- **MongoDB**: Primary database for session persistence
- **Connection String**: Configured via `MONGODB_URI` environment variable
- **Driver**: Official MongoDB Node.js driver with connection pooling

### Third-Party Libraries
- **Express.js**: Web framework for API and static file serving
- **PM2**: Process manager for production deployment and monitoring
- **Pino**: High-performance logging library
- **Axios**: HTTP client for external API requests
- **Body-Parser**: Request body parsing middleware
- **CORS**: Cross-origin resource sharing configuration

### Deployment Platforms
- **Heroku**: Native support with buildpack configuration
- **Render**: Alternative deployment option
- **Self-Hosting**: PM2-based process management for VPS deployment

### Development Tools
- **dotenv**: Environment variable management
- **Node.js**: Runtime environment (minimum version 20.0.0)
- **npm**: Package management and dependency resolution