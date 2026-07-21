# Forward auth

You can use Forward Auth mechanism to log into Seerr.

This feature enables single sign-on(SSO) by passing the authenticated user(and optionally the authenticated user's email address for extra security) in the headers
defined by `forwardAuth.userHeader` and `forwardAuth.emailHeader` in the configuration file or the settings in Settings->Network in Web UI.

:::warning
By default the user has to exist, it will not be created automatically unless `forwardAuth.autoProvision` has been set to true in the configuration file or the settings in Settings->Network in Web UI.
:::

:::info
If the user has no email set, Forward Auth can be configured to work with just the username.
:::

## Configuring with Authelia 

See the documentation [here](https://www.authelia.com/integration/trusted-header-sso/seerr/)

