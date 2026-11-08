# -*- coding: utf-8 -*-
# :Project:  suona-la-nota -- the development shell, the package and the checks
# :Created:  sab 07 nov 2026 23:17:57 CET
# :Author:   Alberto Berti <alberto@metapensiero.it>
# :License:  GNU General Public License version 3 or later
#
# Node and the toolchain come from nixpkgs; the JavaScript dependencies come from
# package-lock.json, fetched once and pinned through `npmDepsHash`. The build never
# touches the network, so `nix build` produces the same directory on any machine
# with the same flake.lock.
#
# The package is the static site itself — the app, the spike pages and every
# bundled script — because that directory is what gets deployed.
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
        { pkgs, lib, ... }:
        let
          nodejs = pkgs.nodejs_22;

          # Only what git would carry: a stray node_modules or dist in the working
          # directory must not leak into the build.
          src = lib.cleanSourceWith {
            src = ./.;
            filter =
              path: type:
              let
                base = baseNameOf path;
              in
              !(builtins.elem base [
                "node_modules"
                "dist"
                "result"
                ".scratch"
                ".direnv"
              ]);
          };

          site = pkgs.buildNpmPackage {
            pname = "suona-la-nota";
            version = "0.1.0";
            inherit src;

            # A wrong hash makes `nix build` fail and print the right one.
            npmDepsHash = "sha256-tHUbdLcna5rsa3ulkIJg5G2hPpjMNw5z986HznExspg=";

            nativeBuildInputs = [ nodejs ];

            # `npm run build` runs `tsc --noEmit` first: a package whose sources do
            # not type-check does not build.
            npmBuildScript = "build";

            installPhase = ''
              runHook preInstall
              mkdir -p $out
              cp -r dist/. $out/
              runHook postInstall
            '';

            meta = {
              description = "Esercizi di lettura del pentagramma con ascolto dal microfono";
              license = lib.licenses.gpl3Plus;
            };
          };
        in
        {
          packages = {
            default = site;
            inherit site;
          };

          # The same pinned dependencies, without the build: the tests and the type
          # checker run offline, inside the sandbox, against exactly what ships.
          checks.tests = site.overrideAttrs (_: {
            pname = "suona-la-nota-tests";
            buildPhase = "npm test";
            installPhase = "mkdir -p $out && touch $out/passed";
          });

          checks.types = site.overrideAttrs (_: {
            pname = "suona-la-nota-types";
            buildPhase = "npm run types";
            installPhase = "mkdir -p $out && touch $out/passed";
          });

          devShells.default = pkgs.mkShell {
            packages = [
              nodejs
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
