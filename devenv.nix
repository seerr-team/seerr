{
  pkgs,
  lib,
  config,
  ...
}:
{
  packages = [
    pkgs.prettier
    pkgs.husky
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    nodejs.enable = true;
    pnpm = {
      enable = true;
      package = pkgs.pnpm_10;
      install.enable = true;
    };
  };
}
