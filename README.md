# Customization Development Memo
## .env
- APP_TITLE: .env
- VERSION: pacakges/data-provider/src
- ICON
  - logo: logo.svg
  - 16x16: favicon-16x16.png
  - 32x32: favicon-16x16.png
  - 180x180: apple-touch-icon-180x180.png
  - 192x192: icon-192x192.png
  - 512x512: maskable-icon.png

## .librechat.yaml
### .librechat.dev.yaml
- for dev, open all
### .lbrechat.yaml
- for docker, it should on app/librechat.yml, use docker-compose.override.yml
- hide some interfaces
  - side panel


# MCP Guide
- add a volume on docker-compose.yml
- use docker directory as a directory in librechat.yaml