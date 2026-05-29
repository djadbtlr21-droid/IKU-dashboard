import { getAccessToken, zohoBase } from './_zoho.js';

// Map type → Zoho report names to try (in order). First successful one wins.
const REPORT_CANDIDATES = {
  inner: ['All_Inner_Pack', 'All_Inner_Packs', 'Inner_Pack_Report', 'All_InnerPacks', 'Inner_Packs', 'All_Packs'],
  master: ['All_Master_Bags', 'All_Master_Bag', 'Master_Bags_Report', 'All_MasterBags', 'Master_Bags', 'All_Bags'],
};

// MO criteria field candidates — Zoho schema may use different lookup field names.
const CRITERIA_FIELDS = [
  'MO_Number', 'MO', 'Manufacturing_Order', 'Manufacturing_Order_ID',
  'MO_ID', 'Order_Number', 'Master_MO', 'Mo_Number',
];

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

    // Probe report × field combinations until one returns data (or all 404)
    for (const reportName of reports) {
      for (const field of CRITERIA_FIELDS) {
        const { status, body, url } = await tryFetch(token, reportName, field, mo);

        if (status === 200) {
          const arr = body?.data || [];
          console.log(`[packs-list] ${reportName} via ${field} → ${arr.length} records`);
          return res.status(200).json({
            data: arr,
            _meta: { report: reportName, criteriaField: field, count: arr.length },
          });
        }

        // 400 with these codes means "no records" or "criteria field unknown" — treat as empty
        if (status === 400 && body?.code && [3000, 3001, 3100, 9280].includes(body.code)) {
          console.log(`[packs-list] ${reportName} via ${field} → 0 records (code ${body.code})`);
          return res.status(200).json({
            data: [],
            _meta: { report: reportName, criteriaField: field, count: 0, note: 'empty' },
          });
        }

        // 404 = report doesn't exist with that name; try next candidate
        if (status === 404) continue;

        // Other errors — log and continue
        console.warn(`[packs-list] ${reportName} via ${field} → ${status}`, body?.code, body?.message);
      }
    }

    // All candidates failed — return empty (UI handles "no data" gracefully)
    console.log(`[packs-list] no candidate matched for mo=${mo} type=${type}`);
    return res.status(200).json({
      data: [],
      _meta: { count: 0, note: 'no_report_matched', triedReports: reports, triedFields: CRITERIA_FIELDS },
    });
  } catch (err) {
    console.error('[packs-list] error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
