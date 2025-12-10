// server.js (OMS backend)

// 1) Load libraries
const express = require("express");      // Express framework
const library = express;                // alias, for your understanding
const cors = require("cors");           // allow frontend to call backend
const mysql = require("mysql2");        // MySQL client
const dotenv = require("dotenv");       // load .env file

// 2) Load environment variables from .env
dotenv.config();

// 3) Create app (backend server)
const app = library();

// 4) Choose port
const PORT = 5000;

// 5) Middlewares
app.use(cors());              // allow cross-origin requests
app.use(express.json());      // parse JSON in request body

// 6) Create MySQL connection pool (like a reusable DB connection manager)
const pool = mysql.createPool({
  host: process.env.DB_HOST,       // 127.0.0.1
  user: process.env.DB_USER,       // root
  password: process.env.DB_PASSWORD, // admin123
  database: process.env.DB_NAME,   // oms_db
  port: process.env.DB_PORT,       // 3306
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 7) Test DB connection once at startup
pool.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error connecting to MySQL:", err.message);
  } else {
    console.log("✅ Connected to MySQL successfully");
    connection.release();
  }
});

// 8) Root route (already working)
app.get("/", (req, res) => {
  res.send("Order Management System Backend Running!");
});

// 9) Health-check API
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Order Management System Backend",
    time: new Date().toISOString(),
  });
});

// 🔟 NEW: Get all ACTIVE products from DB
app.get("/api/products", (req, res) => {
  const sql = `
    SELECT id, product_code, name, description, price, status, created_at
    FROM products
    WHERE status = 'ACTIVE'
  `;

  pool.query(sql, (err, results) => {
    if (err) {
      console.error("❌ Error fetching products:", err.message);
      return res.status(500).json({ error: "Failed to fetch products" });
    }

    // results is an array of rows from the products table
    res.json(results);
  });
});

// Create product (Add Product)
app.post("/api/products", (req, res) => {
  const { product_code, name, description = "", price, status = "ACTIVE" } = req.body;

  if (!product_code || !name || typeof price === "undefined") {
    return res.status(400).json({ error: "product_code, name, and price are required" });
  }

  const sql = `
    INSERT INTO products (product_code, name, description, price, status)
    VALUES (?, ?, ?, ?, ?)
  `;

  pool.query(
    sql,
    [product_code, name, description, price, status],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ error: "product_code must be unique" });
        }
        return res.status(500).json({ error: "Failed to add product" });
      }

      const insertedId = result.insertId;

      pool.query(
        "SELECT * FROM products WHERE id = ?",
        [insertedId],
        (err, rows) => {
          if (err) return res.status(500).json({ error: "Failed to fetch created product" });

          res.status(201).json(rows[0]);
        }
      );
    }
  );
});

// 11) Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
