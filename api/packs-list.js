import { getAccessToken, invalidateToken, zohoBase } from './_zoho.js';

// Confirmed Zoho report link names (ZOHO-verified, no fallback needed).
const REPORT_CANDIDATES = {
  inner: ['All_Inner_Pack'],
  master: ['All_Master_Bags'],
};

// Confirmed MO criteria field (ZOHO-verified).
const CRITERIA_FIELDS = ['MO_Number'];

async function zohoFetch(token, reportName, criteriaField, moNumber) {
  const criteria = encodeURIComponent(`${criteriaField}=="${moNumber}"`);
  const url = `${zohoBase()}/report/${reportName}?criteria=${criteria}&max_records=500`;
  const zres = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' },
  });
  const raw = await zres.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }
  return { status: zres.status, body };
}

// Fetch with 401 → invalidate + refresh + retry once.
async function fetchWithRetry(reportName, criteriaField, moNumber) {
  let token = await getAccessToken();
  console.log(`[packs-list] TRY report=${reportName} field=${criteriaField}`);
  let { status, body } = await zohoFetch(token, reportName, criteriaField, moNumber);

  if (status === 401) {
    console.log(`[packs-list] 401 (code ${body?.code}) — invalidating token, retrying once`);
    invalidateToken();
    token = await getAccessToken();
    ({ status, body } = await zohoFetch(token, reportName, criteriaField, moNumber));
    console.log(`[packs-list] retry result: status=${status} code=${body?.code}`);
  }

  return { status, body };
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

    const reportName = REPORT_CANDIDATES[type][0];
    const field = CRITERIA_FIELDS[0];

    const { status, body } = await fetchWithRetry(reportName, field, mo);

    // Success
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

    // Zoho "no records found" — confirmed report+field, so this is genuinely empty
    if (status === 400 && body?.code && [3000, 3001, 3100, 9280].includes(body.code)) {
      console.log(`[packs-list] EMPTY type=${type} report=${reportName} field=${field} code=${body.code}`);
      return res.status(200).json({
        data: [],
        _meta: { report: reportName, criteriaField: field, count: 0, note: 'empty', zohoCode: body.code },
      });
    }

    // Unexpected status after retry
    console.error(`[packs-list] FAIL type=${type} report=${reportName} field=${field} status=${status}`, body?.code, body?.message);
    return res.status(200).json({
      data: [],
      _meta: { count: 0, note: 'unexpected_error', status, zohoCode: body?.code, message: body?.message },
    });
  } catch (err) {
    console.error('[packs-list] error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
