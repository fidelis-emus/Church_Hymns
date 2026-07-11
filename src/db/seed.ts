import pg from 'pg';
import dotenv from 'dotenv';
import { generateSeedHymns } from './seed_hymns.ts';

dotenv.config();

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL;

const DDL = `
CREATE TABLE IF NOT EXISTS hymns (
  id SERIAL PRIMARY KEY,
  hymn_number INTEGER UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  lyrics TEXT NOT NULL,
  chorus TEXT,
  category VARCHAR(255) NOT NULL,
  language VARCHAR(100) DEFAULT 'English',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function seed() {
  if (!dbUrl) {
    console.error('Error: DATABASE_URL is not set. Cannot seed PostgreSQL.');
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL to run migrations and seed hymns...');
  const useSsl = !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('::1');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();

  try {
    // 1. Run migrations first (ensure hymns table exists)
    console.log('Running migrations (creating table if not exists)...');
    await client.query(DDL);
    console.log('Migrations completed successfully.');

    // 2. Check if hymns table exists and count records
    const checkTableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'hymns'
      )
    `);
    
    if (!checkTableRes.rows[0].exists) {
      console.log('Hymns table does not exist. (Unexpected, should have been created by DDL)');
      process.exit(1);
    }

    const countRes = await client.query('SELECT COUNT(*) FROM hymns');
    const hymnsCount = parseInt(countRes.rows[0].count, 10);
    console.log(`Current record count in hymns table: ${hymnsCount}`);

    // 3. Seed if and only if the table is empty
    if (hymnsCount === 0) {
      console.log('Hymns table is empty. Generating and importing 2,000 hymns...');
      const seedHymns = generateSeedHymns();
      const totalToImport = seedHymns.length;

      // Bulk insert in batches of 200
      const batchSize = 200;
      for (let i = 0; i < seedHymns.length; i += batchSize) {
        const batch = seedHymns.slice(i, i + batchSize);
        const valueClauses: string[] = [];
        const params: any[] = [];

        batch.forEach((h, idx) => {
          const base = idx * 6;
          valueClauses.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`);
          params.push(h.hymnNumber, h.title, h.lyrics, h.chorus || null, h.category, h.language);
        });

        const bulkQuery = `INSERT INTO hymns (hymn_number, title, lyrics, chorus, category, language) VALUES ${valueClauses.join(', ')}`;
        await client.query(bulkQuery, params);
      }

      console.log(`Successfully imported ${totalToImport} hymns into PostgreSQL.`);
    } else {
      console.log('Hymns table already contains records. Seeding skipped to avoid duplicates.');
    }
  } catch (error) {
    console.error('Error during database checking/seeding:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
