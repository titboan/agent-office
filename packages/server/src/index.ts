import express from 'express';
import { Server } from 'colyseus';
import { createServer } from 'http';
import { OfficeRoom } from './rooms/OfficeRoom';

// Setup Express
const app = express();
app.use(express.json());
import path from 'path';

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


// Create HTTP and Colyseus server
const httpServer = createServer(app);
const colyseusServer = new Server({
    server: httpServer,
});

// Define Rooms
colyseusServer.define('office', OfficeRoom);

// Start listening
const PORT = Number(process.env.PORT || 3000);
colyseusServer.listen(PORT).then(() => {
    console.log(`[Server] AgentOffice Engine listening on ws://localhost:${PORT}`);
});
