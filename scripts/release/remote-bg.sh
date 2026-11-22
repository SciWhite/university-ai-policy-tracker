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
set -euo pipefail

HOST="${UAPT_HOST:-hermes-agent-prod}"
action="${1:-}"; op="${2:-}"
if [[ -z "$action" || -z "$op" ]]; then sed -n '2,15p' "$0"; exit 2; fi
if [[ ! "$op" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]]; then echo "invalid op id: $op" >&2; exit 2; fi
dir="uapt-ops/$op"  # relative to the remote user's home
remote() {
  # UAPT_HOST=local runs the same script in a local shell (tests).
  if [[ "$HOST" == local ]]; then bash -c "$1"; else ssh -o BatchMode=yes -o ConnectTimeout=20 "$HOST" "$1"; fi
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
    remote "cd ~/$dir; pid=\$(cat run.pid); end=\$((SECONDS + $timeout));
      while kill -0 \"\$pid\" 2>/dev/null; do [ \$SECONDS -lt \$end ] || { echo 'still running after ${timeout}s' >&2; exit 124; }; sleep 10; done;
      test -s run.exit || { echo 'process ended without an exit record' >&2; exit 125; }; exit \$(cat run.exit)"
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
