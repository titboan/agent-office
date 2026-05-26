import express from 'express';
import { Server } from 'colyseus';
import { createServer } from 'http';
import { OfficeRoom } from './rooms/OfficeRoom';
import path from 'path';

// Setup Express
const app = express();
app.use(express.json());

// Отдаём собранный UI
app.use(express.static(path.join(__dirname, '../../ui/dist')));

// Главная страница → UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../ui/dist/index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Basic REST API for Office Management
app.get('/api/offices', (req, res) => {
    res.json({ status: 'ok', offices: [] });
});

app.post('/api/vote-chaos', (req, res) => {
    const room = OfficeRoom.getActiveRoom();
    if (!room) {
        res.status(503).json({ ok: false, error: 'No active office room.' });
        return;
    }
    const { event, voterId } = req.body || {};
    const result = room.registerAudienceVote(event || 'server_outage', voterId);
    res.json({ ok: true, ...result });
});

app.get('/api/episode-recap', (req, res) => {
    const room = OfficeRoom.getActiveRoom();
    if (!room) {
        res.status(503).json({ ok: false, error: 'No active office room.' });
        return;
    }
    res.json({ ok: true, recap: room.getEpisodeRecap() });
});

app.get('/api/status', (req, res) => {
    const room = OfficeRoom.getActiveRoom();
    if (!room) {
        res.json({ ok: true, online: false, agents: [] });
        return;
    }
    const recap = room.getEpisodeRecap();
    res.json({
        ok: true,
        online: true,
        agents: recap.leaderboard.map((a: any) => ({
            name: a.name,
            action: a.action,
            mood: Math.round(a.mood * 100),
            momentum: Math.round(a.momentum * 100),
            task: a.currentTask || null
        }))
    });
});

app.post('/api/assign-task', (req, res) => {
    const room = OfficeRoom.getActiveRoom();
    if (!room) {
        res.status(503).json({ ok: false, error: 'No active office room.' });
        return;
    }
    const { title, agentId } = req.body || {};
    if (!title) {
        res.status(400).json({ ok: false, error: 'title is required' });
        return;
    }
    // Вызываем публичный метод напрямую (onMessage — регистратор, а не вызов)
    room.assignTask(title, agentId);
    res.json({ ok: true, assigned: true });
});

// Create HTTP and Colyseus server
const httpServer = createServer(app);
const colyseusServer = new Server({
    server: httpServer,
});

// Define Rooms
colyseusServer.define('office', OfficeRoom);

// Глобальный перехват unhandledRejection — не даём процессу упасть из-за
// ошибок в async-цепочках агентов (вызовы Claude API, SQLite и т.д.)
process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection (caught, process stays alive):', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception (caught, process stays alive):', err);
});

// Start listening + автозапуск комнаты
const PORT = Number(process.env.PORT || 3000);
colyseusServer.listen(PORT).then(async () => {
    console.log(`[Server] AgentOffice Engine listening on ws://localhost:${PORT}`);

    const { matchMaker } = require('colyseus');

    // Флаг предотвращает дублирование: onCreate у 6 агентов занимает >15 сек,
    // без флага watchdog успевает создать вторую комнату до завершения первой.
    let creating = false;

    const ensureRoom = async () => {
        if (OfficeRoom.getActiveRoom() || creating) return;
        creating = true;
        try {
            console.log('[Server] Creating office room...');
            await matchMaker.createRoom('office', { name: 'Главный офис' });
            console.log('[Server] Office room created');
        } catch (e) {
            console.error('[Server] Room creation failed:', e);
        } finally {
            creating = false;
        }
    };

    // Создаём сразу, потом watchdog каждые 5 секунд
    await ensureRoom();
    setInterval(ensureRoom, 5_000);
});
