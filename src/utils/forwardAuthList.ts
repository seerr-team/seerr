// These are the headers if present will be copied to some requests
// that lack the context of the requests came from client.
// This is required to make forward auth work properly without showing the
// login page on every page load.
// The headers must be added in lower case.
export const ForwardAuthAllowlist = [
  'remote-user',
  'remote-email',
  'remote-name',
  'cf-access-authenticated-user-email',
  'x-authentik-username',
  'x-authentik-email',
];
