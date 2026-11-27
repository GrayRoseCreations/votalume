/**
 * ============================================================================
 * VOTALUME MASTER DATABASE — DISCREPANCY REPORTS WEBHOOK
 * ============================================================================
 * Target Spreadsheet: Votalume Master Database
 * Spreadsheet ID: 1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM
 * Target Tabs: Discrepancy_Reports, Suggestions, and aggregate-only Quiz_Benchmarks
 * 
 * INSTRUCTIONS:
 * 1. Open your master Google Sheet:
 *    https://docs.google.com/spreadsheets/d/1gcU-CVHfysi37Vtp_aDf6qOUFGUnfrpXpfNDTXBNgaM/edit
 * 2. In the top menu, click Extensions > Apps Script.
 * 3. Create a separate spreadsheet for private quiz responses. Restrict its
 *    sharing to the site administrator; do not publish it or enable public GViz.
 * 4. In Apps Script > Project Settings > Script properties, add:
 *    - PRIVATE_QUIZ_SPREADSHEET_ID: the private spreadsheet ID
 *    - FIREBASE_WEB_API_KEY: the Firebase web API key from js/config.js
 *    The active spreadsheet must remain the public Votalume master workbook.
 * 5. In the master workbook, privately export and migrate any existing
 *    Quiz_Responses rows to the private workbook, then delete the old public
 *    Quiz_Responses tab. Do not copy raw responses into Quiz_Benchmarks.
 * 6. Merge the `doPost`, `saveQuizResponse`, and `doGet` handlers with the
 *    existing project. Keep exactly one `doPost` and route quiz actions before
 *    the existing suggestion/discrepancy handling, then click Save.
 * 7. Click the blue Deploy button (top right) > New deployment.
 * 8. Click the gear icon next to "Select type" and choose "Web app".
 * 9. Set:
 *    - Description: Votalume Reports and Suggestions Webhook
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone (required for your website visitors to submit reports)
 * 10. Click Deploy, grant permissions when prompted, and copy the Web App URL
 *    (it looks like: https://script.google.com/macros/s/.../exec).
 * 11. Paste that URL into js/config.js under `REPORT_WEBHOOK_URL`.
 * 12. Deploy a new version after changing this script so all submission types route correctly.
 * Quiz_Benchmarks contains only question-level Yes/No totals and unique verified
 * voter counts. Firebase ID tokens are verified server-side; email addresses
 * and individual answers are never written to the public workbook.
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

    if (String(data.action || "").toLowerCase() === "submit_quiz_response") {
      return saveQuizResponse(ss, data);
    }

    var isSuggestion = String(data.submission_type || data.submissionType || "discrepancy").toLowerCase() === "suggestion";
    var sheetName = isSuggestion ? "Suggestions" : "Discrepancy_Reports";
    var headers = isSuggestion
      ? ["Timestamp", "Category", "Suggestion_Text", "Submitter_Email", "Page_Path", "Page_URL", "Page_Title", "Status"]
      : ["Timestamp", "Page_Path", "Page_URL", "Page_Title", "Entity_Type", "Entity_ID", "Entity_Name", "Issue_Category", "Description", "Official_Source_URL", "Reporter_Email", "Status"];
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
    headers.forEach(function(header) {
      var exists = headerRow.some(function(existing) {
        return String(existing).trim().toLowerCase() === header.toLowerCase();
      });
      if (!exists) {
        headerRow.push(header);
        sheet.getRange(1, headerRow.length).setValue(header);
      }
    });
    var values = {
      timestamp: data.timestamp || new Date().toISOString(),
      pagepath: data.Page_Path || data.pagePath || "",
      pageurl: data.Page_URL || data.pageUrl || "",
      pagetitle: data.Page_Title || data.pageTitle || "",
      username: data.userName || "Anonymous Citizen",
      useremail: data.userEmail || "",
      recordid: data.Entity_ID || data.recordId || "",
      entitytype: data.Entity_Type || "",
      entityid: data.Entity_ID || data.recordId || "",
      entityname: data.Entity_Name || "",
      issuecategory: data.Issue_Category || "",
      description: data.Description || data.description || data.Suggestion_Text || "",
      descriptionandsource: data.Description || data.description || data.Suggestion_Text || "",
      officialsourceurl: data.Official_Source_URL || "",
      reporteremail: data.Reporter_Email || data.userEmail || "",
      category: data.Category || data.category || "",
      suggestiontext: data.Suggestion_Text || data.suggestionText || data.description || "",
      submitteremail: data.Submitter_Email || data.submitterEmail || data.Reporter_Email || data.userEmail || "",
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

function saveQuizResponse(ss, data) {
  var verifiedUser = verifyQuizUser(String(data.id_token || "").trim());
  var email = verifiedUser.email;
  var userId = verifiedUser.userId;
  var submittedEmail = String(data.user_email || "").trim().toLowerCase();
  var questionId = String(data.question_id || "").trim();
  var answer = String(data.user_answer || "").trim();
  if (!submittedEmail || submittedEmail !== email) {
    throw new Error("The submitted email does not match the verified account.");
  }
  if (!questionId || !/^(yes|no|skip)$/i.test(answer)) {
    throw new Error("A question ID and Yes/No/Skip answer are required.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var privateId = PropertiesService.getScriptProperties().getProperty("PRIVATE_QUIZ_SPREADSHEET_ID");
    if (!privateId) throw new Error("PRIVATE_QUIZ_SPREADSHEET_ID is not configured.");
    var privateWorkbook = SpreadsheetApp.openById(privateId);
    var sheetName = "Quiz_Responses";
    var headers = ["Timestamp", "User_UID", "User_Email", "Quiz_Mode", "Question_ID", "User_Answer"];
    var sheet = privateWorkbook.getSheetByName(sheetName);
    if (!sheet) sheet = privateWorkbook.insertSheet(sheetName);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }

    var lastColumn = Math.max(sheet.getLastColumn(), 1);
    var headerRow = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
      return String(value || "").trim();
    });
    headers.forEach(function(header) {
      var exists = headerRow.some(function(existing) {
        return existing.toLowerCase() === header.toLowerCase();
      });
      if (!exists) {
        headerRow.push(header);
        sheet.getRange(1, headerRow.length).setValue(header);
      }
    });
    var columnIndex = {};
    headerRow.forEach(function(header, index) {
      columnIndex[String(header).toLowerCase()] = index;
    });

    var matchingRows = [];
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
      values.forEach(function(row, offset) {
        var existingUserId = String(row[columnIndex.user_uid] || "").trim();
        var existingEmail = String(row[columnIndex.user_email] || "").trim().toLowerCase();
        var existingQuestion = String(row[columnIndex.question_id] || "").trim();
        if ((existingUserId === userId || existingEmail === email) && existingQuestion === questionId) matchingRows.push(offset + 2);
      });
    }

    var targetRow = matchingRows.length ? matchingRows[0] : sheet.getLastRow() + 1;
    for (var index = matchingRows.length - 1; index > 0; index--) {
      sheet.deleteRow(matchingRows[index]);
    }

    var rowValues = new Array(headerRow.length).fill("");
    rowValues[columnIndex.timestamp] = new Date().toISOString();
    rowValues[columnIndex.user_uid] = userId;
    rowValues[columnIndex.user_email] = email;
    rowValues[columnIndex.quiz_mode] = String(data.quiz_mode || "");
    rowValues[columnIndex.question_id] = questionId;
    rowValues[columnIndex.user_answer] = answer.charAt(0).toUpperCase() + answer.slice(1).toLowerCase();
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
    rebuildQuizBenchmarks(sheet, ss);

    return ContentService
      .createTextOutput(JSON.stringify({ result: "success", sheet: "Quiz_Benchmarks", updated: matchingRows.length > 0 }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function verifyQuizUser(idToken) {
  if (!idToken) throw new Error("A Firebase sign-in token is required.");
  var apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_WEB_API_KEY");
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY is not configured.");
  var response = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) throw new Error("Firebase could not verify the sign-in token.");
  var result = JSON.parse(response.getContentText());
  var user = result.users && result.users[0];
  if (!user || !user.localId || !user.email || user.emailVerified !== true) {
    throw new Error("A verified email account is required to contribute to community benchmarks.");
  }
  return { userId: String(user.localId), email: String(user.email).trim().toLowerCase() };
}

function rebuildQuizBenchmarks(privateResponses, publicWorkbook) {
  var lastRow = privateResponses.getLastRow();
  var headers = privateResponses.getRange(1, 1, 1, privateResponses.getLastColumn()).getValues()[0].map(function(value) {
    return String(value || "").trim().toLowerCase();
  });
  var questionColumn = headers.indexOf("question_id");
  var answerColumn = headers.indexOf("user_answer");
  var userColumn = headers.indexOf("user_uid");
  if (questionColumn < 0 || answerColumn < 0 || userColumn < 0) {
    throw new Error("The private Quiz_Responses tab is missing required columns.");
  }

  var counts = {};
  if (lastRow > 1) {
    privateResponses.getRange(2, 1, lastRow - 1, privateResponses.getLastColumn()).getValues().forEach(function(row) {
      var questionId = String(row[questionColumn] || "").trim();
      var answer = String(row[answerColumn] || "").trim().toLowerCase();
      var userId = String(row[userColumn] || "").trim();
      if (!questionId || !userId || (answer !== "yes" && answer !== "no")) return;
      if (!counts[questionId]) counts[questionId] = { yes: 0, no: 0, voters: {} };
      counts[questionId][answer]++;
      counts[questionId].voters[userId] = true;
    });
  }

  var benchmarkSheet = publicWorkbook.getSheetByName("Quiz_Benchmarks");
  if (!benchmarkSheet) benchmarkSheet = publicWorkbook.insertSheet("Quiz_Benchmarks");
  benchmarkSheet.clearContents();
  var output = [["Question_ID", "Yes_Count", "No_Count", "Verified_Voters", "Updated_At"]];
  Object.keys(counts).sort().forEach(function(questionId) {
    var entry = counts[questionId];
    output.push([questionId, entry.yes, entry.no, Object.keys(entry.voters).length, new Date().toISOString()]);
  });
  benchmarkSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  benchmarkSheet.setFrozenRows(1);
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "active", message: "Votalume Discrepancy Reports endpoint is ready." }))
    .setMimeType(ContentService.MimeType.JSON);
}
