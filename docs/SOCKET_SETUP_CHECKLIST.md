# Socket.IO connection – setup checklist

Use this to align the frontend with your VPS Socket.IO server and fix connection errors.

---

## 1. Where are you testing?

- [ ] **Local dev:** `npm run dev` → app at `http://localhost:3000`
- [ ] **Vercel preview/production:** app at `https://*.vercel.app` or `https://captainprospect.com`

If you’re on **HTTPS** (Vercel), the browser will block `ws://` (mixed content). You need either:
- A socket URL that uses **HTTPS** (so the client uses `wss://`), e.g. `NEXT_PUBLIC_SOCKET_URL=https://captainprospect.com`, **or**
- TLS on the VPS (e.g. reverse proxy with SSL in front of port 4000).

---

## 2. VPS Socket.IO server config

Please confirm (from your Node/server code or docs):

| Question | Your answer |
|----------|-------------|
| **Path:** Is the Socket.IO server mounted at `path: "/socket"` or `path: "/socket.io"` (or something else)? |  |
| **CORS:** Which origins are allowed? (e.g. `http://localhost:3000`, `https://your-app.vercel.app`) |  |
| **Port:** Is the server listening on port **4000**? (you already confirmed this with `netstat`) | Yes |

The frontend uses:
- **Path:** from `NEXT_PUBLIC_SOCKET_PATH` in `.env` (default in code is `/socket.io`). If your server uses `/socket`, set `NEXT_PUBLIC_SOCKET_PATH=/socket`.
- **URL:** from `NEXT_PUBLIC_SOCKET_URL` (default `http://173.212.231.174:4000`).

---

## 3. Reachability

From the **same machine/browser** where you see the error:

- Can you open **http://173.212.231.174:4000/** in a browser tab? (You might see “Cannot GET /” or a 404; that’s OK – it means the port is reachable.)
- If that fails: firewall (VPS or cloud security group) may be blocking port 4000 from your IP, or the server may not be bound to `0.0.0.0`.

---

## 4. Your `.env` / `.env.local`

List what you have (no secrets), so we can match the client to the server:

```
NEXT_PUBLIC_SOCKET_URL=     (optional; default: http://173.212.231.174:4000)
NEXT_PUBLIC_SOCKET_PATH=    (optional; default in code: /socket.io — set to /socket if server uses that)
```

After changing these, restart the Next dev server so env vars are picked up.

---

## 5. Quick reference – server vs client

| Server (VPS) | Frontend (.env or code default) |
|--------------|---------------------------------|
| `path: "/socket"` | `NEXT_PUBLIC_SOCKET_PATH=/socket` |
| `path: "/socket.io"` or default | Omit or `NEXT_PUBLIC_SOCKET_PATH=/socket.io` |
| Listen on 4000 | `NEXT_PUBLIC_SOCKET_URL=http://173.212.231.174:4000` (or https URL for production) |
| CORS allows `http://localhost:3000` | Use when testing locally |
| CORS allows your Vercel/HTTPS origin | Use when testing on Vercel |

Reply with your answers to sections 2, 3, and 4 (path, CORS, reachability, and env vars), and we can give exact values and code changes to fix the connection.
