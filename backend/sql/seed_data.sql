INSERT INTO products (product_code, name, description, price, status) VALUES
('P-100','Pen','Blue ink pen', 5.00, 'ACTIVE'),
('P-200','Notebook','A4 ruled notebook', 45.50, 'ACTIVE'),
('P-300','Stapler','Standard stapler', 150.00, 'ACTIVE')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT INTO customers (name, email, phone) VALUES
('Alice Johnson', 'alice@example.com', '9999000011'),
('Bob Kumar', 'bob@example.com', '9999000022')
ON DUPLICATE KEY UPDATE name=VALUES(name);
