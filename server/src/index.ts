import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import categoriesRoutes from './routes/categories';
import packagesRoutes from './routes/packages';
import purchasesRoutes from './routes/purchases';
import giftsRoutes from './routes/gifts';
import discountsRoutes from './routes/discounts';
import gamesRoutes from './routes/games';
import tournamentsRoutes from './routes/tournaments';
import studentRoutes from './routes/student';
import episodesRoutes from './routes/episodes';
import tvApplicationsRoutes from './routes/tvApplications';
import adminRoutes from './routes/admin';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/gifts', giftsRoutes);
app.use('/api/discounts', discountsRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/tournaments', tournamentsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/episodes', episodesRoutes);
app.use('/api/tv-applications', tvApplicationsRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ غير متوقع' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
