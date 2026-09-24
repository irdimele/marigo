import axios from "axios";
import { getAccessToken, getRefreshToken, logout } from "./auth";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  // Required for Django session cookie (guest cart) on any cross-origin setup.
  withCredentials: true,
});

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Attach JWT when present; on unsafe methods also send Django's csrftoken
// (SessionAuthentication enforces CSRF for session-authenticated requests).
client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    const csrf = readCookie("csrftoken");
    if (csrf) {
      config.headers["X-CSRFToken"] = csrf;
    }
  }
  return config;
});

// Response interceptor: on 401, attempt a single token refresh then retry.
// If refresh also fails, clear tokens (session expired).
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we haven't already retried this request...
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      getRefreshToken()
    ) {
      // Avoid infinite loop on the refresh endpoint itself.
      if (originalRequest.url === "/token/refresh/") {
        logout();
        window.location.href = "/auth";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes.
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refresh = getRefreshToken();
        const res = await axios.post(
          `${client.defaults.baseURL}/token/refresh/`,
          { refresh }
        );
        const newAccess = res.data.access;
        const remember = localStorage.getItem("remember") === "1";
        if (remember) {
          localStorage.setItem("access", newAccess);
          if (res.data.refresh) localStorage.setItem("refresh", res.data.refresh);
        } else {
          sessionStorage.setItem("access", newAccess);
          if (res.data.refresh) sessionStorage.setItem("refresh", res.data.refresh);
        }
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        window.location.href = "/auth";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default client;
