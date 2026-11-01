# Local development

Prerequisites and commands to run the applications on your own computer. Back to the [README](../README.md).

## Run locally

Requires Node 24+ (tested with 24.19.0), npm, Git, and Python 3 for proof checks.

```sh
npm run setup
npm run dev
```

Open `http://localhost:5173` on the same computer (keep Vite's current port if
it differs). Print IDs and asset integrity require Web Crypto; remote/LAN
clients need HTTPS because plain HTTP on an IP address does not expose it.
