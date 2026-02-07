# Telegram Image Relay Bot (GIF/Sticker → still image)

Listens for stickers / GIFs / animations in source groups and forwards a *still image* (frame) to a separate relay chat (no duplicates in the source group).

## Features

- Supports:
  - Static stickers (`.webp`) → PNG
  - Video stickers (`.webm`) → PNG frame
  - Animations (Telegram “GIFs”, usually mp4) → PNG frame
  - GIFs/videos sent as `document` → PNG frame
- Sends output **only** to a configured relay chat
- Optional allowlist for monitored source chat IDs
- Avoids loops by ignoring messages originating from the relay chat

## Setup

### 1) Install deps

Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
```

### 2) Install node deps

```bash
npm i
```

### 3) Configure env

Copy the example file:

```bash
cp .env.example .env
```

Edit `.env`:

- `TELEGRAM_BOT_TOKEN` – bot token from BotFather
- `RELAY_CHAT_ID` – relay group id (e.g. `-100...`)
- Optional: `ALLOWED_SOURCE_CHAT_IDS` – comma-separated list of source group ids

### 4) Run

```bash
npm start
```

## Notes

- For the bot to see all messages in a group, disable privacy:
  - BotFather → `/setprivacy` → Disable
- Animated stickers (`.tgs`) are **not handled** in v1.

