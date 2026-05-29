import { getAccessToken, zohoBase } from './_zoho.js';

const REPORT_CANDIDATES = [
  'All_Inner_Pack',
  'All_Inner_Packs',
  'Inner_Pack_Report',
  'All_Inner_Pack_Report',
  'Inner_Packs',
  'Inner_Pack',
  'All_InnerPacks',
  'All_Packs',
];

const CRITERIA_FIELDS = [
  'MO_Number',
  'MO',
  'Manufacturing_Order',
  'Manufacturing_Order_ID',
  'MO_ID',
  'Order_Number',
  'Master_MO',
  'Mo_Number',
];

// Zoho codes that mean "report exists, zero matching records"
const EMPTY_CODES = [3000, 3001, 3100, 9280];

async function tryFetch(token, reportName, criteriaField, moNumber) {
  const criteria = encodeURIComponent(`${criteriaField}=="${moNumber}"`);
  const url = `${zohoBase()}/report/${reportName}?criteria=${criteria}&max_records=500`;
  console.log(`[get-inner-packs] Trying report=${reportName} field=${criteriaField}`);
  const zres = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' },
  });
  const raw = await zres.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }
  console.log(`[get-inner-packs] Response:`, { status: zres.status, code: body?.code, message: body?.message });
  return { status: zres.status, body };
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
          console.log(`[get-inner-packs] SUCCESS ${reportName} via ${field} → ${arr.length} records`);
          if (arr.length > 0) {
            console.log(`[get-inner-packs] First record keys:`, Object.keys(arr[0]));
            console.log(`[get-inner-packs] MO-like values:`, {
              MO_Number: arr[0].MO_Number,
              MO: arr[0].MO,
              Manufacturing_Order: arr[0].Manufacturing_Order,
            });
          }
          return res.status(200).json({
            data: arr,
            _meta: { report: reportName, criteriaField: field, count: arr.length },
          });
        }

        // Zoho "no records" codes — report exists, criteria matched nothing or field unknown
        if (status === 400 && body?.code && EMPTY_CODES.includes(body.code)) {
          console.log(`[get-inner-packs] ${reportName} via ${field} → 0 records (code ${body.code})`);
          return res.status(200).json({
            data: [],
            _meta: { report: reportName, criteriaField: field, count: 0, note: 'empty', zohoCode: body.code },
          });
        }

        // 404 = report doesn't exist under that name; try next candidate
        if (status === 404) continue;

        console.warn(`[get-inner-packs] ${reportName} via ${field} → ${status}`, body?.code, body?.message);
      }
    }

    console.log(`[get-inner-packs] no candidate matched for mo=${mo}`);
    return res.status(200).json({
      data: [],
      _meta: { count: 0, note: 'no_report_matched', triedReports: REPORT_CANDIDATES, triedFields: CRITERIA_FIELDS },
    });
  } catch (err) {
    console.error('[get-inner-packs] error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
