# @notelab/linear-connector

Linear connector primitives for Notelab.

## Features

- Linear OAuth 2 authorization URL and token exchange helpers
- Token refresh helper for OAuth apps using Linear refresh tokens
- Thin readonly client wrapper around the official `@linear/sdk`

The default OAuth scope is `read`, which is enough for organization-aware AI
context without granting issue or comment write permissions.
