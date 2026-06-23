#!/bin/bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

if command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y --no-install-recommends bash ca-certificates python3
  rm -rf /var/lib/apt/lists/*
fi

chmod +x /installed-agent/ruhroh_loop_controller.py
