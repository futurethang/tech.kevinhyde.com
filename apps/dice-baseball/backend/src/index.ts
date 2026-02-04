import 'dotenv/config';
import { createApp } from './server.js';

const PORT = process.env.PORT || 3000;
const { httpServer } = createApp();

httpServer.listen(PORT, () => {
  console.log(`🎲 Dice Baseball server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});
