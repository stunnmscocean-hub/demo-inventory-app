# Deployment & Build Guide

This document outlines the build process and production deployment for the **Inventory Management System**.

## 🔄 Development vs. Production

The application operates in two distinct modes:

### 1. Development Mode (`Local`)
- **Command**: `npm start`
- **Environment**: Reads configuration from `.env` in the root directory.
- **Behavior**: Enables React DevTools and hot module replacement (HMR). Uses local `.csv` files in `public/` for rapid development testing.

### 2. Production Mode (`Vercel`)
- **Build Command**: `npm run build`
- **Artifacts**: Generates an optimized, minified bundle in the `build/` directory.
- **Environment**: Uses Vercel's Dashboard for environment variables (Settings > Environment Variables).
- **Deployment URL**: [demodevice.kr](https://demodevice.kr)

## 🏗️ Build Pipeline

### Local Build Verification
Before pushing changes, it is highly recommended to run a local build to catch compilation errors:
```bash
npm run build
```
This command checks for:
- Missing dependencies or broken imports.
- TypeScript/ESLint violations (Strict mode enabled).
- Asset optimization.

### Automatic CI/CD (GitHub + Vercel)
The project is configured for seamless deployment:
1. Push changes to the `dev/0.1` branch.
2. Vercel automatically detects the push and triggers a build.
3. The build process runs `npm run build` and ignores all files in `_backup/`.
4. If the build succeeds, the new version is instantly live at [demodevice.kr](https://demodevice.kr).

## 🌍 Environment Variables

Key variables required for both Dev and Prod:
- `REACT_APP_GAS_URL`: The Web App URL for the Google Apps Script backend.
- `REACT_APP_GOOGLE_CLIENT_ID`: OAuth 2.0 Client ID for Google Login.

> [!IMPORTANT]
> Change the `REACT_APP_GAS_URL` in Vercel settings if the backend script is redeployed to a new URL.

## 🛠️ Maintenance & Cleanup
The project root has been simplified by moving legacy tools to `_backup/`. The build process only includes files in `src/` and `public/`, ensuring the production bundle remains lightweight and secure.

---
**Last Updated**: 2026-02-19
