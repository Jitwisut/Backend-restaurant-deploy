import pkg from "pg";
const { Pool } = pkg;

// ประกาศ pool ตัวเดียว (global)
let pool: any = null;

// ฟังก์ชัน getDB
export function getDB() {
  if (!pool) {
    pool = new Pool({
      connectionString: Bun.env.DATABASE_URL_test,
    });
    console.log("✅ DB Connected");
  }
  return pool;
}

export const db = getDB();
