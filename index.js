import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Telegraf } from 'telegraf';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN');

const RELAY_CHAT_ID = Number(process.env.RELAY_CHAT_ID);
if (!RELAY_CHAT_ID) throw new Error('Missing RELAY_CHAT_ID');

const MAX_FRAME_WIDTH = Number(process.env.MAX_FRAME_WIDTH || '1024');

// Optional allowlist of source chats (comma-separated). If empty, process any chat.
const ALLOWED_SOURCE_CHAT_IDS = (process.env.ALLOWED_SOURCE_CHAT_IDS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(Number);

function isAllowedChat(chatId) {
  if (!ALLOWED_SOURCE_CHAT_IDS.length) return true;
  return ALLOWED_SOURCE_CHAT_IDS.includes(chatId);
}

const bot = new Telegraf(TOKEN);

function tmpFile(ext) {
  const name = crypto.randomBytes(16).toString('hex') + ext;
  return path.join(os.tmpdir(), name);
}

async function downloadTelegramFile(ctx, fileId, outPath) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
  return outPath;
}

async function ffmpegExtractFrame(inPath, outPath) {
  // Extract first frame as PNG; cap width to keep payload manageable.
  // scale expression: if iw > MAX then scale down else keep.
  const scaleExpr = `scale=iw*min(1\\,${MAX_FRAME_WIDTH}/iw):-1`;

  await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-i', inPath,
    '-frames:v', '1',
    '-vf', scaleExpr,
    outPath,
  ]);
  return outPath;
}

async function webpToPng(inPath, outPath) {
  await sharp(inPath).png().toFile(outPath);
  return outPath;
}

function safeName(ctx) {
  const from = ctx.from;
  if (!from) return 'unknown';
  if (from.username) return `@${from.username}`;
  const n = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  return n || `user:${from.id}`;
}

function sourceChatLabel(ctx) {
  const chat = ctx.chat;
  if (!chat) return 'unknown';
  if (chat.title) return `${chat.title} (${chat.id})`;
  return `${chat.type} (${chat.id})`;
}

function formatCaption(ctx, kind) {
  const from = safeName(ctx);
  const src = sourceChatLabel(ctx);
  const text = ctx.message?.text || ctx.message?.caption || '';
  const textLine = text ? `\nText: ${text}` : '';

  return `Extracted still from ${kind}\nFrom: ${from}\nSource: ${src}${textLine}`;
}

async function sendToRelay(ctx, photoPath, caption) {
  await ctx.telegram.sendPhoto(
    RELAY_CHAT_ID,
    { source: photoPath },
    { caption }
  );
}

async function handleSticker(ctx, sticker) {
  // static sticker: webp
  // video sticker: webm
  // animated sticker: tgs (skip v1)
  if (sticker.is_animated) return; // v1 skip .tgs

  const kind = sticker.is_video ? 'video sticker' : 'sticker';
  const ext = sticker.is_video ? '.webm' : '.webp';

  const inPath = tmpFile(ext);
  const outPath = tmpFile('.png');

  try {
    await downloadTelegramFile(ctx, sticker.file_id, inPath);
    if (ext === '.webp') await webpToPng(inPath, outPath);
    else await ffmpegExtractFrame(inPath, outPath);

    await sendToRelay(ctx, outPath, formatCaption(ctx, kind));
  } finally {
    fs.rmSync(inPath, { force: true });
    fs.rmSync(outPath, { force: true });
  }
}

async function handleAnimation(ctx, animation) {
  const inPath = tmpFile('.mp4');
  const outPath = tmpFile('.png');

  try {
    await downloadTelegramFile(ctx, animation.file_id, inPath);
    await ffmpegExtractFrame(inPath, outPath);
    await sendToRelay(ctx, outPath, formatCaption(ctx, 'animation/GIF'));
  } finally {
    fs.rmSync(inPath, { force: true });
    fs.rmSync(outPath, { force: true });
  }
}

async function handleDocument(ctx, document) {
  const mime = document.mime_type || '';
  const name = document.file_name || '';

  const looksLikeGif = mime === 'image/gif' || name.toLowerCase().endsWith('.gif');
  const looksLikeVideo = mime.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(name);
  if (!looksLikeGif && !looksLikeVideo) return;

  const inExt = (name.match(/\.[a-z0-9]+$/i)?.[0] || (looksLikeGif ? '.gif' : '.mp4'));
  const inPath = tmpFile(inExt);
  const outPath = tmpFile('.png');

  try {
    await downloadTelegramFile(ctx, document.file_id, inPath);
    await ffmpegExtractFrame(inPath, outPath);

    const kind = looksLikeGif ? 'GIF (document)' : 'video (document)';
    await sendToRelay(ctx, outPath, formatCaption(ctx, kind));
  } finally {
    fs.rmSync(inPath, { force: true });
    fs.rmSync(outPath, { force: true });
  }
}

async function handleMessage(ctx) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  // Avoid loops
  if (chatId === RELAY_CHAT_ID) return;

  if (!isAllowedChat(chatId)) return;

  const m = ctx.message;
  if (!m) return;

  if (m.sticker) return handleSticker(ctx, m.sticker);
  if (m.animation) return handleAnimation(ctx, m.animation);
  if (m.document) return handleDocument(ctx, m.document);
}

bot.on('message', async (ctx) => {
  try {
    await handleMessage(ctx);
  } catch (e) {
    console.error('handler error:', e);
  }
});

bot.command('ping', (ctx) => ctx.reply('pong'));

bot.launch();
console.log('tg-img-relay-bot running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
