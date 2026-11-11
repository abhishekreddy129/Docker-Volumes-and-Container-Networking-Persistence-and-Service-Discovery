import cors from "cors";
import express from "express";
import pg from "pg";

const app = express();
const port = Number(process.env.PORT || 5000);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// Retry connecting and creating the table until PostgreSQL is ready
async function initDB() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          text VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      );
      console.log("Database ready");
      return;
    } catch (err) {
      console.log(`Waiting for database... (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error("Could not connect to the database after 10 attempts");
}

initDB();

app.get("/api/messages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM messages ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/messages", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  try {
    const result = await pool.query(
      "INSERT INTO messages (text) VALUES ($1) RETURNING *",
      [text]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`FeedBox API listening on port ${port}`);
});
