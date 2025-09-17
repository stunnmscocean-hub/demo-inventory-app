/* global gapi google */
// src/utils/googleSheetPdfExporter.js

// TODO: Replace with your Google Cloud Project's Client ID
const CLIENT_ID = '398416192796-hti5gn426cdl8bpv52ofcquahci7o7j5.apps.googleusercontent.com'; 
const API_KEY = 'AIzaSyC758cPOoHQQT08rZs1lkYdfH_H7vgK-tE'; // Your Google Cloud Project's API Key
const DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
  "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest" // Add Drive API discovery document
];
const SCOPES = "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/spreadsheets.readonly"; // Added readonly scope for better compatibility

// Template Spreadsheet ID and GID from the provided URL
export const TEMPLATE_SPREADSHEET_ID = '13yJAh59CYIKYMV1LPlZR2m1Rqef3sHZFOvFHhx0lht0';
export const TEMPLATE_SHEET_GID = '1326732411'; // This is the gid for the specific sheet/tab
let currentSpreadsheetId = null; // To store the ID of the duplicated spreadsheet
let currentSheetGid = null; // To store the GID of the duplicated sheet

let gapiInited = false;
let gisInited = false;
let tokenClient;

let isInitCalled = false; // New flag to ensure initGoogleApis runs only once

export const initGoogleApis = async () => {
  if (isInitCalled) {
    console.log("googleSheetPdfExporter: initGoogleApis already called, skipping.");
    return Promise.resolve({ gapiClient: gapi.client, tokenClient: tokenClient }); // Resolve immediately if already initialized
  }
  isInitCalled = true;
  console.log("googleSheetPdfExporter: initGoogleApis called.");

  return new Promise((resolve) => {
    const loadGapi = () => {
      gapi.load('client', () => {
        gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: DISCOVERY_DOCS,
        }).then(() => {
          gapiInited = true;
          console.log("googleSheetPdfExporter: gapi client initialized.");
          gapi.client.load('sheets', 'v4');
          gapi.client.load('drive', 'v3'); // Load Drive API
          if (gapiInited && gisInited) {
            console.log("Google API and GIS loaded. Ready for authentication.");
            resolve({ gapiClient: gapi.client, tokenClient: tokenClient });
          }
        });
      });
    };

    const loadGis = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {},
      });
      gisInited = true;
      console.log("googleSheetPdfExporter: gis client initialized.");
      if (gapiInited && gisInited) {
        console.log("Google API and GIS loaded. Ready for authentication.");
        resolve({ gapiClient: gapi.client, tokenClient: tokenClient });
      }
    };

    const scriptGapi = document.createElement('script');
    scriptGapi.src = "https://apis.google.com/js/api.js";
    scriptGapi.async = true;
    scriptGapi.defer = true;
    scriptGapi.onload = loadGapi; // Call loadGapi when script is loaded
    document.head.appendChild(scriptGapi);

    const scriptGis = document.createElement('script');
    scriptGis.src = "https://accounts.google.com/gsi/client";
    scriptGis.async = true;
    scriptGis.defer = true;
    scriptGis.onload = loadGis; // Call loadGis when script is loaded
    document.head.appendChild(scriptGis);
  });
};

/**
 *  Sign in the user upon button click.
 */
export function handleAuthClick(client, callback) {
  client.callback = async (resp) => {
    if (resp.error) {
      throw (resp);
    }
    // Access token is now available in gapi.client.getToken().access_token
    console.log("Authentication successful. Access token:", gapi.client.getToken().access_token);
    if (callback) callback(gapi.client.getToken().access_token);
  };

  if (gapi.client.getToken() === null) {
    // Prompt the user to select a Google account and authorize the application.
    // Use popup mode to avoid COOP issues
    client.requestAccessToken({
      prompt: 'consent',
      popup: true
    });
  } else {
    // Skip display of account chooser and consent dialog for an existing session.
    client.requestAccessToken({
      prompt: '',
      popup: true
    });
  }
}

/**
 * Updates the Google Sheet with the provided form data and selected equipments.
 * @param {object} formData - The form data to write to the sheet.
 * @param {Array} selectedEquipments - An array of selected equipment objects.
 * @returns {Promise<boolean>} - True if update is successful, false otherwise.
 */
