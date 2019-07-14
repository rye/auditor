# Degreepath, the automated degree auditor

- Requires [`nuitka`](https://www.nuitka.net/pages/download.html), a Python-to-C compiler
- Requires [`afl-clang`](http://lcamtuf.coredump.cx/afl/), part of the `afl` (american fuzzy lop) fuzzer

> If you wish to use `afl-gcc` instead, you may do so with `make CC=afl-gcc run`.

```
$ <install nuitka>
$ <install afl>
$ python3 install -r requirements.txt
$ make run
```

Change around the .YAML example file, which is my student data and the Asian Studies major, and have fun!

```
Copyright (C) 2019  Hawken MacKay Rives

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```
