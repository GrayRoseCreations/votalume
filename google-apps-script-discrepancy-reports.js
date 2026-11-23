/**
 * ============================================================================
 * VOTALUME MASTER DATABASE — DISCREPANCY REPORTS WEBHOOK
 * ============================================================================
 * Target Spreadsheet: Votalume Master Database
 * Spreadsheet ID: 1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM
 * Target Tab: Discrepancy_Reports
 * 
 * INSTRUCTIONS:
 * 1. Open your master Google Sheet:
 *    https://docs.google.com/spreadsheets/d/1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM/edit
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs, paste this entire file, and click the Save icon.
 * 4. Click the blue Deploy button (top right) > New deployment.
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 * 6. Set:
 *    - Description: Votalume Discrepancy Reports Webhook
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone (required for your website visitors to submit reports)
 * 7. Click Deploy, grant permissions when prompted, and copy the Web App URL
 *    (it looks like: https://script.google.com/macros/s/.../exec).
 * 8. Paste that URL into js/config.js under `REPORT_WEBHOOK_URL`.
 * ============================================================================
 */

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = "Discrepancy_Reports";
    var sheet = ss.getSheetByName(sheetName);

    // Automatically create the tab if it does not yet exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);

      var headers = [
        "Timestamp",
        "Page_Path",
        "Page_URL",
        "Page_Title",
        "User_Name",
        "User_Email",
        "Record_ID",
        "Description_And_Source",
        "Status"
      ];

      sheet.appendRow(headers);

      // Style Header: Civic Navy background (#1B365D), white bold text
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1B365D");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);

      // Auto-fit column widths
      for (var col = 1; col <= headers.length; col++) {
        sheet.autoResizeColumn(col);
      }
    }

    // Parse incoming payload from Votalume website
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = { description: e.postData.contents };
      }
    }

    var row = [
      data.timestamp || new Date().toISOString(),
      data.pagePath || "",
      data.pageUrl || "",
      data.pageTitle || "",
      data.userName || "Anonymous Citizen",
      data.userEmail || "",
      data.recordId || "",
      data.description || "",
      data.status || "Pending Verification"
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", rowAdded: sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: "error", error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "active", message: "Votalume Discrepancy Reports endpoint is ready." }))
    .setMimeType(ContentService.MimeType.JSON);
}
