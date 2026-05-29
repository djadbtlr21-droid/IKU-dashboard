import { getAccessToken, zohoBase } from './_zoho.js';

// Probe multiple Zoho report name candidates (first 200-OK wins).
const REPORT_CANDIDATES = [
  'All_Production_Log',
  'All_Production_Logs',
  'Production_Log',
  'Production_Logs',
  'All_Production_Records',
  'Production_Records',
];

// Probe MO criteria field name — Zoho Creator link names vary by schema.
const CRITERIA_FIELDS = ['MO_Number', 'MO', 'Manufacturing_Order', 'MO_ID'];

async function tryFetch(token, reportName, criteriaField, moNumber) {
  const criteria = encodeURIComponent(`${criteriaField}=="${moNumber}"`);
  const url = `${zohoBase()}/report/${reportName}?criteria=${criteria}&max_records=500`;
  const zres = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' },
  });
  const raw = await zres.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }
  return { status: zres.status, body, url };
}

export default async function handler(req, res) {
  try {
    const mo = req.query?.mo;
    if (!mo) return res.status(400).json({ error: 'Missing mo query param' });

    const token = await getAccessToken();

    for (const reportName of REPORT_CANDIDATES) {
      for (const field of CRITERIA_FIELDS) {
        const { status, body } = await tryFetch(token, reportName, field, mo);

        if (status === 200) {
          const arr = body?.data || [];
          console.log(`[get-production-logs] ${reportName} via ${field} → ${arr.length} records`);
          return res.status(200).json({
            data: arr,
            _meta: { report: reportName, criteriaField: field, count: arr.length },
          });
        }

        // Zoho 400 codes 3000/3001/3100 = report exists but no matching records
        if (status === 400 && body?.code && [3000, 3001, 3100].includes(body.code)) {
          console.log(`[get-production-logs] ${reportName} via ${field} → 0 records (code ${body.code})`);
          return res.status(200).json({
            data: [],
            _meta: { report: reportName, criteriaField: field, count: 0, note: 'empty' },
          });
        }

        // 404 = report doesn't exist under that name; try next candidate
        if (status === 404) continue;

        console.warn(`[get-production-logs] ${reportName} via ${field} → ${status}`, body?.code, body?.message);
      }
    }

    console.log(`[get-production-logs] no candidate matched for mo=${mo}`);
    return res.status(200).json({
      data: [],
      _meta: { count: 0, note: 'no_report_matched', triedReports: REPORT_CANDIDATES, triedFields: CRITERIA_FIELDS },
    });
  } catch (err) {
    console.error('[get-production-logs] error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
