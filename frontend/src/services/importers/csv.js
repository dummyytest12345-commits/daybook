import Papa from 'papaparse'

/** Parse a CSV File or string. Returns { headers, rows } (rows keyed by header). */
export function parseCsv(input) {
  return new Promise((resolve, reject) => {
    Papa.parse(input, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.replace(/^﻿/, '').trim(),
      complete: (res) => resolve({ headers: res.meta.fields || [], rows: res.data, parseErrors: res.errors }),
      error: reject,
    })
  })
}

export const SAMPLE_CSV = [
  'Date,Task,Status,Hours,Module,Ticket',
  '2026-09-01,"Fix profile bug\nReview consent copy",Completed,,Profile,73',
  '2026-09-02,Responsive pass on dashboard,Working,4,Responsive,FE-122',
  '2026-09-03,Write test cases,Pending,2,Testing,',
].join('\r\n')
