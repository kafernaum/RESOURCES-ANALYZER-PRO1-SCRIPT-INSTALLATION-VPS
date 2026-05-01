import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rap_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      const here = window.location.pathname;
      if (!here.includes("/login") && !here.includes("/register") && here !== "/") {
        localStorage.removeItem("rap_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);
