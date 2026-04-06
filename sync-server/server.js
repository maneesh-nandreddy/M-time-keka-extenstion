const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

app.post('/api/sync-salary', async (req, res) => {
  const { data } = req.body;
  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Data must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of data) {
      const query = `
        INSERT INTO remuneration (
          id, identifier, effective_from, is_current, is_revision_on_hold,
          approval_status, salary_amount, monthly_ctc, bonuses,
          earned_bonuses, others, benefit_items, perks, total,
          currency_code, country_code, legal_entity_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) ON CONFLICT (id) DO UPDATE SET
          identifier = EXCLUDED.identifier,
          effective_from = EXCLUDED.effective_from,
          is_current = EXCLUDED.is_current,
          is_revision_on_hold = EXCLUDED.is_revision_on_hold,
          approval_status = EXCLUDED.approval_status,
          salary_amount = EXCLUDED.salary_amount,
          monthly_ctc = EXCLUDED.monthly_ctc,
          bonuses = EXCLUDED.bonuses,
          earned_bonuses = EXCLUDED.earned_bonuses,
          others = EXCLUDED.others,
          benefit_items = EXCLUDED.benefit_items,
          perks = EXCLUDED.perks,
          total = EXCLUDED.total,
          currency_code = EXCLUDED.currency_code,
          country_code = EXCLUDED.country_code,
          legal_entity_name = EXCLUDED.legal_entity_name;
      `;
      const values = [
        item.id, item.identifier, item.effectiveFrom, item.isCurrent, item.isRevisionOnHold,
        item.approvalStatus, item.salaryAmount, item.monthlyCTC, JSON.stringify(item.bonuses),
        JSON.stringify(item.earnedBonuses), JSON.stringify(item.others), JSON.stringify(item.benefitItems),
        JSON.stringify(item.perks), item.total, item.currencyCode, item.countryCode, item.legalEntityName
      ];
      await client.query(query, values);
    }
    await client.query('COMMIT');
    res.json({ success: true, count: data.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[sync-error]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Sync server running on http://localhost:${PORT}`);
});
