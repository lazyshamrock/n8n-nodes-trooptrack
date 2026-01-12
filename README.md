# n8n-nodes-trooptrack

An **unofficial n8n community node** for interacting with the TroopTrack
API.

This package provides read-only (GET) access to key TroopTrack resources
to enable reporting, automation, and data integration workflows inside
n8n.

Important\
This is **not an official TroopTrack product** and is **not affiliated
with TroopTrack in any way**.\
Use at your own risk.

------------------------------------------------------------------------

## Current Version

**v1.0.0**

This initial release is intentionally focused and stable.

### What v1.0 Supports

-   GET / Read-only operations
-   Structured resources for use in n8n workflows
-   Clean output shaping for downstream nodes

### What v1.0 Does Not Support

-   Create, Update, or Delete operations (POST, PUT, PATCH)
-   Automation of UI-only TroopTrack features
-   Headless browser automation

These capabilities are planned for future versions.

------------------------------------------------------------------------

## Supported Resources

The node exposes the following resources:

-   Events
-   Event Types
-   Patrols (derived from Event Types parameters)
-   Users\
    Includes **Get Many (Simple)** for lightweight user listings
-   Other read-only endpoints as defined in v1

Each resource is available through standard n8n **Resource / Operation**
selectors.

------------------------------------------------------------------------

## Installation

Install via npm (recommended):

```bash
npm install n8n-nodes-trooptrack
```

Or inside a self-hosted n8n environment:

1.  Navigate to your n8n user directory (usually \~/.n8n)
2.  Run: npm install n8n-nodes-trooptrack
3.  Restart n8n

------------------------------------------------------------------------

## Configuration

You will need your TroopTrack API credentials.

1.  In n8n, open **Credentials**
2.  Create a new credential using the TroopTrack API type
3.  Enter your API key and base URL

Once configured, the **TroopTrack** node will appear in the node list.

------------------------------------------------------------------------

## Example Use Cases

-   Generate troop dashboards and reports
-   Sync users, patrols, and events into other systems
-   Power Google Sheets, Airtable, or databases with TroopTrack data
-   Drive notifications and workflows based on TroopTrack activity

------------------------------------------------------------------------

## Roadmap

This project is intentionally iterative.

### Planned Enhancements

**v1.x** - Expanded GET coverage for additional endpoints - Field
filtering and optional parameters where supported

**v2.0** - Write support\
POST, PUT, and PATCH operations\
Create and update entities directly from n8n

**Advanced Automation Layer** - Puppeteer-based automation for
TroopTrack features not exposed via API - Headless UI actions for
workflows such as: - Admin-only operations - Batch updates - Workflow
steps not supported natively by TroopTrack

------------------------------------------------------------------------

## Unofficial Project Disclaimer

This project is: - Not endorsed by TroopTrack - Not supported by
TroopTrack - Not affiliated with TroopTrack in any capacity

All trademarks and service marks belong to their respective owners.

If TroopTrack changes or deprecates API behavior, this node may require
updates.

------------------------------------------------------------------------

## Contributing

Contributions are welcome.

If you are adding: - New GET endpoints - Additional resource support -
Output improvements - Bug fixes

Please open a pull request with: - A clear description of the change -
Testing notes - Any relevant API documentation

------------------------------------------------------------------------

## License

MIT License

You are free to use, modify, and distribute this package in accordance
with the license terms.

------------------------------------------------------------------------

## Maintainer

This node is independently developed and maintained as a community
contribution for n8n users.

If you rely on it in production, pin your version and monitor releases.
