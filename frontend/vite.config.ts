import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Heavy libraries are grouped into standalone chunks so no single async chunk
// exceeds the 500 kB warning threshold, and vendor code stays cacheable while
// app code changes. KaTeX only loads with the lazy markdown chunk; the Mermaid
// dependency groups only load when a diagram is rendered. Prism must stay
// inside the markdown chunk: prismjs language components reference the Prism
// global installed by prism-react-renderer, and splitting them into their own
// chunk breaks that execution order.
const vendorGroups = [
  { name: 'vendor-katex', test: /[\\/]node_modules[\\/]katex[\\/]/ },
  {
    name: 'vendor-mermaid-d3',
    test: /[\\/]node_modules[\\/](d3|d3-[a-z0-9-]+|internmap|dagre-d3-es|d3-sankey)[\\/]/,
  },
  {
    name: 'vendor-mermaid-utils',
    test: /[\\/]node_modules[\\/](roughjs|dompurify|marked|dayjs|khroma|es-toolkit|ts-dedent|uuid|stylis|@braintree[\\/]sanitize-url|@upsetjs[\\/]venn\.js|@iconify[\\/]utils)[\\/]/,
  },
]

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: vendorGroups,
        },
      },
    },
    // The only chunk that still exceeds 500 kB is a single pre-bundled module
    // from @mermaid-js/parser (~660 kB minified) that cannot be split further
    // and is only fetched when a Mermaid diagram actually renders.
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
