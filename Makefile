export CC = afl-clang

build: dp-afl.dist/dp-afl

run: dp-afl.dist/dp-afl
	dp-afl.dist/dp-afl < 122932.yaml

c: dp-afl.py $(wildcard degreepath/**/*.py)
	nuitka3 --standalone --python-flag=no_site --generate-c-only dp-afl.py

dp-afl.dist/dp-afl: dp-afl.py $(wildcard degreepath/**/*.py)
	nuitka3 --standalone --python-flag=no_site dp-afl.py

env:
	env

.PHONY: c run build
