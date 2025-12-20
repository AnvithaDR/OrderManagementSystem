import { useEffect, useState } from "react";
import { getOrderById } from "../api/ordersApi";

function OrderDetails() {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrderById(1)
      .then((res) => {
        setOrder(res.data);
      })
      .catch(() => {
        setError("Failed to load order details");
      });
  }, []);

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  if (!order) {
    return <p>Loading order details...</p>;
  }

  return (
    <div style={{ marginTop: "20px" }}>
      <h2>Order Details</h2>

      <p><strong>Order ID:</strong> {order.id}</p>
      <p><strong>Customer:</strong> {order.customer.name}</p>
      <p><strong>Total Amount:</strong> ₹{order.total_amount}</p>

      <h3>Items</h3>
      <ul>
        {order.items.map((item) => (
          <li key={item.id}>
            {item.product_name} – Qty: {item.qty}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default OrderDetails;
