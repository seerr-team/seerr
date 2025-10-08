---
title: Backups
description: Understand which data you should back up.
sidebar_position: 4
---

# Which data does Seerr save and where?

## Settings  

All configurations from the **Settings** panel in the Seerr web UI are saved, including integrations with Radarr, Sonarr, Jellyfin, Plex, and notification settings.  
These settings are stored in the `settings.json` file located in the Seerr data folder.

## User Data  

Apart from the settings, all other data—including user accounts, media requests, blacklist etc. are stored in the database (either SQLite or PostgreSQL).

# Backup

### SQLite

If your backup system uses filesystem snapshots (such as Kubernetes with Volsync), you can directly back up the Seerr data folder.  
Otherwise, you need to stop the Seerr application and back up the `config` folder.

For advanced users, it's possible to back up the database without stopping the application by using the [SQLite CLI](https://www.sqlite.org/download.html). Run the following command to create a backup:  

```bash
sqlite3 db/db.sqlite3 ".backup '/tmp/seerr_db.sqlite3.bak'"
```  

Then, copy the `/tmp/seerr_dump.sqlite3.bak` file to your desired backup location.

### PostgreSQL

You can back up the `config` folder and dump the PostgreSQL database without stopping the Seerr application.

Install [postgresql-client](https://www.postgresql.org/download/) and run the following command to create a backup (just replace the placeholders):

:::info
Depending on how your PostgreSQL instance is configured, you may need to add these options to the command below.

  -h, --host=HOSTNAME      database server host or socket directory

  -p, --port=PORT          database server port number
:::

```bash
pg_dump -U <database_user> -d <database_name> -f /tmp/seerr_db.sql
```

# Restore

### SQLite

After restoring your `db/db.sqlite3` file and, optionally, the `settings.json` file, the `config` folder structure should look like this:

```
.
├── cache            <-- Optional
├── db
│   └── db.sqlite3
├── logs             <-- Optional
└── settings.json    <-- Optional (required if you want to avoid reconfiguring Seerr)
```

Once the files are restored, start the Seerr application.

### PostgreSQL

Install the [PostgreSQL client](https://www.postgresql.org/download/) and restore the PostgreSQL database using the following command (replace the placeholders accordingly):

:::info
Depending on how your PostgreSQL instance is configured, you may need to add these options to the command below.

  -h, --host=HOSTNAME      database server host or socket directory

  -p, --port=PORT          database server port number
:::

```bash
pg_restore -U <database_user> -d <database_name> /tmp/seerr_db.sql
```

Optionally, restore the `settings.json` file. The `config` folder structure should look like this:

```
.
├── cache            <-- Optional
├── logs             <-- Optional
└── settings.json    <-- Optional (required if you want to avoid reconfiguring Seerr)
```

Once the database and files are restored, start the Seerr application.
