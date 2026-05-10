import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api } from '../../api/client';

const saved = JSON.parse(localStorage.getItem('fixMyCityAuth') || 'null');

export const login = createAsyncThunk('auth/login', async (payload) => {
  const { data } = await api.post('/auth/login', payload);
  localStorage.setItem('fixMyCityAuth', JSON.stringify(data.data));
  return data.data;
});

export const registerCitizen = createAsyncThunk('auth/register', async (payload) => {
  const { data } = await api.post('/auth/register', payload);
  localStorage.setItem('fixMyCityAuth', JSON.stringify(data.data));
  return data.data;
});

export const logout = createAsyncThunk('auth/logout', async (_, { getState }) => {
  const token = getState().auth.accessToken;
  if (token) await api.post('/auth/logout');
  localStorage.removeItem('fixMyCityAuth');
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: saved?.user || null,
    accessToken: saved?.accessToken || null,
    refreshToken: saved?.refreshToken || null,
    status: 'idle',
    error: null
  },
  reducers: {
    clearAuthError(state) {
      state.error = null;
    },
    setCredentials(state, action) {
      const { user, accessToken, token } = action.payload;
      if (user) state.user = user;
      if (accessToken) state.accessToken = accessToken;
      if (token) state.accessToken = token;
      
      const saved = JSON.parse(localStorage.getItem('fixMyCityAuth') || '{}');
      localStorage.setItem('fixMyCityAuth', JSON.stringify({
        ...saved,
        user: state.user,
        accessToken: state.accessToken
      }));
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'idle';
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'idle';
        state.error = action.error.message;
      })
      .addCase(registerCitizen.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
      });
  }
});

export const { clearAuthError, setCredentials } = authSlice.actions;
export default authSlice.reducer;
