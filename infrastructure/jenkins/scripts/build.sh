#!/bin/bash
set -eu

docker build -t "$1" "$2"
