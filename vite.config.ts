import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import type { ServerResponse } from 'http'

// https://vite.dev/config/
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024 // 50MB max limit to prevent OOM/DoS attacks

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/db.json']
    },
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  },
  preview: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-api',
      configureServer(server) {
        // SSE Clients Pool for Real-Time Cross-Device Sync
        const sseClients = new Set<ServerResponse>()

        server.middlewares.use((req, res, next) => {
          // Add security headers to all responses
          res.setHeader('X-Content-Type-Options', 'nosniff')
          res.setHeader('X-Frame-Options', 'SAMEORIGIN')
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
          res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

          const dbPath = path.resolve(__dirname, 'db.json')

          // SSE Endpoint for Instant Push Notifications to Mobile, Tablet, iPad, PC
          if (req.url === '/api/events') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache, no-transform',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            })
            res.write('retry: 2000\n\n')
            res.write(`data: ${JSON.stringify({ type: 'connected', time: Date.now() })}\n\n`)

            sseClients.add(res)

            req.on('close', () => {
              sseClients.delete(res)
            })
            return
          }

          if (req.url === '/api/data') {
            if (req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json')
              if (fs.existsSync(dbPath)) {
                res.end(fs.readFileSync(dbPath, 'utf-8'))
              } else {
                res.end(JSON.stringify({}))
              }
            } else if (req.method === 'POST') {
              let body = ''
              let receivedBytes = 0
              let isTooLarge = false

              req.on('data', chunk => {
                receivedBytes += chunk.length
                if (receivedBytes > MAX_PAYLOAD_BYTES) {
                  isTooLarge = true
                  res.statusCode = 413
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: 'Payload Too Large. Maximum allowed size is 50MB.' }))
                  req.destroy()
                  return
                }
                body += chunk
              })

              req.on('end', () => {
                if (isTooLarge) return

                try {
                  // Validate that the received body is valid JSON before writing to disk
                  const parsedData = JSON.parse(body)
                  fs.writeFileSync(dbPath, JSON.stringify(parsedData, null, 2), 'utf-8')
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ success: true }))

                  // Broadcast update immediately to all connected devices (Mobile, iPad, PC)
                  const broadcastPayload = `data: ${JSON.stringify({ type: 'sync', data: parsedData, timestamp: Date.now() })}\n\n`
                  for (const client of sseClients) {
                    try {
                      client.write(broadcastPayload)
                    } catch {
                      sseClients.delete(client)
                    }
                  }
                } catch (err) {
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }))
                }
              })
            }
          } else {
            next()
          }
        })

        // Send periodic heartbeat to keep mobile and tablet connections alive
        const heartbeatTimer = setInterval(() => {
          for (const client of sseClients) {
            try {
              client.write(': heartbeat\n\n')
            } catch {
              sseClients.delete(client)
            }
          }
        }, 15000)

        server.httpServer?.on('close', () => {
          clearInterval(heartbeatTimer)
          sseClients.clear()
        })
      }
    }
  ],
})

