{
  stdenv,
  compose2nix,
  ...
}:
stdenv.mkDerivation {
  name = "jank-client";
  src = ./.;
  nativeBuildInputs = [
    compose2nix
  ];
  buildPhase = ''
    echo "#!/usr/bin/env bash" > start-server
    echo "systemctl start docker-build-jank-client-jank.service" >> start-server
    echo "systemctl restart docker-jank-client-jank.service" >> start-server
  '';
  installPhase = ''
    mkdir $out/bin -p
    mkdir $out/src -p
    cp start-server $out/bin/jank-client
    cp . $out/src -r
  '';
}
