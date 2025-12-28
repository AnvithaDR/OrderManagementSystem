// server.js (OMS backend) - ES module version

import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "127.0.0.1",
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "oms_db",
  port: Number(process.env.DB_PORT ?? 3306),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Test DB connection on startup
(async () => {
  try {
    const conn = await pool.getConnection();
    conn.release();
    console.log("✅ Connected to MySQL successfully");
  } catch (err) {
    console.error("❌ Error connecting to MySQL:", err?.message ?? err);
  }
})();

// Root & health routes
app.get("/", (req, res) => res.send("Order Management System Backend Running!"));

app.get("/api/health", (req, res) =>
  res.status(200).json({
    status: "ok",
    service: "Order Management System Backend",
    time: new Date().toISOString(),
    
  })
);

// Get active products with stock
app.get("/api/products", async (req, res) => {
  const sql = `
    SELECT
      p.id,
      p.product_code,
      p.name,
      p.description,
      p.price,
      p.status,
      p.created_at,
      IFNULL(i.quantity, 0) AS quantity
    FROM products p
    LEFT JOIN inventory i
      ON p.id = i.product_id
    WHERE p.status = 'ACTIVE'
  `;

  try {
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching products:", err?.message ?? err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});


// Create product
app.post("/api/products", async (req, res) => {
  const { product_code, name, description = "", price, status = "ACTIVE" } = req.body;
  if (!product_code || !name || typeof price === "undefined") {
    return res.status(400).json({ error: "product_code, name, and price are required" });
  }

  const sql = `
    INSERT INTO products (product_code, name, description, price, status)
    VALUES (?, ?, ?, ?, ?)
  `;
  try {
    const [result] = await pool.execute(sql, [product_code, name, description, price, status]);
    const insertedId = result.insertId;
    const [rows] = await pool.query("SELECT * FROM products WHERE id = ?", [insertedId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ Error creating product:", err?.message ?? err);
    if (err?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "product_code must be unique" });
    res.status(500).json({ error: "Failed to add product" });
  }
});

// Test DB route
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS result");
    res.json({ message: "DB connection successful", rows });
  } catch (err) {
    console.error("❌ Test DB query error:", err?.message ?? err);
    res.status(500).json({ message: "DB connection failed", error: err?.message ?? err });
  }
});

// Get all orders
app.get("/api/orders", async (req, res) => {
  const sql = `
    SELECT
      o.id,
      o.customer_id,
      o.total_amount,
      o.status,
      o.created_at
    FROM orders o
    ORDER BY o.created_at DESC
  `;

  try {
    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching orders:", err?.message ?? err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id  -> return order with items and customer
app.get("/api/orders/:id", async (req, res) => {
  const orderId = Number(req.params.id || 0);
  if (!orderId) return res.status(400).json({ error: "Invalid order id" });

  try {
    // 1) fetch order + customer
    const [orderRows] = await pool.query(
      `SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at,
              c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ? LIMIT 1`,
      [orderId]
    );

    if (!orderRows || orderRows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = orderRows[0];

        // 2) fetch items for the order (with product details)
    const [items] = await pool.query(
      `SELECT oi.id,
              oi.product_id,
              oi.quantity AS qty,
              oi.unit_price AS price,
              p.product_code,
              p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    // 3) respond
    res.json({
      id: order.id,
      customer: {
        id: order.customer_id,
        name: order.customer_name,
        email: order.customer_email,
        phone: order.customer_phone
      },
      total_amount: order.total_amount,
      status: order.status,
      created_at: order.created_at,
      items: items || []
    });
  } catch (err) {
    console.error("❌ GET /api/orders/:id error:", err?.message ?? err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /api/orders  -> create an order with items (transactional)
app.post("/api/orders", async (req, res) => {
  const { customer_id, items } = req.body;

  // Basic validation
  if (!customer_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "customer_id and items[] are required" });
  }

  // Validate each item shape: { product_id, quantity, unit_price (optional) }
  for (const it of items) {
    if (!it.product_id || !Number.isInteger(it.quantity) || it.quantity <= 0) {
      return res.status(400).json({ error: "Each item must have product_id and positive integer quantity" });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Calculate total_amount (if client didn't provide unit_price, fetch from products)
    let totalAmount = 0;
    const preparedItems = [];

    for (const it of items) {
      // fetch product price if unit_price is not provided
      let unitPrice = it.unit_price;
      if (typeof unitPrice === "undefined" || unitPrice === null) {
        const [rows] = await conn.query("SELECT price FROM products WHERE id = ? LIMIT 1", [it.product_id]);
        if (!rows || rows.length === 0) throw new Error(`Product ${it.product_id} not found`);
        unitPrice = Number(rows[0].price);
      }

      // check inventory
      const [invRows] = await conn.query("SELECT quantity FROM inventory WHERE product_id = ? LIMIT 1", [it.product_id]);
      const available = invRows && invRows.length ? Number(invRows[0].quantity) : 0;
      if (available < it.quantity) {
        throw new Error(`Insufficient stock for product ${it.product_id}. Available: ${available}`);
      }

      const lineTotal = Number(unitPrice) * Number(it.quantity);
      totalAmount += lineTotal;

      preparedItems.push({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: unitPrice,
      });
    }

    // 1) create order
    const [orderResult] = await conn.execute(
      `INSERT INTO orders (customer_id, order_date, status, total_amount, created_at)
       VALUES (?, NOW(), ?, ?, NOW())`,
      [customer_id, "NEW", totalAmount]
    );
    const orderId = orderResult.insertId;

    // 2) insert order_items & decrement inventory
    for (const pi of preparedItems) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES (?, ?, ?, ?)`,
        [orderId, pi.product_id, pi.quantity, pi.unit_price]
      );

      // decrement inventory
      await conn.execute(
        `UPDATE inventory SET quantity = quantity - ? WHERE product_id = ?`,
        [pi.quantity, pi.product_id]
      );
    }

    await conn.commit();

    // fetch created order (reuse GET route structure)
    const [orderRows] = await pool.query(
      `SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at,
              c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ? LIMIT 1`,
      [orderId]
    );
    const [itemsRows] = await pool.query(
      `SELECT oi.id, oi.product_id, oi.quantity AS qty, oi.unit_price AS price,
              p.product_code, p.name AS product_name
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    res.status(201).json({
      order: orderRows[0],
      items: itemsRows
    });
  } catch (err) {
    await conn.rollback();
    console.error("❌ POST /api/orders error:", err?.message ?? err);
    // give useful message for client (but hide stack)
    return res.status(400).json({ error: err?.message ?? "Failed to create order" });
  } finally {
    conn.release();
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
