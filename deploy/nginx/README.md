# nginx deploy files

## Files

- `wol.conf`: nginx virtual host config for this project.

## Install on Raspberry Pi

```bash
sudo cp deploy/nginx/wol.conf /etc/nginx/sites-available/wol.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/wol.conf /etc/nginx/sites-enabled/wol.conf
sudo nginx -t
sudo systemctl reload nginx
```

## Expected runtime

- `/` serves static files from `/var/www/wol`
- `/api/*` proxies to FastAPI on `127.0.0.1:8000`
