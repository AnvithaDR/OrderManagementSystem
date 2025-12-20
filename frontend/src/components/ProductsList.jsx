import { useEffect, useState } from "react";
import { getProducts } from "../api/productsApi";
import CreateOrder from "./CreateOrder";


function ProductsList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProducts()
      .then((res) => {
        setProducts(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load products");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading products...</p>;
  }

  if (error) {
    return <p style={{ color: "red" }}>{error}</p>;
  }

  return (
  <div>
    <h2>Products</h2>

    {products.length === 0 ? (
      <p>No products available</p>
    ) : (
      <>
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              <strong>{product.name}</strong> – ₹{product.price}  
              (Stock: {product.quantity})
            </li>
          ))}
        </ul>

        {/* Create Order Section */}
        <CreateOrder products={products} />
      </>
    )}
  </div>
);

}

export default ProductsList;
