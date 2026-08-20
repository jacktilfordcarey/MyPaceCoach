import express from 'express';
import bcrypt from 'bcrypt';
import passport from 'passport';
import User from '../models/User.js';

const router = express.Router();

// Middleware to ensure session.passport exists
const ensureSessionPassport = (req, res, next) => {
  if (req.session && !req.session.passport) {
    req.session.passport = {};
  }
  next();
};

// Initiate Strava OAuth
router.get('/strava', 
  ensureSessionPassport,
  passport.authenticate('strava', { 
    scope: 'read,activity:read'
  })
);

// Strava OAuth callback
router.get('/strava/callback',
  ensureSessionPassport,
  (req, res, next) => {
    passport.authenticate('strava', (err, user, info) => {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
      if (err) {
        console.error('Strava auth error:', err.message, err.stack);
        const msg = encodeURIComponent(err.message || 'auth_failed');
        return res.redirect(`${frontendUrl}?error=${msg}`);
      }
      if (!user) {
        console.error('Strava auth: no user returned', info);
        const msg = encodeURIComponent(info?.message || 'no_user');
        return res.redirect(`${frontendUrl}?error=${msg}`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          console.error('Login error after Strava auth:', loginErr);
          return res.redirect(`${frontendUrl}?error=login_failed`);
        }
        return res.redirect(`${frontendUrl}/dashboard`);
      });
    })(req, res, next);
  }
);

// Manual sign-up route (no Strava required)
router.post('/manual/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      stravaId: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username,
      email: email.toLowerCase(),
      passwordHash,
      firstName: username,
      premium: false
    });

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to log in' });
      }
      res.status(201).json({ success: true, user });
    });
  } catch (error) {
    console.error('Manual signup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual login route
router.post('/manual/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({
      where: { email: String(email).toLowerCase() }
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to log in' });
      }
      res.json({ success: true, user });
    });
  } catch (error) {
    console.error('Manual login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Backward compatibility for older frontend calls
router.post('/manual', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (username && !password) {
      return res.status(400).json({ error: 'Please use the manual sign-up or manual login routes' });
    }

    if (password && email) {
      return router.stack.some((layer) => layer.route && layer.route.path === '/manual/login')
        ? res.status(400).json({ error: 'Please use /api/auth/manual/login for login and /api/auth/manual/signup for sign-up.' })
        : res.status(400).json({ error: 'Please use the manual sign-up or manual login routes' });
    }

    return res.status(400).json({ error: 'Please use the manual sign-up or manual login routes' });
  } catch (error) {
    console.error('Manual entry error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Check authentication status
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        stravaId: req.user.stravaId,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        profile: req.user.profile,
        email: req.user.email
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
