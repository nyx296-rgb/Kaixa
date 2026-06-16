#!/usr/bin/env python3
"""Simple SPA static file server for Railway."""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("PORT", 3000))
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")

class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path) and not os.path.exists(os.path.join(path, "index.html")):
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        pass  # Disable logging

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), SPAHandler)
    print(f"Serving frontend on port {PORT}")
    server.serve_forever()
