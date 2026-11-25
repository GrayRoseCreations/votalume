/**
 * ============================================================================
 * VOTALUME MASTER DATABASE — DISCREPANCY REPORTS WEBHOOK
 * ============================================================================
 * Target Spreadsheet: Votalume Master Database
 * Spreadsheet ID: 1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM
 * Target Tabs: Discrepancy_Reports and Suggestions
 * 
 * INSTRUCTIONS:
 * 1. Open your master Google Sheet:
 *    https://docs.google.com/spreadsheets/d/1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM/edit
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Delete any default code in Code.gs, paste this entire file, and click the Save icon.
 * 4. Click the blue Deploy button (top right) > New deployment.
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 * 6. Set:
 *    - Description: Votalume Reports and Suggestions Webhook
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone (required for your website visitors to submit reports)
 * 7. Click Deploy, grant permissions when prompted, and copy the Web App URL
 *    (it looks like: https://script.google.com/macros/s/.../exec).
 * 8. Paste that URL into js/config.js under `REPORT_WEBHOOK_URL`.
 * 9. Deploy a new version after changing this script so both submission types route correctly.
 * ============================================================================
 */

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        throw new Error("Request body must be valid JSON.");
      }
    }

    var isSuggestion = String(data.submission_type || data.submissionType || "discrepancy").toLowerCase() === "suggestion";
    var sheetName = isSuggestion ? "Suggestions" : "Discrepancy_Reports";
    var headers = isSuggestion
      ? ["Timestamp", "Category", "Suggestion_Text", "Submitter_Email", "Page_Path", "Page_URL", "Page_Title", "Status"]
      : ["Timestamp", "Page_Path", "Page_URL", "Page_Title", "User_Name", "User_Email", "Record_ID", "Description_And_Source", "Status"];
    var sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1B365D");
      headerRange.setFontColor("#FFFFFF");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      for (var col = 1; col <= headers.length; col++) sheet.autoResizeColumn(col);
    }

    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var values = {
      timestamp: data.timestamp || new Date().toISOString(),
      pagepath: data.pagePath || "",
      pageurl: data.pageUrl || "",
      pagetitle: data.pageTitle || "",
      username: data.userName || "Anonymous Citizen",
      useremail: data.userEmail || "",
      recordid: data.recordId || "",
      descriptionandsource: data.description || data.Suggestion_Text || "",
      category: data.Category || data.category || "",
      suggestiontext: data.Suggestion_Text || data.suggestionText || data.description || "",
      submitteremail: data.Submitter_Email || data.submitterEmail || data.userEmail || "",
      status: data.status || "Pending Verification"
    };
    var row = headerRow.map(function(header) {
      var key = String(header).toLowerCase().replace(/[^a-z]/g, "");
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
    });
    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", sheet: sheetName, rowAdded: sheet.getLastRow() }))
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
