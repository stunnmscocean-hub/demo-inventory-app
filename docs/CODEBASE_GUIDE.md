# Codebase Guide

This document provides a detailed description of the active files in the **Inventory Management System**.

## Source Code (`src/`)

### 1. Root Files
- **`App.js`**: The main application component. It defines routes (`/login`, `/`, `/oauth/callback`) and initializes the authentication state from local storage.
- **`index.js`**: The entry point of the React application that renders the `App` component into the DOM.
- **`App.css`**: Global styles applied across the entire application.

### 2. Pages (`src/pages/`)
- **`MainPage.js`**: Divided logically into inventory management, search filters, and equipment application forms. It is the heart of the application.
- **`MainPage.module.css`**: Scoped styles specifically for the `MainPage`.
- **`LoginPage.js`**: Handles the initial user landing and authentication triggers.
- **`LoginPage.module.css`**: Scoped styles for the login interface.

### 3. Components (`src/components/`)
- **`JpgViewer.js`**: A modal component used to preview PNG/JPG versions of the generated demo application forms.
- **`GoogleOAuthButton.js`**: A reusable component for initiating the Google OAuth 2.0 flow.
- **`OAuthCallback.js`**: A dedicated route component that processes the tokens returned from Google and redirects the user back to the app.

### 4. Services (`src/services/`)
- **`api.js`**: Centralizes all asynchronous calls to the Google Apps Script (GAS) backend. It includes functions for fetching tasks, equipment data, and uploading files.

### 5. Stores (`src/stores/`)
- **`authStore.js`**: A state management store (using `zustand`) that tracks the user's authentication status, tokens, and profile information.

### 6. Utilities (`src/utils/`)
- **`googleSheetPdfExporter.js`**: Contains the logic to interact with the GAS "PDF Exporter" actions. It handles duplicating templates and triggering PDF-to-image conversions.
- **`csvParser.js`**: Provides helper functions to parse the `.csv` files located in the `public` folder.
- **`dataCache.js`**: Manages `localStorage` caching to improve performance and provide a smoother user experience when reloading data.

## Public Assets (`public/`)

- **`index.html`**: The static HTML template for the React application.
- **`장비현황.csv`**: Contains the master list of equipment and their current status (used as fallback or for development).
- **`사용내역.csv`**: Logs of previous equipment rentals and returns.
- **`파트너정보.csv`**: A list of verified partners for equipment distribution.
- **`pdfjs/`**: Local libraries for PDF rendering (leveraged by some preview utilities).

## Documentation (`docs/`)

- **`ARCHITECTURE.md`**: Describes the React + GAS system design.
- **`FILE_STRUCTURE.md`**: Maps the new organized directory layout.
- **`DEPLOYMENT.md`**: Instructions for Vercel and Git-based deployment.
- **`CODEBASE_GUIDE.md`**: This document, detailing each active file.
- **`보안_분석_보고서.md`**: Analysis of system security and authentication.
- **`파일전송가이드.md` / `setup_ddns.md`**: Specific guides for legacy server management (archived in `docs/`).
