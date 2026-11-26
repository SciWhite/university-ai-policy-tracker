#!/usr/bin/env bash
# Run a long host command in the background and wait for it without holding an SSH session open
# (docs/content-release.md §5, "Long host commands").
#
# The pid, exit code and log live in the SSH user's own ~/uapt-ops/<op-id>/ on the host. On
# 2026-11-21 a wait loop wrote its pidfile into a root-owned /srv/uapt/operations/<op>/ directory,
# got "Permission denied", never learned the PID and had to be stopped by hand. Commands that need
# root use sudo inside the command; the bookkeeping files never do.
#
#   scripts/release/remote-bg.sh start <op-id> -- <command ...>   # prints the PID
#   scripts/release/remote-bg.sh wait  <op-id> [timeout-seconds]  # exit code of the command (124 on timeout)
#   scripts/release/remote-bg.sh status <op-id>
#   scripts/release/remote-bg.sh tail  <op-id> [lines]
# HOST defaults to hermes-agent-prod (override with UAPT_HOST).
#
# `wait` polls in short SSH calls (every UAPT_BG_POLL_SECONDS, default 30) instead of holding one
# silent session. On 2026-11-26 (V6 batch 9) a single long `ssh … while kill -0` lost its TCP
# session while the operator Mac slept; ssh noticed only ~2 h 20 min later ("Connection reset by
# peer", exit 255), long after the job had ended. Every ssh call also sends keepalives
# (ServerAliveInterval=15, ServerAliveCountMax=4: a dead session fails within about a minute).
# A failed poll (ssh exit 255) is retried; after UAPT_BG_MAX_MISSES (default 10) failures in a
# row `wait` exits 255, as a lost session did before.
set -euo pipefail

HOST="${UAPT_HOST:-hermes-agent-prod}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4)
action="${1:-}"; op="${2:-}"
if [[ -z "$action" || -z "$op" ]]; then sed -n '2,22p' "$0"; exit 2; fi
if [[ ! "$op" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]]; then echo "invalid op id: $op" >&2; exit 2; fi
dir="uapt-ops/$op"  # relative to the remote user's home
remote() {
  # UAPT_HOST=local runs the same script in a local shell (tests).
  if [[ "$HOST" == local ]]; then bash -c "$1"; else ssh "${SSH_OPTS[@]}" "$HOST" "$1"; fi
}

case "$action" in
  start)
    shift 2
    [[ "${1:-}" == "--" ]] && shift
    [[ $# -gt 0 ]] || { echo "start needs a command after --" >&2; exit 2; }
    # The command travels on stdin into command.sh, so no second layer of quoting is needed.
    # The wrapper records the command's exit code in run.exit; run.pid is the wrapper's PID.
    printf '%q ' "$@" | remote "set -e; umask 077; mkdir -p ~/$dir; cd ~/$dir
      if test -e run.pid; then echo 'op already started: ~/$dir' >&2; exit 3; fi
      cat > command.sh; echo >> command.sh
      nohup bash -c 'bash ./command.sh; echo \$? > run.exit' > run.log 2>&1 < /dev/null &
      echo \$! > run.pid; cat run.pid"
    ;;
  wait)
    timeout="${3:-7200}"
    [[ "$timeout" =~ ^[0-9]+$ ]] || { echo "timeout must be whole seconds" >&2; exit 2; }
    poll="${UAPT_BG_POLL_SECONDS:-30}"; max_misses="${UAPT_BG_MAX_MISSES:-10}"
    [[ "$poll" =~ ^[0-9]+([.][0-9]+)?$ && "$max_misses" =~ ^[1-9][0-9]*$ ]] || { echo "bad UAPT_BG_POLL_SECONDS or UAPT_BG_MAX_MISSES" >&2; exit 2; }
    end=$((SECONDS + timeout)); misses=0
    while :; do
      # One short call per poll: running | exit=<n> | noexit | nojob
      rc=0
      state=$(remote "cd ~/$dir 2>/dev/null && test -s run.pid || { echo nojob; exit 0; }; pid=\$(cat run.pid)
        if kill -0 \"\$pid\" 2>/dev/null; then echo running; elif test -s run.exit; then echo \"exit=\$(cat run.exit)\"; else echo noexit; fi") || rc=$?
      if [[ $rc -eq 0 ]]; then
        misses=0
        case "$state" in
          running) ;;
          exit=*) code="${state#exit=}"; [[ "$code" =~ ^[0-9]+$ ]] || { echo "bad exit record: $code" >&2; exit 125; }; exit "$code" ;;
          noexit) echo 'process ended without an exit record' >&2; exit 125 ;;
          nojob) echo "no such job: ~/$dir" >&2; exit 125 ;;
          *) echo "unexpected status: $state" >&2; exit 125 ;;
        esac
      else
        misses=$((misses + 1))
        echo "status poll failed (exit $rc, $misses in a row)" >&2
        [[ $misses -lt $max_misses ]] || { echo "host unreachable for $misses polls; the job may still be running" >&2; exit 255; }
      fi
      [[ $SECONDS -lt $end ]] || { echo "still running after ${timeout}s" >&2; exit 124; }
      sleep "$poll"
    done
    ;;
  status)
    remote "cd ~/$dir; pid=\$(cat run.pid); if kill -0 \"\$pid\" 2>/dev/null; then echo \"running pid=\$pid\"; elif test -s run.exit; then echo \"finished exit=\$(cat run.exit)\"; else echo 'ended without an exit record'; fi"
    ;;
  tail)
    lines="${3:-50}"; [[ "$lines" =~ ^[0-9]+$ ]] || { echo "lines must be a number" >&2; exit 2; }
    remote "tail -n $lines ~/$dir/run.log"
    ;;
  *) echo "unknown action: $action" >&2; exit 2 ;;
esac
