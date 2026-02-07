# Next Steps / Improvements

This file tracks planned improvements for `tg-img-relay-bot`.

## High-priority

1) **Animated stickers (.tgs) support**
   - Current behavior: `.tgs` (Lottie) stickers are skipped in v1.
   - Goal: render a single frame (or short preview) and forward to relay chat.
   - Likely approach options:
     - Use a Node library / tool that can render Lottie (`.tgs`) to PNG.
     - Or convert `.tgs` → `.webm` / `.gif` with a CLI, then extract frame via ffmpeg.
   - Notes: this is the main missing Telegram media type.

2) **Better frame selection**
   - Current behavior: always extracts the first frame.
   - Problem: first frame is often blank for animations.
   - Goal: pick a more representative frame.
   - Options:
     - Extract at time offset (e.g. 0.25s or 25% of duration).
     - Extract multiple frames (e.g. 5) and choose the sharpest / most-different.

3) **Deployment guide (Hostinger VPS)**
   - Add instructions for:
     - installing Node + ffmpeg
     - running under `pm2` or `systemd` (restart on reboot)
     - log location + troubleshooting

## Medium-priority

4) **Allowlist-first defaults**
   - Encourage `ALLOWED_SOURCE_CHAT_IDS` usage to prevent the bot from relaying from unintended groups.

5) **Rate limiting / spam control**
   - Per-chat or per-user cooldown (e.g., max N relays per minute).

6) **Error reporting**
   - Optional: send errors to relay chat (or to a separate admin chat) when conversions fail.

## Housekeeping

7) **Repo polish**
   - Add MIT license
   - Add CONTRIBUTING / CHANGELOG
   - Add `.nvmrc`
