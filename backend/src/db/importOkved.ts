import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.resolve(__dirname, '../../data/okved.csv');

type OkvedRow = {
  code: string;
  name: string;
};

function parseCsvLine(line: string): OkvedRow | null {
  const match = line.match(/^"([^"]*)";"([^"]*)";"([\s\S]*)"$/);

  if (!match) {
    return null;
  }

  const rawCode = match[2];
  const rawName = match[3];

  if (rawCode === undefined || rawName === undefined) {
    return null;
  }

  const code = rawCode.trim();
  const name = rawName.trim();

  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
  };
}

function getLevel(code: string): number {
  return code.split('.').length;
}

async function importOkved() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Файл ОКВЭД не найден: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf8');

  const rows: OkvedRow[] = [];

  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }

    const row = parseCsvLine(line);

    if (row) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new Error('В CSV не найдено ни одной записи ОКВЭД');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('TRUNCATE TABLE okved');

    for (const row of rows) {
      await client.query(
        `
        INSERT INTO okved (code, name, level)
        VALUES ($1, $2, $3)
        `,
        [
          row.code,
          row.name,
          getLevel(row.code),
        ],
      );
    }

    /*
     * Конечный код — тот, для которого нет более подробного
     * дочернего кода.
     *
     * Например:
     * 01.11 -> не конечный,
     * потому что существует 01.11.1.
     *
     * 01.11.1 -> конечный,
     * если более глубоких кодов для него нет.
     */
    await client.query(`
      UPDATE okved o
      SET is_leaf = NOT EXISTS (
        SELECT 1
        FROM okved child
        WHERE child.code LIKE o.code || '.%'
      )
    `);

    await client.query('COMMIT');

    const countResult = await client.query<{
      total: string;
      leaves: string;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE is_leaf)::text AS leaves
      FROM okved
    `);

    const stats = countResult.rows[0];

    console.log(
      `[okved] импортировано: ${stats?.total ?? 0}, конечных кодов: ${stats?.leaves ?? 0}`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

importOkved()
  .catch((error) => {
    console.error('[okved] ошибка импорта:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });