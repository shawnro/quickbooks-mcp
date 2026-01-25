# QuickBooks MCP Server

A Model Context Protocol (MCP) server that provides Claude with access to QuickBooks Online data. Enables querying customers, invoices, accounts, transactions, and more through natural language.

## Prerequisites

- **QuickBooks Developer Account**: Register at [developer.intuit.com](https://developer.intuit.com)
- **AWS Account**: (Optional) For secure credential storage (Secrets Manager + SSM Parameter Store)
- **Node.js 18+**

## AWS Setup

This server stores QuickBooks OAuth credentials in AWS for secure, refreshable token management. Environment varriables are available for local testing.

### 1. Create the Secret in Secrets Manager

Store your QuickBooks OAuth credentials as a JSON secret:

```bash
aws secretsmanager create-secret \
  --name prod/qbo \
  --secret-string '{
    "client_id": "your_client_id",
    "client_secret": "your_client_secret",
    "access_token": "your_access_token",
    "refresh_token": "your_refresh_token",
    "redirect_url": "your_redirect_url"
  }'
```

### 2. Store Company ID in SSM Parameter Store

```bash
aws ssm put-parameter \
  --name /prod/qbo/company_id \
  --value "your_company_id" \
  --type SecureString
```

### 3. IAM Permissions

The server needs these AWS permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:prod/qbo*"
    },
    {
      "Effect": "Allow",
      "Action": ["ssm:GetParameter"],
      "Resource": "arn:aws:ssm:*:*:parameter/prod/qbo/*"
    }
  ]
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `us-east-2` | AWS region for Secrets Manager and SSM |
| `QBO_SECRET_NAME` | `prod/qbo` | Secrets Manager secret name |
| `QBO_COMPANY_ID_PARAM` | `/prod/qbo/company_id` | SSM parameter path for company ID |
| `QBO_SANDBOX` | `false` | Set to `true` for QuickBooks sandbox environment |

## Installation

```bash
npm install
npm run build
```

## Claude Code Configuration

Add to your Claude Code MCP settings (`~/.claude/mcp_settings.json`):

```json
{
  "mcpServers": {
    "quickbooks": {
      "command": "node",
      "args": ["/path/to/quickbooks-mcp/dist/index.js"],
      "env": {
        "AWS_REGION": "us-east-2",
        "QBO_SECRET_NAME": "prod/qbo",
        "QBO_COMPANY_ID_PARAM": "/prod/qbo/company_id"
      }
    }
  }
}
```

For sandbox/development:

```json
{
  "mcpServers": {
    "quickbooks-sandbox": {
      "command": "node",
      "args": ["/path/to/quickbooks-mcp/dist/index.js"],
      "env": {
        "QBO_SECRET_NAME": "dev/qbo",
        "QBO_COMPANY_ID_PARAM": "/dev/qbo/company_id",
        "QBO_SANDBOX": "true"
      }
    }
  }
}
```

## Available Tools

The server exposes these MCP tools:

- `qbo_query` - Run SQL-like queries against QuickBooks
- `qbo_get_report` - Fetch financial reports (P&L, Balance Sheet, etc.)
- `qbo_list_accounts` - List chart of accounts
- `qbo_list_customers` - List customers
- `qbo_list_vendors` - List vendors
- And more...

## Token Refresh

The server automatically refreshes OAuth tokens on each request and persists them back to Secrets Manager. This ensures tokens stay valid without manual intervention.

## Development

```bash
# Run in development mode
npm run dev

# Build
npm run build

# Type check
npm run typecheck
```
