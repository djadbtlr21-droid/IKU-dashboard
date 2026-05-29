import { getAccessToken, zohoBase } from './_zoho.js';

// Map type → Zoho report names to try (in order). First successful one wins.
const REPORT_CANDIDATES = {
  inner: ['All_Inner_Pack', 'All_Inner_Packs', 'Inner_Pack_Report', 'Add_Inner_Pack_Report', 'All_InnerPacks', 'Inner_Packs', 'All_Packs'],
  master: ['All_Master_Bags', 'All_Master_Bag', 'Master_Bags_Report', 'All_MasterBags', 'Master_Bags', 'All_Bags'],
};

// MO criteria field candidates — try in order, first non-empty wins.
const CRITERIA_FIELDS = [
  'MO_Number', 'MO', 'Manufacturing_Order', 'Manufacturing_Order_ID',
  'MO_ID', 'Order_Number', 'Master_MO', 'Mo_Number',
];

// Zoho codes that mean "report exists, zero matching records for this criteria"
const EMPTY_CODES = [3000, 3001, 3100, 9280];

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
    const type = req.query?.type;

    if (!mo || !type) {
      return res.status(400).json({ error: 'Missing mo or type query param' });
    }
    if (!REPORT_CANDIDATES[type]) {
      return res.status(400).json({ error: `Invalid type "${type}" — expected inner or master` });
    }

    const token = await getAccessToken();
    const reports = REPORT_CANDIDATES[type];

    // Probe report × field combinations until one returns data (or all exhausted)
    for (const reportName of reports) {
      for (const field of CRITERIA_FIELDS) {
        console.log(`[packs-list] TRY type=${type} report=${reportName} field=${field}`);
        const { status, body } = await tryFetch(token, reportName, field, mo);

        if (status === 200) {
          const arr = body?.data || [];
          console.log(`[packs-list] SUCCESS type=${type} report=${reportName} field=${field} count=${arr.length}`);
          if (arr.length > 0) {
            console.log(`[packs-list] sample keys:`, Object.keys(arr[0]).slice(0, 20));
          }
          return res.status(200).json({
            data: arr,
            _meta: { report: reportName, criteriaField: field, count: arr.length },
          });
        }

        // Zoho "no records" — continue to next field/report instead of returning early,
        // so we can distinguish "wrong field name" from "truly empty" after exhausting all.
        if (status === 400 && body?.code && EMPTY_CODES.includes(body.code)) {
          console.log(`[packs-list] EMPTY type=${type} report=${reportName} field=${field} code=${body.code} — continuing`);
          continue;
        }

        // 404 = report doesn't exist under that name; try next report
        if (status === 404) {
          console.log(`[packs-list] 404 type=${type} report=${reportName} — report not found, skip`);
          break; // break inner loop (field), try next report
        }

        // Other errors — log and continue
        console.warn(`[packs-list] WARN type=${type} report=${reportName} field=${field} status=${status}`, body?.code, body?.message);
      }
    }

    // All candidates exhausted — return empty
    console.log(`[packs-list] EXHAUSTED type=${type} mo=${mo} — returning empty`);
    return res.status(200).json({
      data: [],
      _meta: { count: 0, note: 'no_records_found', triedReports: reports, triedFields: CRITERIA_FIELDS },
    });
  } catch (err) {
    console.error('[packs-list] error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
