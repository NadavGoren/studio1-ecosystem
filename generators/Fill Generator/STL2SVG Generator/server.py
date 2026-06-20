#!/usr/bin/env python3
"""
Simple HTTP server with CORS and SharedArrayBuffer support
Required for FFmpeg.wasm to work properly
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable SharedArrayBuffer support
        # 'require-corp' is required to enable SharedArrayBuffer
        # Note: This may block some cross-origin resources, but FFmpeg.wasm should still load
        # If CDN resources are blocked, they'll fail to load (you'll see errors in console)
        # But SharedArrayBuffer will be available for FFmpeg to use
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        # CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        # Cache control for development
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def run(port=8001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f"""
╔══════════════════════════════════════════════════════════════╗
║  3D Cube Generator Server                                    ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server running at: http://localhost:{port}                   ║
║                                                              ║
║  Open this URL in your browser:                             ║
║  → http://localhost:{port}/3d-generator.html                  ║
║                                                              ║
║  Features enabled:                                           ║
║  ✓ CORS headers                                             ║
║  ✓ SharedArrayBuffer (for FFmpeg.wasm)                      ║
║  ✓ ES6 module support                                       ║
║                                                              ║
║  Press Ctrl+C to stop the server                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped. Goodbye!")
        sys.exit(0)

if __name__ == '__main__':
    port = 8001
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}")
            print("Usage: python3 server.py [port]")
            sys.exit(1)
    
    run(port)

