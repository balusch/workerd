#!/bin/bash

bazel build -c dbg //src/workerd/server:workerd
bazel run @hedron_compile_commands//:refresh_all -- --compilation_mode=dbg

