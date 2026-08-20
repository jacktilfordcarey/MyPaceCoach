import passport from 'passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import User from '../models/User.js';

const stravaClientId = process.env.STRAVA_CLIENT_ID;
const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET;
const stravaCallbackUrl = process.env.STRAVA_CALLBACK_URL;

if (stravaClientId && stravaClientSecret && stravaCallbackUrl) {
  passport.use('strava', new OAuth2Strategy({
      authorizationURL: 'https://www.strava.com/oauth/authorize',
      tokenURL: 'https://www.strava.com/oauth/token',
      clientID: stravaClientId,
      clientSecret: stravaClientSecret,
      callbackURL: stravaCallbackUrl
    },
    async (accessToken, refreshToken, params, profile, done) => {
      try {
        console.log('Strava OAuth: token exchange successful, fetching athlete profile...');
        const response = await fetch('https://www.strava.com/api/v3/athlete', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Strava API error:', response.status, errorText);

          if (response.status === 429) {
            return done(new Error('Strava rate limit exceeded. Please try again later or use manual entry.'));
          }

          return done(new Error(`Strava API returned ${response.status}`));
        }

        const stravaProfile = await response.json();
        let user = await User.findOne({ where: { stravaId: String(stravaProfile.id) } });

        const userData = {
          stravaId: String(stravaProfile.id),
          username: stravaProfile.username,
          firstName: stravaProfile.firstname,
          lastName: stravaProfile.lastname,
          email: stravaProfile.email,
          profile: stravaProfile.profile,
          profileMedium: stravaProfile.profile_medium,
          city: stravaProfile.city,
          state: stravaProfile.state,
          country: stravaProfile.country,
          sex: stravaProfile.sex,
          premium: stravaProfile.premium,
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + params.expires_in * 1000)
        };

        if (user) {
          await user.update(userData);
        } else {
          user = await User.create(userData);
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  ));
} else {
  console.warn('⚠️ Strava OAuth not configured. Set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, and STRAVA_CALLBACK_URL in your .env to enable login.');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
