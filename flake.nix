{
  description = "Mediaserver - Self-hosted media streaming platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js (with corepack for yarn 3+)
            nodejs_20
            corepack
            bun

            # Database
            sqlite

            # Job queue (Redis-compatible)
            valkey

            # Media processing
            ffmpeg

            # Development tools
            git
            jq
            curl

            # Optional: for Tailscale integration
            # tailscale
          ];

          shellHook = ''
            # Enable corepack for Yarn 3+
            export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
            corepack enable >/dev/null 2>&1

            # === Required Environment Variables ===
            # Use absolute path to avoid issues with CWD changes
            export DATABASE_URL="file:$PWD/apps/server/data/mediaserver.db"
            export JWT_SECRET="dev-jwt-secret-change-in-production-32chars"
            export JWT_REFRESH_SECRET="dev-refresh-secret-change-in-production-32ch"

            # === Server Configuration ===
            export PORT="3000"
            export HOST="0.0.0.0"
            export NODE_ENV="development"
            export LOG_LEVEL="debug"

            # === Redis/Valkey Configuration ===
            export REDIS_URL="redis://localhost:6379"
            export VALKEY_DATA_DIR="$PWD/.valkey"

            # === Paths ===
            export DATA_DIR="./data"
            export TRANSCODES_DIR="./transcodes"
            export CACHE_DIR="./cache"
            export LOGS_DIR="./logs"

            # Create data directories if they don't exist
            mkdir -p apps/server/data
            mkdir -p .valkey

            # Only show banner once per shell session
            if [ -z "$MEDIASERVER_ENV_LOADED" ]; then
              export MEDIASERVER_ENV_LOADED=1
              echo ""
              echo "🎬 Mediaserver Development Environment"
              echo "======================================="
              echo "Node.js: $(node --version)"
              echo "Yarn:    $(yarn --version 2>/dev/null || echo 'run: corepack enable')"
              echo "Bun:     $(bun --version)"
              echo "Valkey:  $(valkey-server --version 2>/dev/null | head -1 || echo 'available')"
              echo ""
              echo "Commands:"
              echo "  yarn dev      - Start all services (Valkey + Server + Web)"
              echo "  yarn stop     - Stop all services"
              echo "  yarn status   - Check service status"
              echo "  yarn restart  - Restart all services"
              echo "  yarn logs     - Tail all logs"
              echo ""
            fi
          '';
        };
      }
    );
}
