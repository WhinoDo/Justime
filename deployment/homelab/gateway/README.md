# Gateway Configuration

This directory contains Caddy gateway configurations for the Jushi application.

## Files

| File | Description |
|------|-------------|
| `Caddyfile` | Default HTTP-only configuration (for homelab/Tailscale) |
| `Caddyfile.https` | Production HTTPS configuration template |

## Configuration Options

### Option 1: HTTP Only (Default)

Suitable for:
- Local development
- Tailscale deployments (Tailscale provides encryption)
- Behind another reverse proxy (nginx, cloudflare, etc.)

The default `Caddyfile` uses HTTP only with security headers enabled.

### Option 2: Production HTTPS

For production deployments with a public domain:

```bash
# 1. Copy the HTTPS template
cp Caddyfile.https Caddyfile

# 2. Edit and replace YOUR_DOMAIN with your actual domain
sed -i 's/YOUR_DOMAIN/your-domain.com/g' Caddyfile

# 3. Update docker-compose.yml to expose ports 80 and 443
# Change: "127.0.0.1:${CADDY_HTTP_PORT:-8088}:80"
# To:     "80:80" and add "443:443"

# 4. Restart the gateway
docker compose restart gateway
```

## Security Headers

Both configurations include the following security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enables XSS filter |
| `Content-Security-Policy` | `default-src 'self'; ...` | Restricts resource loading |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information |
| `Permissions-Policy` | `...` | Restricts browser features |
| `Strict-Transport-Security` | (HTTPS only) | Enforces HTTPS connections |

## Content Security Policy Notes

The CSP allows:
- `'unsafe-inline'` and `'unsafe-eval'` for scripts/styles (required for Next.js)
- `data:` and `blob:` for images (required for some features)
- `ws:` and `wss:` for WebSocket connections (required for real-time features)

For stricter CSP in production, consider:
1. Using nonces instead of `'unsafe-inline'`
2. Removing `'unsafe-eval'` if not needed
3. Restricting `connect-src` to specific endpoints

## Troubleshooting

### HTTPS Certificate Issues

```bash
# Check Caddy logs
docker compose logs gateway

# Verify certificate status
docker compose exec gateway caddy list-certificates
```

### Security Header Verification

```bash
# Test security headers
curl -I https://your-domain.com

# Use online tools:
# - https://securityheaders.com
# - https://observatory.mozilla.org
```

## References

- [Caddy Documentation](https://caddyserver.com/docs/)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Content Security Policy Reference](https://content-security-policy.com/)
