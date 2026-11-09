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

          # `nix run .` is how the app is *used*: it builds `dist/` from the
          # working tree, serves it over HTTPS on every interface (8443, or
          # `PORT`) and opens the page in the browser. The same server as
          # `just serve-tls`, with node and openssl from the closure so that no
          # dev shell is needed. The page is built here, not taken from the
          # flake, because the point is to look at what is on disk right now.
          serve = pkgs.writeShellApplication {
            name = "suona-la-nota";
            runtimeInputs = [
              nodejs
              pkgs.openssl
              pkgs.xdg-utils
              pkgs.coreutils
            ];
            text = ''
              if [ ! -f package.json ] || [ ! -f scripts/serve-tls.mjs ]; then
                echo "suona-la-nota: esegui questo comando dalla radice del repository" >&2
                exit 1
              fi
              if [ ! -d node_modules ]; then
                echo "suona-la-nota: manca node_modules: esegui \`just install\` una volta" >&2
                exit 1
              fi
              npm run build
              exec node scripts/serve-tls.mjs
            '';
          };
        in
        {
          packages = {
            default = site;
            inherit site;
          };

          # `nix run` starts the app on 0.0.0.0:8443 — the whole point is to use it
          # from another device, where only https gets the microphone.
          apps.default = {
            type = "app";
            program = "${serve}/bin/suona-la-nota";
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

          # `nix run` opens HTTPS on 0.0.0.0:8443 — the app on this machine and on
          # a phone — and this check is the server's: a page in dist/, the real
          # script, and the question «does it answer over TLS?». No browser.
          checks.serve =
            pkgs.runCommand "suona-la-nota-serve-smoke" {
              nativeBuildInputs = [
                nodejs
                pkgs.openssl
                pkgs.curl
                pkgs.coreutils
              ];
            }
              ''
                mkdir -p dist
                echo '<!doctype html><title>Suona la nota</title><h1>Suona la nota</h1>' > dist/index.html
                OPEN=0 PORT=18443 node ${./scripts/serve-tls.mjs} &
                pid=$!
                for _ in $(seq 1 100); do
                  if curl -fsSk https://127.0.0.1:18443/ -o page.html 2>/dev/null; then break; fi
                  sleep 0.1
                done
                kill "$pid" || true
                wait "$pid" || true
                grep -q "Suona la nota" page.html
                touch $out
              '';

          devShells.default = pkgs.mkShell {
            packages = [
              nodejs
              # The commands of the loop: `just check` before every commit.
              pkgs.just
              # serve-tls.mjs asks openssl for a throwaway certificate: a phone
              # grants the microphone only in a secure context.
              pkgs.openssl
              # and xdg-open opens the page once the port answers.
              pkgs.xdg-utils
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
