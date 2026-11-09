"""仅在 127.0.0.1 提供静态站点；用本项目令牌停止自己的服务。"""
import argparse
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.runtime'
STATE = RUNTIME / 'server.json'
PROJECT_ID = hashlib.sha256(str(ROOT).encode('utf-8')).hexdigest()
SERVER_VERSION = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def site_revision():
    digest = hashlib.sha256()
    for name in ('index.html', 'styles.css', 'app.js'):
        digest.update(name.encode('utf-8'))
        digest.update((ROOT / name).read_bytes())
    return digest.hexdigest()[:16]


def site_url(port):
    return f'http://127.0.0.1:{port}/?v={site_revision()}#/graph'


def request(port, path, token=None):
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}',
                                 data=b'' if token else None,
                                 headers={'X-Project-Token': token} if token else {})
    with urllib.request.urlopen(req, timeout=2) as response:
        return json.load(response)


def live_state():
    try:
        state = json.loads(STATE.read_text(encoding='utf-8'))
        health = request(state['port'], '/__yinian_health')
        if health.get('projectId') == PROJECT_ID and health.get('instanceId') == state.get('instanceId'):
            state['serverVersion'] = health.get('serverVersion')
            return state
    except (OSError, ValueError, KeyError, urllib.error.URLError):
        pass
    return None


def run_server():
    if live_state():
        return
    RUNTIME.mkdir(exist_ok=True)
    token, instance = secrets.token_urlsafe(32), secrets.token_hex(16)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def end_headers(self):
            # 本地文件随时会更新；所有响应都不留浏览器缓存，避免新旧资源混用。
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
            super().end_headers()

        def send_json(self, data, status=200):
            body = json.dumps(data).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == '/__yinian_health':
                return self.send_json({'projectId': PROJECT_ID, 'instanceId': instance,
                                       'serverVersion': SERVER_VERSION, 'siteRevision': site_revision()})
            if any(part.startswith('.') for part in urllib.parse.unquote(self.path).split('/')):
                return self.send_error(404)
            super().do_GET()

        def do_POST(self):
            if self.path != '/__yinian_stop' or not secrets.compare_digest(self.headers.get('X-Project-Token', ''), token):
                return self.send_error(403)
            self.send_json({'stopped': True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()

    class LocalHTTPServer(http.server.ThreadingHTTPServer):
        allow_reuse_address = False

        def server_bind(self):
            # Windows 上 SO_REUSEADDR 可允许重复绑定，必须独占监听端口。
            if os.name == 'nt':
                self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            super().server_bind()

    factory = functools.partial(Handler, directory=str(ROOT))
    server = None
    for port in range(8000, 8011):
        try:
            server = LocalHTTPServer(('127.0.0.1', port), factory)
            break
        except OSError:
            continue
    if not server:
        raise RuntimeError('8000–8010 端口均不可用。请释放其中一个端口后重试。')
    server.daemon_threads = True
    state = {'projectId': PROJECT_ID, 'instanceId': instance, 'port': port,
             'pid': os.getpid(), 'token': token, 'url': site_url(port), 'serverVersion': SERVER_VERSION}
    temp = STATE.with_suffix('.tmp')
    temp.write_text(json.dumps(state), encoding='utf-8')
    temp.replace(STATE)
    try:
        server.serve_forever(poll_interval=.15)
    finally:
        server.server_close()
        try:
            if json.loads(STATE.read_text(encoding='utf-8')).get('instanceId') == instance:
                STATE.unlink()
        except (OSError, ValueError):
            pass


def start(open_browser=True):
    state = live_state()
    if state and state.get('serverVersion') != SERVER_VERSION:
        # 仅通过已核对的项目身份、实例及令牌更新本项目，不结束其他服务。
        request(state['port'], '/__yinian_stop', state['token'])
        for _ in range(60):
            current = live_state()
            if not current or current['instanceId'] != state['instanceId']:
                break
            time.sleep(.1)
        else:
            raise RuntimeError('旧版本图谱服务尚未退出，请稍后重新启动。')
        state = live_state()
    if not state:
        RUNTIME.mkdir(exist_ok=True)
        with (RUNTIME / 'server.log').open('ab') as log:
            flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            child = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'run'],
                                     cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                     creationflags=flags, start_new_session=os.name != 'nt')
        for _ in range(80):
            state = live_state()
            if state:
                break
            if child.poll() is not None:
                raise RuntimeError('服务启动失败，请查看 .runtime/server.log。')
            time.sleep(.1)
        if not state:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=5)
            raise RuntimeError('服务未能及时响应，请查看 .runtime/server.log。')
    url = site_url(state['port'])
    print(url)
    if open_browser:
        webbrowser.open(url)


def stop():
    state = live_state()
    if not state:
        print('本项目当前没有正在运行的服务。')
        return
    request(state['port'], '/__yinian_stop', state['token'])
    for _ in range(40):
        if not live_state():
            print('一念弘一服务已停止。')
            return
        time.sleep(.1)
    raise RuntimeError('停止请求已发送，但服务尚未退出。请稍后重试。')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'stop', 'run'])
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    try:
        if args.action == 'run':
            run_server()
        elif args.action == 'start':
            start(not args.no_browser)
        else:
            stop()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
