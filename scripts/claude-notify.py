#!/usr/bin/env python3
"""
Claude HUD usage-reset notifier — cross-platform (Linux, macOS, Windows).
Reads ~/.claude/plugins/claude-hud/usage-state.json and fires
desktop notifications + sound when a usage window resets.
"""

import json
import os
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Try to import locking modules for different platforms
try:
    if platform.system() == "Windows":
        import msvcrt
    else:
        import fcntl
except ImportError:
    msvcrt = None
    fcntl = None

STATE_FILE    = Path.home() / ".claude" / "plugins" / "claude-hud" / "usage-state.json"
NOTIFIED_FILE = Path.home() / ".claude" / "plugins" / "claude-hud" / "notified-resets.json"
LOCK_FILE     = Path.home() / ".claude" / "plugins" / "claude-hud" / "notify.lock"

OS = platform.system()  # "Linux", "Darwin", "Windows"
UID = os.getuid() if OS != "Windows" else 0

if OS == "Linux":
    os.environ.setdefault("DISPLAY", ":0")
    os.environ.setdefault("DBUS_SESSION_BUS_ADDRESS", f"unix:path=/run/user/{UID}/bus")


# ── Locking ──────────────────────────────────────────────────────────────────

class Lock:
    def __init__(self, path: Path):
        self.path = path
        self.fd = None

    def __enter__(self):
        try:
            self.fd = open(self.path, "w")
            if OS == "Windows" and msvcrt:
                # Try to lock the first byte
                msvcrt.locking(self.fd.fileno(), msvcrt.LK_NBLCK, 1)
            elif fcntl:
                fcntl.flock(self.fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except (IOError, OSError):
            if self.fd:
                self.fd.close()
            return False

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.fd:
            try:
                self.fd.close()
                if self.path.exists():
                    self.path.unlink()
            except Exception:
                pass


# ── Notification methods ──────────────────────────────────────────────────────

def _spawn(*cmd) -> None:
    try:
        kwargs: dict = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
        if OS == "Windows":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
        subprocess.Popen(list(cmd), **kwargs)
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
        t = title.replace("'", "''")
        b = body.replace("'", "''")
        xml = (
            f'<toast><visual><binding template="ToastText02">'
            f'<text id="1">{t}</text><text id="2">{b}</text>'
            f'</binding></visual><audio silent="true"/></toast>'
        )
        ps = (
            "[Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]|Out-Null;"
            "[Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]|Out-Null;"
            "$x=[Windows.Data.Xml.Dom.XmlDocument]::new();"
            f"$x.LoadXml('{xml}');"
            "$n=[Windows.UI.Notifications.ToastNotification]::new($x);"
            "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($n)"
        )
        _spawn("powershell", "-Command", ps)


def play_sound(sound_file: str | None = None) -> None:
    if OS == "Linux":
        if sound_file and Path(sound_file).exists():
            _spawn("paplay", sound_file)
            return
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
        if sound_file and Path(sound_file).exists():
            _spawn("afplay", sound_file)
            return
        _spawn("afplay", "/System/Library/Sounds/Ping.aiff")
    elif OS == "Windows":
        if sound_file and Path(sound_file).exists():
            win_path = str(Path(sound_file).resolve()).replace("'", "''")
            ps = (
                f"Add-Type -AssemblyName presentationCore; "
                f"$p = New-Object System.Windows.Media.MediaPlayer; "
                f"$p.Open([uri]::new('{win_path}')); $p.Play(); "
                f"$d = 0; while (-not $p.NaturalDuration.HasTimeSpan -and $d -lt 30) {{ Start-Sleep -Milliseconds 100; $d++ }}; "
                f"if ($p.NaturalDuration.HasTimeSpan) {{ Start-Sleep -Seconds ([int]$p.NaturalDuration.TimeSpan.TotalSeconds + 1) }}"
            )
            try:
                subprocess.run(["powershell", "-Command", ps], timeout=30,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
            except Exception:
                pass
            return
        _spawn("powershell", "-Command",
               "Add-Type -AssemblyName System.Media; [System.Media.SystemSounds]::Asterisk.Play(); Start-Sleep -Milliseconds 500")


def warp_notify(message: str) -> None:
    sys.stdout.write(f"\x1b]9;{message}\x1b\\\\")
    sys.stdout.flush()


def terminal_bell() -> None:
    sys.stdout.write("\a")
    sys.stdout.flush()


def fire(methods: list, title: str, body: str, sound_file: str | None = None) -> None:
    if "notify-send" in methods:
        notify_desktop(title, body)
        play_sound(sound_file)
    if "warp" in methods:
        warp_notify(f"{title}: {body}")
    # skip bell when a sound file is already playing
    if "bell" in methods and not (sound_file and Path(sound_file).exists()):
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


PID_FILE = Path.home() / ".claude" / "plugins" / "claude-hud" / "notify-pid.json"


def schedule_reset_task(key: str, reset_at: datetime, minutes_before: int) -> None:
    from datetime import timedelta
    trigger_time = reset_at.astimezone() - timedelta(minutes=minutes_before)
    secs = int((trigger_time - datetime.now(trigger_time.tzinfo)).total_seconds())
    if secs <= 0:
        return

    # Use the script itself to fire the notification, ensuring state is updated
    this_script = Path(__file__).resolve()
    inline = (
        f"import time, subprocess, sys\n"
        f"time.sleep({secs})\n"
        f"subprocess.Popen([sys.executable, {repr(str(this_script))}], "
        f"creationflags=0x08000000, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)\n"
    )

    kwargs: dict = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if OS == "Windows":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    proc = subprocess.Popen([sys.executable, "-c", inline], **kwargs)

    pids = load_json(PID_FILE)
    pids[key] = proc.pid
    save_json(PID_FILE, pids)


def unschedule_reset_task(key: str) -> None:
    pids = load_json(PID_FILE)
    pid = pids.pop(key, None)
    save_json(PID_FILE, pids)
    if pid:
        try:
            if OS == "Windows":
                subprocess.run(["taskkill", "/PID", str(pid), "/F"],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                import signal
                os.kill(pid, signal.SIGTERM)
        except Exception:
            pass


KIND_LABELS = {"5h": "5-hour tokens", "7d": "Weekly tokens"}


def build_windows(state: dict) -> dict:
    """v2 state carries a windows[] list (one entry per rate-limit pool,
    keyed by kind+resetAt so concurrent sessions don't clobber each other).
    Falls back to the legacy single-pool fields."""
    entries = state.get("windows")
    if isinstance(entries, list) and entries:
        windows = {}
        for w in entries:
            if not isinstance(w, dict):
                continue
            kind = w.get("kind")
            if kind not in KIND_LABELS:
                continue
            reset_at = parse_iso(w.get("resetAt"))
            key = f"{kind}|{w.get('resetAt')}"
            windows[key] = {
                "reset_at": reset_at,
                "percent":  w.get("percent"),
                "label":    KIND_LABELS[kind],
            }
        return windows
    return {
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


def main() -> None:
    with Lock(LOCK_FILE) as acquired:
        if not acquired:
            return

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
        sound_file: str | None = notif.get("soundFile")

        now = datetime.now(timezone.utc)
        notified = load_json(NOTIFIED_FILE)
        changed = False

        windows = build_windows(state)

        for key, window in windows.items():
            reset_at = window["reset_at"]
            percent  = window["percent"]
            if reset_at is None or percent is None:
                continue

            exhausted_key = f"{key}:exhausted:{reset_at.isoformat()}"
            notified_key  = f"{key}:reset:{reset_at.isoformat()}"
            trigger_ts    = reset_at.timestamp() - (minutes_before * 60)

            # Silently arm when exhausted — schedule one-time OS task at reset time
            just_armed = False
            if percent >= 100 and not notified.get(exhausted_key):
                notified[exhausted_key] = now.isoformat()
                just_armed = True
                changed = True
                schedule_reset_task(key, reset_at, minutes_before)
            elif notified.get(exhausted_key) and not notified.get(notified_key) and now.timestamp() < trigger_ts:
                # Was exhausted, reset not yet fired — re-arm if no live process (e.g. after restart)
                pids = load_json(PID_FILE)
                pid  = pids.get(key)
                alive = False
                if pid:
                    try:
                        r = subprocess.run(["tasklist", "/FI", f"PID eq {pid}"],
                                           capture_output=True, text=True,
                                           creationflags=subprocess.CREATE_NO_WINDOW)
                        alive = str(pid) in r.stdout
                    except Exception:
                        pass
                if not alive:
                    schedule_reset_task(key, reset_at, minutes_before)

            # Fire reset alert only if armed AND reset time reached AND not already fired AND not in the same run we armed
            was_exhausted = bool(notified.get(exhausted_key))
            if was_exhausted and not just_armed and now.timestamp() >= trigger_ts and not notified.get(notified_key):
                if minutes_before > 0:
                    title = "Claude — quota resetting"
                    body  = f"{window['label']} resets in {minutes_before} min"
                else:
                    title = "Claude — quota restored"
                    body  = "Session quota refreshed. Ready to work."

                unschedule_reset_task(key)
                fire(methods, title, body, sound_file)
                notified[notified_key] = now.isoformat()
                changed = True

                keys = list(notified.keys())
                if len(keys) > 20:
                    # Sort to ensure we delete oldest
                    sorted_keys = sorted(keys, key=lambda k: notified[k])
                    for old in sorted_keys[:-20]:
                        del notified[old]

        if changed:
            save_json(NOTIFIED_FILE, notified)


if __name__ == "__main__":
    if "--test" in sys.argv:
        fire(["notify-send", "bell"], "claude-hud test notification", "If you see this, notifications are working.")
        sys.exit(0)
    main()
