# Helpdesk Runbook

This file documents the deployed helpdesk instance that runs from this server.

## Instance Summary

- Application directory: `/etc/trudesk`
- Application type: fork of Trudesk
- Package name: `trudesk`
- Application version: `1.2.10`
- Git remote: `https://github.com/jaywaytravel/helpdesk`
- Git branch: `master`
- Current revision: `e489f51795df82135b788fdaaf9e711e7729eb6c`
- Runtime: `node 16.20.2`
- Process manager: `PM2`
- PM2 app name: `helpdesk`
- PM2 exec cwd: `/etc/trudesk`
- Environment: `NODE_ENV=production`

## How It Runs Now

The live process is started by PM2 from the repository root.

Current start command equivalent:

```bash
cd /etc/trudesk
NODE_ENV=production pm2 start app.js --name helpdesk -l /logs/output.log --merge-logs
```

Useful PM2 commands:

```bash
pm2 list
pm2 show helpdesk
pm2 restart helpdesk
pm2 stop helpdesk
pm2 delete helpdesk
pm2 logs helpdesk --lines 100
pm2 save
```

If PM2 is not needed, the app can also be started directly:

```bash
cd /etc/trudesk
NODE_ENV=production node app.js
```

Or through npm:

```bash
cd /etc/trudesk
NODE_ENV=production npm start
```

`npm start` maps to:

```bash
node ./app
```

## Config File

Main config file:

```text
/etc/trudesk/config.yml
```

The application loads `config.yml` by default. It also supports a custom config path via the `--config` CLI option.

Example:

```bash
cd /etc/trudesk
NODE_ENV=production node app.js --config ./config.yml
```

Current config structure in this instance:

```yaml
mongo:
  host: localhost
  port: '27017'
  username: trudesk
  password: <stored-in-config.yml>
  database: trudesk
tokens:
  secret: <stored-in-config.yml>
  expires: 900
elasticsearch: {}
```

Notes:

- Do not duplicate secrets from `config.yml` into documentation.
- `tokens.secret` is required for token signing.
- If an old `config.json` exists, the app converts it to `config.yml` automatically on startup.

## Ports And Bindings

- Web application bind address: `0.0.0.0`
- Web application port: `8118`
- MongoDB port in current config: `27017`
- Elasticsearch is optional, but the app currently logs attempts to reach `127.0.0.1:9200`

The listen port is defined in code as `nconf.get('port') || 8118`, so it can be overridden with a CLI argument:

```bash
cd /etc/trudesk
NODE_ENV=production node app.js --port 8118
```

## Dependencies

Required for normal operation:

- Node.js `16+`
- MongoDB `5.0+`

Optional:

- Elasticsearch `8.x` for search features

Current server state observed during documentation:

- The app is listening on `0.0.0.0:8118`
- MongoDB is listening on `127.0.0.1:27017`
- Elasticsearch is not listening locally on `127.0.0.1:9200`

## Logs

Primary PM2-related log locations:

```text
/root/.pm2/logs/helpdesk-out.log
/root/.pm2/logs/helpdesk-error.log
/logs/output.log
```

Useful log commands:

```bash
pm2 logs helpdesk --lines 100
tail -n 100 /root/.pm2/logs/helpdesk-out.log
tail -n 100 /root/.pm2/logs/helpdesk-error.log
```

## Install And Setup Modes

If `config.yml` is missing and the app is not running in Docker mode, the install server is launched automatically.

It can also be forced explicitly:

```bash
cd /etc/trudesk
node app.js --install
```

Docker mode is detected via:

```text
TRUDESK_DOCKER=true
```

There is also a repository `docker-compose.yml`, but the currently running server instance is not using Docker.

## Repository Notes

- Repository root: `/etc/trudesk`
- The working tree currently has modified built assets under `public/js`
- Be careful before rebuilding frontend assets or pulling changes on production

## Operational Notes

- The live PM2 process name is `helpdesk`
- The live process is launched from `/etc/trudesk/app.js`
- `startup.sh` in this repository is Docker-oriented and prepares upload directories under `/usr/src/trudesk`; it is not the script currently used to launch this server instance
- Recent logs show warnings for Elasticsearch connection failures to `127.0.0.1:9200`
- Recent logs also show a connection refusal to `127.0.0.1:143`, which suggests a mail or IMAP integration is configured but unavailable

## Quick Admin Checklist

Check status:

```bash
pm2 list
pm2 show helpdesk
ss -ltnp | grep -E ':8118|:27017|:9200'
```

Restart service:

```bash
cd /etc/trudesk
pm2 restart helpdesk
```

Verify after restart:

```bash
pm2 logs helpdesk --lines 50
ss -ltnp | grep ':8118'
```