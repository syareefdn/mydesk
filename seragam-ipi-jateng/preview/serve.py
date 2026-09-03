#!/usr/bin/env python3
"""Pratinjau lokal formulir (tanpa Google): serve web/Index.html + mock backend.

    python3 preview/serve.py [port]      # default 8080

- http://localhost:8080/            → form pengisi
- http://localhost:8080/?view=admin → rekap panitia (mock, token apa pun)
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
WEB = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web"))


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path, _, query = self.path.partition("?")
        if path in ("/admin", "/admin/"):
            query = (query + "&" if query else "") + "view=admin&token=preview"
        if path.split("?")[0].rstrip("/") in ("", "/index", "/index.html", "/admin"):
            self.path = "/Index.html" + (("?" + query) if query else "")
        return super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=WEB)
    with http.server.ThreadingHTTPServer(("0.0.0.0", PORT), handler) as httpd:
        print("Pratinjau form : http://0.0.0.0:%d/\nPratinjau admin : http://0.0.0.0:%d/admin\nFolder: %s" % (PORT, PORT, WEB))
        httpd.serve_forever()
