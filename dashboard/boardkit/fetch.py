"""SSRF-safe HTTP GET for link previews.

Rules: http/https only, no credentials, default or common web ports; every resolved address
must be public; the connection is pinned to the vetted address (no second lookup, so no DNS
rebinding) while TLS still verifies the real hostname; redirects are followed by hand (max 3),
each hop re-validated; one overall deadline; byte caps; content-type gates.
"""
from __future__ import annotations

import http.client
import ipaddress
import re
import socket
import ssl
import time
import zlib
from typing import Callable, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlsplit

DEADLINE_S = 5.0
MAX_REDIRECTS = 3
ALLOWED_PORTS = {None, 80, 443, 8080, 8443}
CAPS = {"html": 1024 * 1024, "json": 512 * 1024, "image": 5 * 1024 * 1024}
TYPES = {
    "html": ("text/html", "application/xhtml+xml"),
    "json": ("application/json", "text/json", "application/json+oembed", "text/javascript", "text/plain"),
    "image": ("image/",),
}
USER_AGENT = ("Mozilla/5.0 (compatible; HermesBoard/1.0; "
              "+https://github.com/albertocvrrbs/hermes-home-dashboard)")
_NAT64 = ipaddress.ip_network("64:ff9b::/96")
_NUMERIC_LABEL = re.compile(r"0x[0-9a-f]*|\d+", re.I)


class FetchError(Exception):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code


class Response:
    def __init__(self, url: str, status: int, ctype: str, body: bytes):
        self.url, self.status, self.ctype, self.body = url, status, ctype, body


def is_public_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value.split("%", 1)[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return is_public_ip(str(ip.ipv4_mapped))
        if ip.sixtofour is not None or ip.teredo is not None or ip in _NAT64:
            return False
    return bool(ip.is_global) and not ip.is_multicast and not ip.is_reserved


def _default_resolver(host: str, port: int) -> List[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return [info[4][0] for info in infos]


class _PinnedHTTP(http.client.HTTPConnection):
    def __init__(self, host: str, port: int, ip: str, timeout: float):
        super().__init__(host, port, timeout=timeout)
        self._ip = ip

    def connect(self) -> None:
        self.sock = socket.create_connection((self._ip, self.port), self.timeout)


class _PinnedHTTPS(http.client.HTTPSConnection):
    def __init__(self, host: str, port: int, ip: str, timeout: float):
        super().__init__(host, port, timeout=timeout, context=ssl.create_default_context())
        self._ip = ip

    def connect(self) -> None:
        sock = socket.create_connection((self._ip, self.port), self.timeout)
        self.sock = self._context.wrap_socket(sock, server_hostname=self.host)


def _default_transport(scheme: str, ip: str, port: int, host: str, target: str,
                       headers: Dict[str, str], timeout: float, max_bytes: int) -> Tuple[int, Dict[str, str], bytes]:
    cls = _PinnedHTTPS if scheme == "https" else _PinnedHTTP
    conn = cls(host, port, ip=ip, timeout=timeout)
    try:
        conn.request("GET", target, headers=headers)
        resp = conn.getresponse()
        body = resp.read(max_bytes + 1)
        return resp.status, {k.lower(): v for k, v in resp.getheaders()}, body
    finally:
        conn.close()


Transport = Callable[[str, str, int, str, str, Dict[str, str], float, int], Tuple[int, Dict[str, str], bytes]]


class Fetcher:
    def __init__(self, resolver: Optional[Callable[[str, int], List[str]]] = None,
                 transport: Optional[Transport] = None, deadline: float = DEADLINE_S):
        self.resolver = resolver or _default_resolver
        self.transport = transport or _default_transport
        self.deadline = deadline

    def _vet(self, url: str) -> Tuple[str, str, int, str, str]:
        try:
            parts = urlsplit(url)
            port = parts.port
        except ValueError:
            raise FetchError("url", "malformed url") from None
        scheme = parts.scheme.lower()
        if scheme not in ("http", "https"):
            raise FetchError("url", "only http and https")
        if parts.username or parts.password:
            raise FetchError("url", "credentials in url")
        if port not in ALLOWED_PORTS:
            raise FetchError("blocked", "port not allowed")
        host = (parts.hostname or "").rstrip(".").lower()
        if not host:
            raise FetchError("url", "no host")
        try:
            host = host.encode("idna").decode("ascii")
        except UnicodeError:
            raise FetchError("url", "bad hostname") from None
        port = port or (443 if scheme == "https" else 80)
        try:
            ipaddress.ip_address(host.strip("[]"))
            raise FetchError("blocked", "ip literals are not fetched")
        except ValueError:
            pass
        if all(_NUMERIC_LABEL.fullmatch(label) for label in host.split(".")):
            raise FetchError("blocked", "numeric host")
        try:
            addrs = self.resolver(host, port)
        except OSError:
            raise FetchError("dns", "host not found") from None
        if not addrs or not all(is_public_ip(a) for a in addrs):
            raise FetchError("blocked", "host resolves to a private address")
        target = parts.path or "/"
        if parts.query:
            target += "?" + parts.query
        return scheme, host, port, addrs[0], target

    def get(self, url: str, want: str = "html", max_bytes: Optional[int] = None) -> Response:
        cap = max_bytes or CAPS[want]
        end = time.monotonic() + self.deadline
        hops = 0
        while True:
            scheme, host, port, ip, target = self._vet(url)
            remaining = end - time.monotonic()
            if remaining <= 0:
                raise FetchError("timeout")
            headers = {
                "User-Agent": USER_AGENT,
                "Accept": {"html": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
                           "json": "application/json", "image": "image/*"}[want],
                "Accept-Encoding": "gzip, identity",
                "Accept-Language": "en,*;q=0.5",
            }
            try:
                status, hdrs, body = self.transport(scheme, ip, port, host, target, headers, remaining, cap)
            except (OSError, http.client.HTTPException, ssl.SSLError) as e:
                raise FetchError("connect", str(e)[:120]) from None
            if status in (301, 302, 303, 307, 308):
                hops += 1
                location = hdrs.get("location")
                if hops > MAX_REDIRECTS:
                    raise FetchError("redirects", "too many redirects")
                if not location:
                    raise FetchError("http", "redirect without location")
                url = urljoin(url, location.strip())
                continue
            if not 200 <= status < 300:
                raise FetchError("http", f"status {status}")
            if hdrs.get("content-encoding", "").lower() == "gzip":
                try:
                    d = zlib.decompressobj(16 + zlib.MAX_WBITS)
                    body = d.decompress(body, cap + 1)
                except zlib.error:
                    raise FetchError("decode") from None
            ctype = hdrs.get("content-type", "").split(";", 1)[0].strip().lower()
            if not any(ctype.startswith(t) for t in TYPES[want]):
                raise FetchError("type", f"unexpected content type {ctype or 'none'}")
            if len(body) > cap:
                if want == "html":
                    body = body[:cap]
                else:
                    raise FetchError("size", "response too large")
            return Response(url, status, ctype, body)
