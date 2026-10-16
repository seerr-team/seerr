---
title: "Why Seerr Doesn't Support PUID/PGID"
description: "Seerr runs rootless by design. Here's why we won't be adding PUID/PGID support, and why chown is the right approach."
slug: why-seerr-doesnt-support-puid-pgid
authors: [fallenbagel]
image: https://raw.githubusercontent.com/seerr-team/seerr/refs/heads/develop/gen-docs/static/img/logo_full.svg
hide_table_of_contents: false
---

A common question we get from users migrating from Overseerr or Jellyseerr is why Seerr doesn't support `PUID`/`PGID` environment variables for setting the user the container runs as. This post explains the reasoning behind that decision and why using chown on the host is the correct approach.

<!--truncate-->

## What PUID/PGID actually does under the hood

The `PUID`/`PGID` pattern, popularised by images like LinuxServer.io, works by running the container entrypoint **as root**, executing a script that calls `chown`/`chmod` at runtime to reassign file ownership, then using a privilege-dropping tool to switch to the target user before starting the app.

So it's still running `chown`; just inside the container, as root, on every single startup. The critical detail here is that **the container must start as root (UID 0) for this to work at all**. That single requirement undermines the whole security model.

## Running as root in a container is a real risk

Docker containers share the host kernel and they are not VMs. If a process inside a root container escapes the namespace via a kernel vulnerability, a container runtime bug, or a compromised dependency, it lands on your host **as root**.

This is well documented:

- Docker's security documentation explicitly warns against it: https://docs.docker.com/engine/security/#linux-kernel-capabilities
- The official Docker best practices guide recommends using the `USER` instruction in your Dockerfile to avoid running as root: https://docs.docker.com/build/building/best-practices/#user
- OWASP's Docker Security Cheat Sheet lists it as Rule #2: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html#rule-2-set-a-user

:::note
There is one legitimate exception: Docker's [user namespace remapping](https://docs.docker.com/engine/security/userns-remap/) (`userns-remap`), where UID 0 inside the container is mapped to an unprivileged high-number UID on the host via a kernel-level isolation mechanism. However,`userns-remap` is **not enabled by default**, requires explicit host-level configuration, and is not what the `PUID`/`PGID` environment variable pattern does. Without it configured on the host, a container starting as root is simply running as root.
:::

## How we ship Seerr instead

Seerr runs as the `node` (UID `1000`) user baked into the official Node.js Docker image. This is exactly how the Node.js Docker team documents it in their own examples. Their own official README uses `user: "node"` in the example Docker Compose configuration: https://github.com/nodejs/docker-node/blob/main/README.md.

We also use [pnpm](https://pnpm.io) as our package manager, which takes a stricter and more secure approach to dependency management than npm. Unlike npm, pnpm uses a content-addressable store with hard links and a non-hoisted, symlinked `node_modules` layout that prevents phantom dependencies (packages silently relying on undeclared transitive dependencies). pnpm also ships with hardened install defaults, including integrity verification and lifecycle script controls, that reduce the supply-chain attack surface.

## Understanding Docker's `USER` directive

We often hear users assume that the `USER` directive in a Dockerfile is a strict, unchangeable rule.

In reality, it simply sets the *default* user for the container. It can be overridden at runtime using [`--user` flag in docker cli](https://docs.docker.com/reference/cli/docker/container/run/) or by specifying [`user:` in your docker compose file](https://docs.docker.com/reference/compose-file/services/#user).

However, when you do switch users, it’s important to ensure that any mounted volumes (such as a `/path/to/appdata/config` directory in our case) have the correct permissions for the new user to avoid access issues.

## Why does Seerr default to UID/GID `1000:1000`?

A common question is whether the UID/GID needs to exist on the host machine to run the container. It doesn't; it only needs to exist inside the container. This means you can use any UID/GID, even one that doesn't correspond to a user on your host system.

However, if a security vulnerability allows an attacker to escape the container, they inherit the permissions of that UID/GID on the host, if it exists. This is exactly the scenario we're avoiding by not running as root. If Seerr (or any of its dependencies) ran as root, as Overseerr and Jellyseerr did, a container escape would hand an attacker root on your host. The same applies to the `PUID`/`PGID` pattern: since it requires the container to start as root before dropping privileges, a vulnerability triggered before that drop would have the same effect. To mitigate this, Docker offers [user namespace remapping](https://docs.docker.com/engine/security/userns-remap/), which lets you map container UIDs to different, non-conflicting UIDs on the host for stronger isolation.

You might also wonder why `1000:1000` specifically. While `1000` is often the first non-root user created on many Linux systems, our reason is simpler: it's the default user created in the [base Node.js Docker image](https://github.com/nodejs/docker-node/blob/c94b4249a1a1bfb2ebb05fac9012cd34fecc2db7/22/alpine3.23/Dockerfile#L5).

As for why we don't go into more depth on this in our docs: we focus on the basics and the most common use cases for Seerr itself. Docker's permission model, including how the `USER` directive works, is already well documented by Docker. Our goal is to get you up and running smoothly, while encouraging you to explore the tools you're using.

## So what do you actually need to do?

If you're mounting a data directory into the Seerr container, that directory needs to be owned by UID `1000` (the `node` user) on the host. You do this once:

```bash
chown -R 1000:1000 /your/seerr/data
```

That's it. A common misconception we've encountered from users unfamiliar with this setup is that this is a "workaround" or a "hack", but it isn't. It is basic Linux file permissions and it works as intended. If you're unfamiliar with how Linux file ownership works, DigitalOcean has a solid primer: https://www.digitalocean.com/community/tutorials/how-to-set-permissions-linux.

Docker's own documentation recommends this exact approach for bind mount permissions: https://docs.docker.com/engine/storage/bind-mounts/.

:::note
Unraid users may prefer to match the container user to their existing share permissions rather than chowning their data directory. Our [Unraid documentation](/getting-started/third-parties/unraid) covers both approaches. Note that third-party platform support is community-maintained and not officially supported by the Seerr team.
:::

## Why we won't add PUID/PGID support

Adding `PUID`/`PGID` support would require us to deliberately ship an image that starts as root. In a project with hundreds of npm dependencies, a single compromised package in a supply chain attack could, under that setup, gain root-level access to your server. The convenience of skipping one `chown` command does not come close to justifying that tradeoff.

:::tip
For additional hardening, you can mount the container filesystem as [read-only](https://docs.docker.com/reference/compose-file/services/#read_only) and grant write access only to your data directory. Since all runtime writes go through `CONFIG_DIRECTORY`, nothing outside that volume needs to be writable.
:::

If you need the PUID/PGID pattern, third-party images that implement it already exist. But it is not something we will maintain here, because it would mean knowingly reintroducing a security regression we deliberately moved away from.

**Seerr's container setup is more secure than what Overseerr and Jellyseerr shipped, and we intend to keep it that way.**