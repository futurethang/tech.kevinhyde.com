import { Router, type Request, type Response, type NextFunction } from 'express';
import { clearUsers, createDevUserWithDefaultTeams } from './auth.js';
import { clearAllTeams, getTeams } from '../services/team-service.js';
import { clearAllGames, createGame, joinGame } from '../services/game-service.js';
import { clearSocketState } from '../socket/index.js';

const router = Router();

function requireDevKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.DEV_ADMIN_KEY;
  if (!expected) {
    next();
    return;
  }

  const provided = req.header('x-dev-key');
  if (provided !== expected) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid dev key' });
    return;
  }

  next();
}

router.use(requireDevKey);

router.post('/reset', async (_req: Request, res: Response) => {
  clearUsers();
  await clearAllTeams();
  await clearAllGames();
  clearSocketState();

  return res.status(200).json({
    ok: true,
    message: 'Development state reset',
  });
});

router.post('/seed-game', async (req: Request, res: Response) => {
  const simSeed = typeof req.body?.seed === 'string' ? req.body.seed : undefined;
  const mode = req.body?.mode === 'deterministic' ? 'deterministic' : undefined;

  const home = await createDevUserWithDefaultTeams('home');
  const visitor = await createDevUserWithDefaultTeams('visitor');

  const homeTeams = await getTeams(home.id);
  const visitorTeams = await getTeams(visitor.id);
  const homeTeam = homeTeams.find((team) => team.rosterComplete);
  const visitorTeam = visitorTeams.find((team) => team.rosterComplete);

  if (!homeTeam || !visitorTeam) {
    return res.status(500).json({
      error: 'seed_failed',
      message: 'Unable to find complete seeded teams',
    });
  }

  const game = await createGame(home.id, homeTeam.id, { mode, seed: simSeed });
  const activeGame = await joinGame(game.id, visitor.id, visitorTeam.id);

  return res.status(201).json({
    home,
    visitor,
    game: activeGame,
    sim: activeGame.simulation,
  });
});

export default router;
