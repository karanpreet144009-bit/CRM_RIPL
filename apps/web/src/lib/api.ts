import axios from 'axios';
const developmentApiUrl = `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;
const apiBaseUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV && window.location.protocol === 'http:' ? developmentApiUrl : '/api/v1');
export const api=axios.create({baseURL:apiBaseUrl,withCredentials:true});
let accessToken:string|undefined; export const setAccessToken=(token?:string)=>{accessToken=token}; api.interceptors.request.use(config=>{if(accessToken)config.headers.Authorization=`Bearer ${accessToken}`;return config});
api.interceptors.response.use(r=>r,async error=>{const isRefreshRequest=error.config?.url?.includes('/auth/refresh');if(error.response?.status===401&&!isRefreshRequest&&!error.config.__retried){error.config.__retried=true;const {data}=await api.post('/auth/refresh');setAccessToken(data.data.accessToken);error.config.headers.Authorization=`Bearer ${data.data.accessToken}`;return api(error.config)}return Promise.reject(error)});
