{
  stdenv,
  compose2nix,
  git,
  ...
}:
stdenv.mkDerivation {
  name = "jank-client";
  src = ./.;
  nativeBuildInputs = [
    git
    compose2nix
  ];
  buildPhase = ''
    echo "#!/usr/bin/env bash" > start-server
    echo "systemctl start docker-build-jank-client-jank.service" >> start-server
    echo "systemctl restart docker-jank-client-jank.service" >> start-server
    chmod a+x start-server
    git init
    git add -A
    git config user.name "name"
    git config user.email "name@url"
    git commit -m "init"
  '';
  installPhase = ''
    mkdir $out/bin -p
    mkdir $out/src -p
    cp start-server $out/bin/jank-client
    cp . $out/src -r
  '';
  meta = {
    mainProgram = "jank-client";
    description = "jank-client";
    homepage = "https://git.mtgmonkey.net/jank-client-fork.git";
  };
}
