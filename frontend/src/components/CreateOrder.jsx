import { useState } from "react";
import { createOrder } from "../api/ordersApi";

function CreateOrder({ products }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // 🔹 Get selected product & stock
  const selectedProduct = products.find(
    (p) => p.id === Number(selectedProductId)
  );

  const availableStock = selectedProduct ? selectedProduct.quantity : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!selectedProductId) {
      setError("Please select a product");
      return;
    }

    if (quantity > availableStock) {
      setError(`Only ${availableStock} items available in stock`);
      return;
    }

    try {
      const orderData = {
        customer_id: 1,
        items: [
          {
            product_id: Number(selectedProductId),
            quantity: Number(quantity),
          },
        ],
      };

      await createOrder(orderData);
      setMessage("✅ Order placed successfully");
      setQuantity(1);
      setSelectedProductId("");
    } catch (err) {
      setError(err.response?.data?.error || "❌ Failed to place order");
    }
  };

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Create Order</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>Product: </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">-- Select Product --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Stock: {p.quantity})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: "10px" }}>
          <label>Quantity: </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>

        {/* 🔴 Stock warning */}
        {selectedProduct && quantity > availableStock && (
          <p style={{ color: "red" }}>
            Quantity exceeds available stock ({availableStock})
          </p>
        )}

        <button
          style={{ marginTop: "10px" }}
          type="submit"
          disabled={!selectedProduct || quantity > availableStock}
        >
          Place Order
        </button>
      </form>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}

export default CreateOrder;
