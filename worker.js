import cluster from 'cluster'
import http from 'http'
import fs from 'fs'
import { WebSocketServer } from 'ws'

const port = process.env.PORT || 8000

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

const httpServer = workerServer.listen(port, () => {
  console.log(
    `Worker ${cluster.worker.id} listening on port ${httpServer.address().port}`
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