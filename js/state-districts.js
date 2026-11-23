/**
 * VOTALUME — State & Congressional District Directory
 * Supports both 119th Congress (2025–2026) and post-Jan 2027 120th Congress redistricting.
 */

const VOTALUME_STATES = [
  { code: "AL", name: "Alabama", districts119: 7, districts120: 7 },
  { code: "AK", name: "Alaska", districts119: 1, districts120: 1, atLarge: true },
  { code: "AZ", name: "Arizona", districts119: 9, districts120: 9 },
  { code: "AR", name: "Arkansas", districts119: 4, districts120: 4 },
  { code: "CA", name: "California", districts119: 52, districts120: 52 },
  { code: "CO", name: "Colorado", districts119: 8, districts120: 8 },
  { code: "CT", name: "Connecticut", districts119: 5, districts120: 5 },
  { code: "DE", name: "Delaware", districts119: 1, districts120: 1, atLarge: true },
  { code: "FL", name: "Florida", districts119: 28, districts120: 28 },
  { code: "GA", name: "Georgia", districts119: 14, districts120: 14 },
  { code: "HI", name: "Hawaii", districts119: 2, districts120: 2 },
  { code: "ID", name: "Idaho", districts119: 2, districts120: 2 },
  { code: "IL", name: "Illinois", districts119: 17, districts120: 17 },
  { code: "IN", name: "Indiana", districts119: 9, districts120: 9 },
  { code: "IA", name: "Iowa", districts119: 4, districts120: 4 },
  { code: "KS", name: "Kansas", districts119: 4, districts120: 4 },
  { code: "KY", name: "Kentucky", districts119: 6, districts120: 6 },
  { code: "LA", name: "Louisiana", districts119: 6, districts120: 6 },
  { code: "ME", name: "Maine", districts119: 2, districts120: 2 },
  { code: "MD", name: "Maryland", districts119: 8, districts120: 8 },
  { code: "MA", name: "Massachusetts", districts119: 9, districts120: 9 },
  { code: "MI", name: "Michigan", districts119: 13, districts120: 13 },
  { code: "MN", name: "Minnesota", districts119: 8, districts120: 8 },
  { code: "MS", name: "Mississippi", districts119: 4, districts120: 4 },
  { code: "MO", name: "Missouri", districts119: 8, districts120: 8 },
  { code: "MT", name: "Montana", districts119: 2, districts120: 2 },
  { code: "NE", name: "Nebraska", districts119: 3, districts120: 3 },
  { code: "NV", name: "Nevada", districts119: 4, districts120: 4 },
  { code: "NH", name: "New Hampshire", districts119: 2, districts120: 2 },
  { code: "NJ", name: "New Jersey", districts119: 12, districts120: 12 },
  { code: "NM", name: "New Mexico", districts119: 3, districts120: 3 },
  { code: "NY", name: "New York", districts119: 26, districts120: 26 },
  { code: "NC", name: "North Carolina", districts119: 14, districts120: 14 },
  { code: "ND", name: "North Dakota", districts119: 1, districts120: 1, atLarge: true },
  { code: "OH", name: "Ohio", districts119: 15, districts120: 15 },
  { code: "OK", name: "Oklahoma", districts119: 5, districts120: 5 },
  { code: "OR", name: "Oregon", districts119: 6, districts120: 6 },
  { code: "PA", name: "Pennsylvania", districts119: 17, districts120: 17 },
  { code: "RI", name: "Rhode Island", districts119: 2, districts120: 2 },
  { code: "SC", name: "South Carolina", districts119: 7, districts120: 7 },
  { code: "SD", name: "South Dakota", districts119: 1, districts120: 1, atLarge: true },
  { code: "TN", name: "Tennessee", districts119: 9, districts120: 9 },
  { code: "TX", name: "Texas", districts119: 38, districts120: 38 },
  { code: "UT", name: "Utah", districts119: 4, districts120: 4 },
  { code: "VT", name: "Vermont", districts119: 1, districts120: 1, atLarge: true },
  { code: "VA", name: "Virginia", districts119: 11, districts120: 11 },
  { code: "WA", name: "Washington", districts119: 10, districts120: 10 },
  { code: "WV", name: "West Virginia", districts119: 2, districts120: 2 },
  { code: "WI", name: "Wisconsin", districts119: 8, districts120: 8 },
  { code: "WY", name: "Wyoming", districts119: 1, districts120: 1, atLarge: true }
];

if (typeof window !== "undefined") {
  window.VOTALUME_STATES = VOTALUME_STATES;
}
