{
  inputs = {
    nixpkgs.url = "nixpkgs/nixos-unstable";
  };
  outputs = {nixpkgs, ...}: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    pkg = pkgs.stdenv.mkDerivation {
      name = "jank-client";
      src = ./.;
      nativeBuildInputs = [
        pkgs.compose2nix
      ];
      buildPhase = ''
        compose2nix -runtime "docker" -inputs "compose.yaml" -output "jank-client.nix" -project "jank-client"
        echo "#!/usr/bin/env bash" > start-server
        echo "systemctl start docker-build-jank-client-jank.service" >> start-server
        echo "systemctl restart docker-jank-client-jank.service" >> start-server
      '';
      installPhase = ''
        mkdir $out/bin -p
        cp start-server $out/bin/jank-client
        cp jank-client.nix $out/jank-client.nix
      '';
    };
  in {
    packages.${system}.default = pkg;
    nixosModules.${system}.default = {
      lib,
      config,
      ...
    }: {
      imports = [(builtins.toPath "${config.services.jank-client.package}/jank-client.nix")];
      options = {
        services.jank-client = {
          enable = lib.mkEnableOption "jank client";
          package = lib.mkOption {
            description = "jank client package";
            default = pkgs.callPackage pkg;
            type = lib.types.package;
          };
        };
      };
      config = lib.mkIf config.services.jank-client.enable {
        environment.systemPackages = [
          (lib.getExe
            config.services.jank-client.package)
        ];
      };
    };
  };
}
