import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SequelizeStore from 'connect-session-sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from './config/database.js';
import passport from './config/passport.js';
import cron from 'node-cron';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import models to register them
import './models/User.js';
import './models/Activity.js';
import './models/Goal.js';
import './models/RacePB.js';
import './models/CalendarEvent.js';

// Import routes
import authRoutes from './routes/auth.js';
import activityRoutes from './routes/activities.js';
import coachRoutes from './routes/coach.js';
import userRoutes from './routes/user.js';
import goalRoutes from './routes/goals.js';
import racePBRoutes from './routes/racePBs.js';
import calendarRoutes from './routes/calendar.js';

// Import services
import { syncAllUsersActivities } from './services/stravaSync.js';

const app = express();
const DEFAULT_PORT = 3001;
const PORT = Number(process.env.PORT || DEFAULT_PORT);

// Trust Heroku's reverse proxy (required for secure cookies & sessions)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Create session store
const SessionStore = SequelizeStore(session.Store);
const sessionStore = new SessionStore({
  db: sequelize,
  checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
  expiration: 24 * 60 * 60 * 1000 // Sessions last 24 hours
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8081',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration - must be before passport
const isProduction = process.env.NODE_ENV === 'production';
app.use(session({
  secret: process.env.SESSION_SECRET || 'mypace-secret-key-2026',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  cookie: {
    secure: isProduction,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware to ensure session.passport exists (fixes passport-oauth bug)
app.use((req, res, next) => {
  if (req.session && !req.session.passport) {
    req.session.passport = {};
  }
  
  // Override logIn to ensure passport object exists
  const originalLogIn = req.logIn;
  req.logIn = req.login = function(user, options, done) {
    if (!req.session.passport) {
      req.session.passport = {};
    }
    return originalLogIn.call(this, user, options, done);
  };
  
  next();
});

// Migrate camelCase columns to snake_case if needed
async function migrateColumns() {
  const renameMap = {
    users: {
      stravaId: 'strava_id', firstName: 'first_name', lastName: 'last_name',
      profileMedium: 'profile_medium', accessToken: 'access_token',
      refreshToken: 'refresh_token', tokenExpiresAt: 'token_expires_at',
      weeklyMileage: 'weekly_mileage', monthlyMileage: 'monthly_mileage',
      totalRuns: 'total_runs', coachingStyle: 'coaching_style',
      racePBs: 'race_pbs', lastSync: 'last_sync',
      createdAt: 'created_at', updatedAt: 'updated_at'
    },
    activities: {
      userId: 'user_id', stravaId: 'strava_id', movingTime: 'moving_time',
      elapsedTime: 'elapsed_time', totalElevationGain: 'total_elevation_gain',
      averageSpeed: 'average_speed', maxSpeed: 'max_speed',
      averageHeartrate: 'average_heartrate', maxHeartrate: 'max_heartrate',
      averagePace: 'average_pace', effortLevel: 'effort_level',
      isRace: 'is_race', raceDistance: 'race_distance',
      injuryNotes: 'injury_notes', painLevel: 'pain_level',
      createdAt: 'created_at', updatedAt: 'updated_at'
    },
    goals: {
      userId: 'user_id', raceType: 'race_type', targetTime: 'target_time',
      raceDate: 'race_date', targetDistance: 'target_distance',
      targetPeriod: 'target_period', runsPerWeek: 'runs_per_week',
      trainingPlan: 'training_plan', startDate: 'start_date',
      completedDate: 'completed_date',
      createdAt: 'created_at', updatedAt: 'updated_at'
    },
    race_pbs: {
      userId: 'user_id', raceName: 'race_name',
      createdAt: 'created_at', updatedAt: 'updated_at'
    }
  };

  for (const [table, columns] of Object.entries(renameMap)) {
    for (const [oldCol, newCol] of Object.entries(columns)) {
      try {
        await sequelize.query(
          `ALTER TABLE "${table}" RENAME COLUMN "${oldCol}" TO "${newCol}"`,
          { logging: false }
        );
        console.log(`  Renamed ${table}.${oldCol} → ${newCol}`);
      } catch (e) {
        // Column already renamed or doesn't exist — ignore
      }
    }
  }
}

// Start server only after database is ready
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL');

    await sessionStore.sync();
    console.log('✅ Session store synchronized');

    // Try migrating any existing camelCase columns
    await migrateColumns();

    // Drop and recreate ENUMs + tables cleanly
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables synchronized');
  } catch (err) {
    console.error('❌ Database setup error:', err);
    // If alter fails (e.g. ENUM conflicts), try force sync on fresh DB
    try {
      console.log('⚠️ Retrying with force sync...');
      await sequelize.sync({ force: true });
      console.log('✅ Database tables force-synced');
    } catch (forceErr) {
      console.error('❌ Force sync also failed:', forceErr);
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 MyPace backend running on http://localhost:${PORT}`);
  });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/user', userRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/race-pbs', racePBRoutes);
app.use('/api/calendar', calendarRoutes);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Schedule daily Strava sync at 6 AM
cron.schedule('0 6 * * *', async () => {
  console.log('🔄 Running daily Strava sync...');
  await syncAllUsersActivities();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

startServer();
