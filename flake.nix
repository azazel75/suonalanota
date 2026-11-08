# -*- coding: utf-8 -*-
# :Project:  suona-la-nota -- the development shell and the static build
# :Created:  sab 07 nov 2026 23:17:57 CET
# :Author:   Alberto Berti <alberto@metapensiero.it>
# :License:  GNU General Public License version 3 or later
#
# Node and the toolchain come from nixpkgs, the JavaScript dependencies from
# package-lock.json through `npm install`. There is deliberately no `checks`
# output: every check this project runs needs node_modules, which the Nix
# sandbox has no network to fetch, so the gate lives in `just check` instead of
# in `nix flake check`. A check that cannot run is worse than no check.
#
{
  description = "PWA per esercitare la lettura del pentagramma, con ascolto dal microfono";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [ "x86_64-linux" ];

      perSystem =
        { pkgs, ... }:
        {
          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              # The commands of the loop: `just check` before every commit.
              pkgs.just
              # serve-tls.mjs asks openssl for a throwaway certificate: a phone
              # grants the microphone only in a secure context.
              pkgs.openssl
              pkgs.git
            ];

            shellHook = ''
              if [ ! -d node_modules ]; then
                echo "suona-la-nota: node_modules is missing, run \`just install\`" >&2
              fi
            '';
          };
        };
    };
}
