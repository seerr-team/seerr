#!/bin/sh

# Resolve timezone from mounted files when TZ is not explicitly set.
# This lets Docker users mount /etc/timezone or /etc/localtime instead
# of passing -e TZ=Region/City.
if [ -z "$TZ" ]; then
  if [ -f /etc/timezone ]; then
    TZ=$(cat /etc/timezone | tr -d '[:space:]')
    export TZ
  elif [ -L /etc/localtime ]; then
    TZ=$(readlink /etc/localtime | sed 's|.*/zoneinfo/||')
    export TZ
  fi
fi

exec "$@"
