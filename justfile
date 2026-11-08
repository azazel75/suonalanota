# -*- coding: utf-8 -*-
# :Project:  suona-la-nota -- the commands of the loop
# :Created:  sab 07 nov 2026 23:17:57 CET
# :Author:   Alberto Berti <alberto@metapensiero.it>
# :License:  GNU General Public License version 3 or later
#
# Every recipe enters the devShell: no host-installed node or npm is assumed.
#
# `DEVSHELL=` disables that, when a recipe is run from inside `nix develop`.
#
# A flake in a git repository sees only the files git tracks — the index or
# HEAD, never the working tree. A freshly created repository therefore has an
# *empty* flake source, and `nix develop` fails with "Path 'flake.nix' is not
# tracked by Git" until someone runs `git add`. `nix develop path:.` works
# before that, at the price of copying the whole directory, node_modules
# included, on every invocation.
#
set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

devshell := env("DEVSHELL", "nix develop --command")

# Everything the gate runs, cheapest failure first.
default: check

# Fetch the JavaScript dependencies from package-lock.json.
install:
    {{devshell}} npm install

# Type-check the sources and the tests.
types:
    {{devshell}} npm run types

# Run the unit tests of the detector and of the onset detector.
test:
    {{devshell}} npm test

# Build the static directory in dist/.
build:
    {{devshell}} npm run build

# Type-check, test, build.
check: types test build
    @echo "suona-la-nota: all checks passed"

# Development server on the local network, over http: fine on this machine,
# useless for the microphone, which a phone grants only over https.
dev:
    {{devshell}} npm run dev -- --host

# Serve dist/ over https with a throwaway certificate, so that a phone on the
# same network can open the spike and use its microphone.
serve-tls: build
    {{devshell}} node scripts/serve-tls.mjs
