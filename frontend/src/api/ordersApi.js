import apiClient from "./apiClient";

export const createOrder = (orderData) => {
  return apiClient.post("/orders", orderData);
};

export const getOrderById = (orderId) => {
  return apiClient.get(`/orders/${orderId}`);
};

export const getAllOrders = () => {
  return apiClient.get("/orders");
};