export const duplicateSpreadsheet = async (accessToken, templateSpreadsheetId, newTitle) => {
  if (!gapiInited || !gisInited) {
    console.error("Google API or GIS not loaded. Please ensure scripts are loaded and initialized.");
    alert("Google API not ready. Please try again.");
    return null;
  }
  if (!accessToken) {
    console.error("No access token available for duplication.");
    throw new Error("Authentication failed: No access token.");
  }

  try {
    const response = await gapi.client.drive.files.copy({
      fileId: templateSpreadsheetId,
      resource: {
        name: newTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet'
      }
    });
    console.log("Spreadsheet duplicated:", response.result);
    currentSpreadsheetId = response.result.id; // Store the new spreadsheet ID
    // Optionally, get the GID of the first sheet in the new spreadsheet if needed
    const newSpreadsheet = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: currentSpreadsheetId,
      fields: 'sheets.properties.sheetId'
    });
    currentSheetGid = newSpreadsheet.result.sheets[0].properties.sheetId;

    // Try to remove all protected ranges from the duplicated spreadsheet
    // If this fails, continue with the workflow as it's not critical
    try {
      await removeSheetProtections(accessToken, currentSpreadsheetId);
    } catch (error) {
      console.warn("Warning: Could not remove sheet protections, but continuing with workflow:", error.message);
    }

    return response.result.id;
  } catch (error) {
    console.error("Error duplicating spreadsheet:", error);
    alert(`스프레드시트 복제 실패: ${error.message}`);
    throw error;
  }
};

/**
 * Removes all protected ranges from a given spreadsheet.
 * @param {string} accessToken - The user's Google API access token.
 * @param {string} spreadsheetId - The ID of the spreadsheet to modify.
 * @returns {Promise<boolean>} - True if protections are removed successfully, false otherwise.
 */
const removeSheetProtections = async (accessToken, spreadsheetId) => {
  try {
    // First, try to get all protected ranges in the spreadsheet
    // Use a more basic approach that's less likely to fail
    const response = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId
      // Remove the fields parameter to get all data, then check for protectedRanges
    });

    const protectedRanges = response.result.protectedRanges;
    if (!protectedRanges || protectedRanges.length === 0) {
      console.log("No protected ranges found to remove.");
      return true;
    }

    console.log(`Found ${protectedRanges.length} protected ranges to remove.`);

    const requests = protectedRanges.map(range => ({
      deleteProtectedRange: {
        protectedRangeId: range.protectedRangeId
      }
    }));

    await gapi.client.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId,
      requests: requests
    });

    console.log("All protected ranges removed successfully.");
    return true;
  } catch (error) {
    // If we can't access protected ranges or remove them, it's not critical
    // The spreadsheet will still work, just with some cells potentially protected
    console.warn("Could not remove sheet protections (this is usually not critical):", error.message);
    return false; // Return false instead of throwing to indicate non-critical failure
  }
};

export const updateGoogleSheetWithData = async (accessToken, spreadsheetId, formData, selectedEquipments) => {
  if (!gapiInited || !gisInited) {
    console.error("Google API or GIS not loaded. Please ensure scripts are loaded and initialized.");
    alert("Google API not ready. Please try again.");
    return false;
  }
  if (!accessToken) {
    console.error("No access token available for update.");
    throw new Error("Authentication failed: No access token.");
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
      spreadsheetId: spreadsheetId, // Use the provided spreadsheetId
      valueInputOption: 'RAW',
      data: requests
    });
    console.log("Google Sheet updated:", batchUpdateResponse);
    return true;
  } catch (error) {
    console.error("Error updating Google Sheet:", error);
    alert(`Google Sheet 업데이트 실패: ${error.message}`);
    throw error;
  }
};

export const exportGoogleSheetToPdfAndSaveToDrive = async (accessToken, spreadsheetId, sheetGid, fileName = 'exported-sheet.pdf') => {
  if (!gapiInited || !gisInited) {
    console.error("Google API or GIS not loaded. Please ensure scripts are loaded and initialized.");
    alert("Google API not ready. Please try again.");
    return null;
  }
  if (!accessToken) {
    console.error("No access token available for PDF export.");
    throw new Error("Authentication failed: No access token.");
  }

  const exportUrl = (
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?` +
    `format=pdf&gid=${sheetGid}&portrait=true&size=A4&fitw=true&gridlines=false`
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
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({
      name: fileName,
      mimeType: 'application/pdf',
      // parents: ['YOUR_FOLDER_ID'] // Optional: specify a folder ID to save to
    })], { type: 'application/json' }));
    form.append('file', blob);

    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: form
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Drive upload error! status: ${uploadResponse.status}, message: ${errorText}`);
    }

    const result = await uploadResponse.json();
    console.log("PDF saved to Google Drive:", result);
    return result.id; // Resolve with the file ID of the saved PDF

  } catch (error) {
    console.error("Error exporting Google Sheet to PDF and saving to Drive:", error);
    alert(`PDF 내보내기 및 Drive 저장 실패: ${error.message}`);
    throw error;
  }
};


// Load Google API client library
// This script should be loaded in index.html or a similar entry point
// <script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
// <script async defer src="https://accounts.google.com/gsi/client" onload="gisLoaded()"></script>


/**
 * Checks if Google API and GIS are fully loaded and initialized.
 * @returns {boolean} True if ready, false otherwise.
 */
export const isGoogleApiReady = () => {
  return gapiInited && gisInited;
};
