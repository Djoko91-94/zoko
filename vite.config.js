import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: resolve(projectRoot, 'index.html'),
                zoko: resolve(projectRoot, 'zoko.html')
            }
        }
    },
    server: {
        proxy: {
            '/api': 'http://localhost:3000'
        }
    }
})