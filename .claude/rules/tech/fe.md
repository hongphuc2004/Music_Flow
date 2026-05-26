# Tech — Frontend Web (React + MUI)

## Stack

| Quyết định | Lựa chọn | Ghi chú |
|-----------|---------|---------|
| Framework | React 19 + Vite | |
| UI | MUI v7 (Material UI) | Không dùng shadcn/Tailwind |
| Router | React Router DOM v7 | `BrowserRouter` + `Routes` + `Route` |
| HTTP | Axios | Qua `src/services/api.js` |
| Language | JavaScript (JSX) | Không TypeScript |
| Auth state | `localStorage` | `role`, `accessToken`, `refreshToken` |
| Theme | primary `#6c63ff`, secondary `#00bcd4` | Đã cấu hình trong `App.jsx` |

---

## Cấu trúc `src/`

```
src/
├── main.jsx
├── App.jsx                       ← ThemeProvider, ClientPlayerProvider, Router, Routes
├── components/
│   └── Layout/
│       ├── admin/
│       │   ├── Layout.jsx        ← Admin layout (sidebar + header)
│       │   ├── Header.jsx
│       │   └── Sidebar.jsx
│       ├── artist/
│       │   ├── ArtistLayout.jsx
│       │   ├── ArtistHeader.jsx
│       │   └── ArtistSidebar.jsx
│       └── client/
│           ├── ClientLayout.jsx
│           ├── ClientHeader.jsx
│           ├── ClientSidebar.jsx
│           ├── NowPlayingBar.jsx       ← Audio player bar
│           ├── ClientPlayerProvider.jsx ← Audio state context
│           └── SongMoreMenu.jsx
├── pages/
│   ├── AccountLogin.jsx          ← Login chung (user + artist redirect)
│   ├── admin/                    ← Dashboard, Accounts, Songs, Topics, Playlists, Settings
│   ├── artist/                   ← ArtistDashboard, ArtistSong, ArtistAnalytics, ArtistProfile
│   └── client/                   ← ClientHome, ClientDiscover, ClientLibrary, ClientFavorites...
├── services/
│   └── api.js                    ← Axios instance + tất cả API call functions
└── utils/
    ├── artistSession.js
    ├── artistProfile.js
    └── lyrics.js
```

---

## Roles và Route Protection

3 roles: `admin`, `artist`, `user` — lưu trong `localStorage.getItem("role")`.

```jsx
// App.jsx — ProtectedRoute đã có sẵn
const ProtectedRoute = ({ children, role }) => {
  const userRole = localStorage.getItem("role");
  if (!userRole) return <Navigate to={role === "artist" ? "/artistlogin" : "/accountlogin"} replace />;
  if (role && userRole !== role) return <Navigate to={roleDefaultRoute[userRole] || "/accountlogin"} replace />;
  return children;
};
```

**Routes theo role:**
```
/              → admin Dashboard    (ProtectedRoute role="admin")
/artist/*      → Artist portal      (ProtectedRoute role="artist")
/client/*      → User/Client portal (ProtectedRoute role="user")
/accountlogin  → login page (PublicRoute)
/adminlogin    → admin login (PublicRoute)
/artistlogin   → artist login (PublicRoute)
```

---

## API Convention

Tất cả API calls qua `src/services/api.js`:

```js
// src/services/api.js
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Interceptor: tự attach token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
```

**Không gọi `axios.*` trực tiếp trong component hoặc page** — luôn qua `services/api.js`.

---

## Naming Conventions

| Type | Pattern | Ví dụ |
|------|---------|-------|
| Page | `{Role}{Name}.jsx` | `ClientHome.jsx`, `ArtistDashboard.jsx` |
| Layout | `{Role}Layout.jsx` | `ArtistLayout.jsx` |
| Generic component | `PascalCase.jsx` | `NowPlayingBar.jsx`, `SongMoreMenu.jsx` |
| Utility | `camelCase.js` | `artistSession.js` |
| Env var | `VITE_UPPER_SNAKE` | `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID` |

---

## Nguyên tắc

- UI dùng MUI components — không tự viết CSS từ đầu nếu MUI có sẵn
- Không TypeScript — thuần JSX
- Không tạo Axios instance mới — chỉ dùng `src/services/api.js`
- Không hardcode URL — dùng `import.meta.env.VITE_API_URL`
- Không thêm state management library — `localStorage` cho auth, `useState`/`useContext` cho UI
- SPA route rewrite đã config trong `vercel.json` — không cần thay đổi
- `ClientPlayerProvider` là global audio context cho toàn bộ Client portal
