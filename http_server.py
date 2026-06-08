#!/usr/bin/env python3
# https://chatgpt.com/share/695d0bf7-eec4-800d-bca8-923ef8e34722
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class NoCacheRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Check the requested path extension
        _, ext = os.path.splitext(self.path.lower())
        if ext in (".html", ".md", ".js"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main(host="127.0.0.1", port=8000):
    server = ThreadingHTTPServer((host, port), NoCacheRequestHandler)
    print(f"Serving HTTP on {host} port {port} (http://{host}:{port}/) ...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()


if __name__ == "__main__":
    main()
