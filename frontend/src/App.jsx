import ProductsList from "./components/ProductsList";
import OrderDetails from "./components/OrderDetails";
import OrdersList from "./components/OrdersList";


import "./App.css";

function App() {
  return (
    <div>
      <h1>Order Management System</h1>

      <ProductsList />
      <OrderDetails />

      {/* Temporary: Orders list check */}
      <OrdersList />
    </div>
  );
}



export default App;
