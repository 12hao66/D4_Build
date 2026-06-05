from http.server import SimpleHTTPRequestHandler, HTTPServer
import json, os, sys

PORT = 8080

class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/save-affixes':
            try:
                length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(length)
                data = json.loads(body)
                os.makedirs('data', exist_ok=True)
                with open('data/affixes.json', 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'count': len(data)}).encode())
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress log noise for favicon
        if '/favicon.ico' in str(args):
            return
        super().log_message(format, *args)

print(f'Server running at http://localhost:{PORT}')
print(f'Admin:  http://localhost:{PORT}/admin.html')
print(f'Build:  http://localhost:{PORT}/build.html')
HTTPServer(('', PORT), Handler).serve_forever()