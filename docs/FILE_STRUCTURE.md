# Project File Structure

This document outlines the organized file structure of the **Inventory Management System**.

## Clean Root Structure

The project root has been cleaned to focus on the active React development environment:

- `src/`: Main React source code.
- `public/`: Public assets and local CSV data for development.
- `docs/`: Centralized documentation (Architecture, Deployment, etc.).
- `_backup/`: Legacy files and unused scripts (Organized by type).
- `.env`: Environment variables (GAS URLs, Client IDs).
- `package.json`: NPM dependencies and scripts.

## Directory Details

### 1. `src/` (Active Development)
- `components/`: UI components like `Header`, `SearchBar`, and `JpgViewer`.
- `pages/`: Primary views (`MainPage`, `LoginPage`).
- `services/`: API communication layer (`api.js`).
- `stores/`: Global state management (`authStore.js`).
- `utils/`: Core utilities (`googleSheetPdfExporter.js`, `csvParser.js`).

### 2. `docs/` (Documentation)
- `ARCHITECTURE.md`: Overview of React + GAS system design.
- `DEPLOYMENT.md`: Git and Vercel deployment guide.
- `FILE_STRUCTURE.md`: This file.
- `보안_분석_보고서.md`: Security analysis report.

### 3. `_backup/` (Safe Storage)
- `automation/`: Legacy Python scripts, C sources, and automation binaries.
- `src/`: Unused React components and utility generators from earlier versions.
- `web_legacy/`: Old standalone HTML dashboards and manual script backups.
- `assets/`: Legacy Excel templates and CSV samples.

## Maintenance Guidelines
- **Adding Documentation**: All new `.md` files should be placed in `docs/`.
- **Legacy Code**: If a component is no longer used, move it to `_backup/src/` instead of deleting it immediately.
