import { google } from 'googleapis';
const data = google.analyticsdata('v1beta');
console.log('runReport exists:', typeof data.properties.runReport);
