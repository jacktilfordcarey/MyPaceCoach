import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { Sequelize } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, '..', '.env') });

const connectionUrl = process.env.DATABASE_URL;
if (!connectionUrl) {
  console.error('MISSING_DATABASE_URL');
  process.exit(1);
}

const sequelize = new Sequelize(connectionUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

try {
  await sequelize.authenticate();
  console.log('DB_OK');

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL DEFAULT 'training',
      race_type VARCHAR(255),
      target_time VARCHAR(255),
      event_date TIMESTAMPTZ NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const [rows] = await sequelize.query(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'calendar_events'"
  );

  console.log('TABLE_READY');
  console.log('CHECK_ROWS', rows.length);
} catch (error) {
  console.error('MIGRATION_FAIL');
  console.error(error.message);
  process.exit(1);
} finally {
  await sequelize.close();
}
