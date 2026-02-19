# Deployment & Repository Guide

This document outlines the Git and Vercel configuration for the **Inventory Management System (demo-inventory-app)**.

## 📦 Repository Information

- **Repository URL**: [github.com/stunnmscocean-hub/demo-inventory-app](https://github.com/stunnmscocean-hub/demo-inventory-app.git)
- **Primary Branch**: `dev/0.1`
- **Local Path**: `c:\Users\Choijay\Desktop\React\demo-inventory-app`

## 🚀 Vercel Deployment

The project is hosted on Vercel with automatic CI/CD enabled.

- **Production URL**: [demodevice.kr](https://demodevice.kr)
- **Alternative Domain**: [www.demodevice.kr](https://www.demodevice.kr)
- **Deployment URL**: [demo-inventory-p79u29wf6-jayoceans-projects.vercel.app](https://demo-inventory-p79u29wf6-jayoceans-projects.vercel.app)

### Deployment Workflow

1. **Automatic Deploys**: Any `git push` to the `dev/0.1` branch triggers an automatic build and deployment on Vercel.
2. **Build Configuration**:
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Environment**: Strict linting is enabled (warnings may block builds).

## 🛠️ Common Commands

### Local Development
To run the application locally for testing:
```bash
npm start
```

### Production Build Check
To verify if the code is ready for Vercel without pushing:
```bash
npm run build
```

### Pushing Changes
To deploy your latest changes:
```bash
git add .
git commit -m "Your commit message"
git push origin dev/0.1
```

## 📝 Recent Fixes
- **Build Optimization**: Cleaned up unused variables and fixed hook dependencies in `MainPage.js` to ensure successful Vercel deployments.
- **Stock Logic**: Verified warehouse filtering logic in `dashboard_modern.html`.
