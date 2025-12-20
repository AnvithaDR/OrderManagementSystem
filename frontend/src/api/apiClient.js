import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:5000/api", // change port if needed
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
