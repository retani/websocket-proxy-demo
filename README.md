proxy from main process at 8000 to workers at 8001, 8002

```
npm install
npm run dev
```

visit http://localhost:8000/2

-> request will be handled by worker 2, including the websocket
