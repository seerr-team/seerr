import { useEffect, useState } from 'react';

export const SeerrVersion = () => {
  const [version, setVersion] = useState<string | null>('0.0.0');

  useEffect(() => {
    async function fetchVersion() {
      try {
        const response = await fetch(
          'https://raw.githubusercontent.com/seerr-team/seerr/main/package.json'
        );

        const data = await response.json();

        setVersion(data.version);
        console.log(data.version);
      } catch (error) {
        console.error('Failed to fetch version', error);
        setVersion('Error fetching version');
      }
    }
    fetchVersion();
  }, []);

  return version;
};

export const NixpkgVersion = () => {
  const [versions, setVersions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const unstableUrl =
          'https://raw.githubusercontent.com/NixOS/nixpkgs/refs/heads/nixos-unstable/pkgs/by-name/je/jellyseerr/package.nix';
        const stableUrl =
          'https://raw.githubusercontent.com/NixOS/nixpkgs/refs/heads/nixos-25.05/pkgs/by-name/je/jellyseerr/package.nix';

        const [unstableResponse, stableResponse] = await Promise.all([
          fetch(unstableUrl),
          fetch(stableUrl),
        ]);

        const unstableData = await unstableResponse.text();
        const stableData = await stableResponse.text();

        const versionRegex = /version\s*=\s*"([^"]+)"/;

        const unstableMatch = unstableData.match(versionRegex);
        const stableMatch = stableData.match(versionRegex);

        const unstableVersion =
          unstableMatch && unstableMatch[1] ? unstableMatch[1] : '0.0.0';
        const stableVersion =
          stableMatch && stableMatch[1] ? stableMatch[1] : '0.0.0';

        setVersions({ unstable: unstableVersion, stable: stableVersion });
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  if (loading) {
    return 'Loading...';
  }

  if (error) {
    return { error };
  }

  return versions;
};
