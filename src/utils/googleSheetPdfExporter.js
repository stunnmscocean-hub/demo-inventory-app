/* global gapi google */
// src/utils/googleSheetPdfExporter.js

// TODO: Replace with your Google Cloud Project's Client ID
const CLIENT_ID = '398416192796-hti5gn426cdl8bpv52ofcquahci7o7j5.apps.googleusercontent.com'; 
const API_KEY = ''; // Not strictly needed for direct export URL, removed placeholder
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];
const SCOPES = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly";

// Spreadsheet ID and GID from the provided URL
const SPREADSHEET_ID = '13yJAh59CYIKYMV1LPlZR2m1Rqef3sHZFOvFHhx0lht0';
const SHEET_GID = '1326732411'; // This is the gid for the specific sheet/tab

let gapiInited = false;
let gisInited = false;
let tokenClient;

/**
 * Callback after api.js is loaded.
 */
function gapiLoaded() {
  gapi.client.init({
    apiKey: API_KEY, // Not strictly needed for direct export URL, but good for other Sheets API calls
    discoveryDocs: DISCOVERY_DOCS,
  }).then(() => {
    gapiInited = true;
    // Load the Sheets API
    gapi.client.load('sheets', 'v4');
    maybeEnableButtons();
  });
}

/**
 * Callback after gis.js is loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {}, // Initial empty callback, will be set dynamically by handleAuthClick
  });
  gisInited = true;
  maybeEnableButtons();
}

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    // TODO: Enable your UI buttons here if needed
    console.log("Google API and GIS loaded. Ready for authentication.");
  }
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(callback) {
  tokenClient.callback = async (resp) => {
    if (resp.error) {
      throw (resp);
    }
    // Access token is now available in gapi.client.getToken().access_token
    console.log("Authentication successful. Access token:", gapi.client.getToken().access_token);
    if (callback) callback(gapi.client.getToken().access_token);
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google account and authorize the application.
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    tokenClient.requestAccessToken({prompt: ''});
  }
}

/**
 * Updates the Google Sheet with the provided form data and selected equipments.
 * @param {object} formData - The form data to write to the sheet.
 * @param {Array} selectedEquipments - An array of selected equipment objects.
 * @returns {Promise<boolean>} - True if update is successful, false otherwise.
 */
export const updateGoogleSheetWithData = async (formData, selectedEquipments) => {
  if (!gapiInited || !gisInited) {
    console.error("Google API or GIS not loaded. Please ensure scripts are loaded and initialized.");
    alert("Google API not ready. Please try again.");
    return false;
  }

  return new Promise((resolve, reject) => {
    handleAuthClick(async (accessToken) => {
      if (!accessToken) {
        console.error("No access token available.");
        reject("Authentication failed: No access token.");
        return;
      }

      // Cell mappings for the Google Sheet
      const cellMappings = {
        'requester': 'E3',
        'checkoutDate': 'E4',
        'returnDate': 'E5',
        'checkoutReason': 'E6',
        'checkoutLocation': 'E7',
        'partnerCompanyName': 'D12',
        'partnerBusinessNumber': 'D13',
        'partnerContactPerson': 'D14',
        'partnerContactNumber': 'D15',
        'partnerAddress': 'D16',
        'usageCompanyName': 'D19',
        'usageBusinessNumber': 'M19',
        'usageAddress': 'D20',
        'usageContactPerson': 'D21',
        'usageContactNumber': 'M21',
        'memoContentStart': 'A24' // Starting cell for memo items
      };

      const requests = [];

      // Add form data to requests
      for (const key in cellMappings) {
        if (formData[key] && key !== 'memoContentStart') {
          requests.push({
            range: `${cellMappings[key]}`,
            values: [[formData[key]]]
          });
        }
      }

      // Add memo items
      const memoItems = formData.memoItems || [];
      let memoRow = parseInt(cellMappings.memoContentStart.substring(1)); // Get row number from 'A24'
      memoItems.forEach(memo => {
        requests.push({
          range: `A${memoRow}`,
          values: [[memo]]
        });
        memoRow++;
      });

      // Add selected equipments
      let equipmentRowStart = 30;
      selectedEquipments.slice(0, 5).forEach((equipment, i) => { // Max 5 equipments
        const row = equipmentRowStart + i;
        requests.push({ range: `B${row}`, values: [[equipment.name]] });
        requests.push({ range: `F${row}`, values: [[equipment.name]] }); // Assuming same name in F column
        requests.push({ range: `M${row}`, values: [[1]] }); // Quantity
        requests.push({ range: `O${row}`, values: [['']] }); // Empty for now
      });

      // Clear any remaining equipment rows if fewer than 5 are selected
      for (let i = selectedEquipments.length; i < 5; i++) {
        const row = equipmentRowStart + i;
        requests.push({ range: `B${row}`, values: [['']] });
        requests.push({ range: `F${row}`, values: [['']] });
        requests.push({ range: `M${row}`, values: [['']] });
        requests.push({ range: `O${row}`, values: [['']] });
      }

      try {
        const batchUpdateResponse = await gapi.client.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            valueInputOption: 'RAW',
            data: requests
          }
        });
        console.log("Google Sheet updated:", batchUpdateResponse);
        resolve(true);
      } catch (error) {
        console.error("Error updating Google Sheet:", error);
        alert(`Google Sheet 업데이트 실패: ${error.message}`);
        reject(false);
      }
    });
  });
};

export const exportGoogleSheetToPdf = async (fileName = 'exported-sheet.pdf') => {
  if (!gapiInited || !gisInited) {
    console.error("Google API or GIS not loaded. Please ensure scripts are loaded and initialized.");
    alert("Google API not ready. Please try again.");
    return;
  }

  return new Promise((resolve, reject) => {
    handleAuthClick(async (accessToken) => {
      if (!accessToken) {
        console.error("No access token available.");
        reject("Authentication failed: No access token.");
        return;
      }

      // Construct the export URL
      // Reference: https://docs.google.com/spreadsheets/d/스프레드시트ID/export?format=pdf&...
      const exportUrl = (
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?` +
        `format=pdf&gid=${SHEET_GID}&portrait=true&size=A4&fitw=true&gridlines=false`
        // Add more parameters as needed, e.g., &r1=1&c1=1&r2=10&c2=5 for range
      );

      try {
        const response = await fetch(exportUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        console.log("PDF export and download successful.");
        resolve(true);

      } catch (error) {
        console.error("Error exporting Google Sheet to PDF:", error);
        alert(`PDF 내보내기 실패: ${error.message}`);
        reject(error);
      }
    });
  });
};

// Load Google API client library
// This script should be loaded in index.html or a similar entry point
// <script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
// <script async defer src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>

// Expose functions globally for the onload callbacks
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;

/**
 * Checks if Google API and GIS are fully loaded and initialized.
 * @returns {boolean} True if ready, false otherwise.
 */
export const isGoogleApiReady = () => {
  return gapiInited && gisInited;
};
