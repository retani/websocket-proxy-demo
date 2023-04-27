import http from 'http'
import net from 'net'
import cluster from 'cluster'
import fs from 'fs'

import { WebSocketServer } from 'ws'

const numWorkers = 2
const basePath = 8000

if (cluster.isMaster) {
  // Create workers
  for (let i = 0; i < numWorkers; i++) {
    cluster.fork()
  }

  const server = http.createServer()

  server.on('request', (req, res) => {
    const worker = selectWorker(req, cluster.workers)

    if (worker) {
      console.log('worker', worker.id)
      const targetPort = basePath + worker.id
      const proxy = http.request(
        { ...req, host: 'localhost', port: targetPort },
        proxyRes => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers)
          proxyRes.pipe(res, { end: true })
        }
      )

      req.pipe(proxy, { end: true })

      proxy.on('error', err => {
        console.error('Error while proxying request:', err)
        res.writeHead(500)
        res.end('Internal server error')
      })
    } else {
      res.writeHead(404)
      res.end('Not Found (master)')
    }
  })

  server.listen(basePath, () => {
    console.log(`Master process listening on port ${basePath}`)
  })

  // WebSocket proxy
  server.on('upgrade', (req, socket, head) => {
    // Custom logic to select a worker based on the request
    const selectedWorker = selectWorker(req, cluster.workers)
    const targetPort = basePath + selectedWorker.id

    // Create a socket to forward the request to the worker
    const workerSocket = net.connect(targetPort, 'localhost', () => {
      // Forward the upgrade request headers to the worker
      workerSocket.write(
        `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
          `${req.rawHeaders
            .map((v, i) => (i % 2 === 0 ? `${v}: ` : `${v}\r\n`))
            .join('')}` +
          '\r\n',
        'utf-8'
      )

      // Forward the remaining data to the worker
      workerSocket.write(head)

      // Pipe the sockets together
      socket.pipe(workerSocket).pipe(socket)
    })
  })
} else {
  const workerServer = http.createServer((req, res) => {
    console.log(`Worker ${cluster.worker.id} serving request`, req.url)
    //res.writeHead(200)
    //res.end(`Hello from worker ${cluster.worker.id} serving request ${req.url}`)

    // Handle regular HTTP requests here
    fs.readFile('index.html', 'utf-8', (err, data) => {
      if (err) {
        res.writeHead(500)
        res.end('Error loading index.html')
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(data)
      }
    })
  })

  workerServer.listen(basePath + cluster.worker.id, () => {
    console.log(
      `Worker ${cluster.worker.id} listening on port ${
        basePath + cluster.worker.id
      }`
    )
  })

  // WebSocket server
  const wss = new WebSocketServer({ server: workerServer })

  wss.on('connection', ws => {
    ws.send(`Worker ${cluster.worker.id}: connected!`)
    ws.on('message', message => {
      ws.send(`Worker ${cluster.worker.id}: return to sender: ${message}`)
    })
  })
}

function selectWorker(req, workers) {
  const path = req.url.split('/')[1];
  const workerIndex = parseInt(path, 10);

  if (!isNaN(workerIndex) && workerIndex >= 1 && workerIndex <= numWorkers) {
    return workers[workerIndex];
  } else {
    return null;
  }
}
