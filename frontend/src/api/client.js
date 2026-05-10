import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

export const api = axios.create({
  baseURL: API_URL
});

api.interceptors.request.use((config) => {
  const auth = JSON.parse(localStorage.getItem('fixMyCityAuth') || 'null');
  if (auth?.accessToken) {
    config.headers.Authorization = `Bearer ${auth.accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const auth = JSON.parse(localStorage.getItem('fixMyCityAuth') || 'null');

    if (error.response?.status === 401 && auth?.refreshToken && !original._retry) {
      original._retry = true;
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken: auth.refreshToken });
      localStorage.setItem('fixMyCityAuth', JSON.stringify(data.data));
      original.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return api(original);
    }

    return Promise.reject(error);
  }
);

export const apiMessage = (error) => {
  if (error.response?.data?.message) return error.response.data.message;
  
  const status = error.response?.status;
  const statusMessages = {
    400: 'Bad Request: The server could not understand the request.',
    401: 'Unauthorized: Please login again to continue.',
    403: 'Forbidden: You do not have permission to perform this action.',
    404: 'Not Found: The requested resource does not exist.',
    409: 'Conflict: This action conflicts with existing data.',
    422: 'Validation Error: Please check your input and try again.',
    500: 'Internal Server Error: Something went wrong on our end. Please try again later.'
  };

  if (status && statusMessages[status]) return statusMessages[status];
  
  return error.message || 'An unexpected error occurred';
};
