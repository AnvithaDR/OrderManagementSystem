import apiClient from "./apiClient";

export const getProducts = () => {
  return apiClient.get("/products");
};
