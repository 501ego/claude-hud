#!/usr/bin/env python3
"""
Claude HUD usage-reset notifier — cross-platform (Linux, macOS, Windows).
Reads ~/.claude/plugins/claude-hud/usage-state.json and fires
desktop notifications + sound when a usage window resets.

Install via cron (crontab -e):
  * * * * * python3 ~/.claude/scripts/claude-notify.py
"""

import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE    = Path.home() / ".claude" / "plugins" / "claude-hud" / "usage-state.json"
NOTIFIED_FILE = Path.home() / ".claude" / "plugins" / "claude-hud" / "notified-resets.json"

OS = platform.system()  # "Linux", "Darwin", "Windows"
UID = os.getuid() if OS != "Windows" else 0

if OS == "Linux":
    os.environ.setdefault("DISPLAY", ":0")
    os.environ.setdefault("DBUS_SESSION_BUS_ADDRESS", f"unix:path=/run/user/{UID}/bus")


# ── Notification methods ──────────────────────────────────────────────────────

def _spawn(*cmd) -> None:
    try:
        subprocess.Popen(list(cmd), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except (FileNotFoundError, OSError):
        pass


def notify_desktop(title: str, body: str) -> None:
    if OS == "Linux":
        _spawn("notify-send", "-u", "normal", "-t", "10000",
               "-i", "dialog-information", title, body)
    elif OS == "Darwin":
        script = f'display notification "{body}" with title "{title}" sound name "Ping"'
        _spawn("osascript", "-e", script)
    elif OS == "Windows":
        ps = (
            f"Add-Type -AssemblyName System.Windows.Forms;"
            f"[System.Windows.Forms.MessageBox]::Show('{body}','{title}')"
        )
        _spawn("powershell", "-WindowStyle", "Hidden", "-Command", ps)


def play_sound() -> None:
    if OS == "Linux":
        sounds = [
            "/usr/share/sounds/freedesktop/stereo/complete.oga",
            "/usr/share/sounds/freedesktop/stereo/message-new-instant.oga",
            "/usr/share/sounds/freedesktop/stereo/bell.oga",
        ]
        for s in sounds:
            if Path(s).exists():
                _spawn("paplay", s)
                return
        _spawn("aplay", "/usr/share/sounds/alsa/Front_Center.wav")
    elif OS == "Darwin":
        _spawn("afplay", "/System/Library/Sounds/Ping.aiff")
    elif OS == "Windows":
        _spawn("powershell", "-Command", "[console]::beep(880,400)")


def warp_notify(message: str) -> None:
    sys.stdout.write(f"\x1b]9;{message}\x1b\\")
    sys.stdout.flush()


def terminal_bell() -> None:
    sys.stdout.write("\a")
    sys.stdout.flush()


def fire(methods: list, title: str, body: str) -> None:
    if "notify-send" in methods:
        notify_desktop(title, body)
        play_sound()
    if "warp" in methods:
        warp_notify(f"{title}: {body}")
    if "bell" in methods:
        terminal_bell()


# ── Core logic ────────────────────────────────────────────────────────────────

def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception:
        return {}


def save_json(path: Path, data: dict) -> None:
    try:
        path.write_text(json.dumps(data))
    except Exception:
        pass


def parse_iso(s) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def main() -> None:
    if "--test" in sys.argv:
        fire(["notify-send", "bell"], "claude-hud test notification", "If you see this, notifications are working.")
        sys.exit(0)

    state = load_json(STATE_FILE)
    if not state:
        return

    notif = state.get("notifications", {})
    if not notif.get("enabled", False):
        return
    if not notif.get("onUsageReset", True):
        return

    methods: list       = notif.get("methods", ["notify-send", "bell"])
    minutes_before: int = int(notif.get("minutesBefore", 0))

    now = datetime.now(timezone.utc)
    notified = load_json(NOTIFIED_FILE)
    changed = False

    windows = {
        "5h": {
            "reset_at": parse_iso(state.get("fiveHourResetAt")),
            "percent":  state.get("fiveHour"),
            "label":    "5-hour tokens",
        },
        "7d": {
            "reset_at": parse_iso(state.get("sevenDayResetAt")),
            "percent":  state.get("sevenDay"),
            "label":    "Weekly tokens",
        },
    }

    for key, window in windows.items():
        reset_at = window["reset_at"]
        percent  = window["percent"]
        if reset_at is None or percent is None or percent < 10:
            continue

        trigger_ts   = reset_at.timestamp() - (minutes_before * 60)
        notified_key = f"{key}:{reset_at.isoformat()}"

        if now.timestamp() >= trigger_ts and not notified.get(notified_key):
            if minutes_before > 0:
                title = "Claude — tokens resetting soon"
                body  = f"{window['label']} reset in {minutes_before} min — get ready"
            else:
                title = "Claude — tokens refreshed"
                body  = f"{window['label']} refreshed. Full quota available."

            fire(methods, title, body)

            notified[notified_key] = now.isoformat()
            changed = True

            keys = list(notified.keys())
            if len(keys) > 10:
                for old in keys[:-10]:
                    del notified[old]

    if changed:
        save_json(NOTIFIED_FILE, notified)


if __name__ == "__main__":
    main()
