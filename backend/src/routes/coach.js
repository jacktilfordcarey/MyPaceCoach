import express from 'express';
import { isAuthenticated } from '../middleware/auth.js';
import { 
  generateCoachingInsights, 
  chatWithCoach, 
  predictRaceTimes,
  analyzeTraining,
  voiceCoaching
} from '../services/aiCoach.js';
import { getRecentAnalysisSnapshots } from '../services/analysisStore.js';

const router = express.Router();

// Get AI coaching insights
router.get('/insights', isAuthenticated, async (req, res) => {
  try {
    const insights = await generateCoachingInsights(req.user.id);
    res.json(insights);
  } catch (error) {
    console.error('Coach insights error:', error.status, error.message, error.code);
    res.status(500).json({ error: error.message });
  }
});

// Chat with AI coach
router.post('/chat', isAuthenticated, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const response = await chatWithCoach(req.user.id, message, history);
    res.json({ response });
  } catch (error) {
    console.error('Coach chat error:', error.status, error.message, error.code);
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return res.json({ response: 'I\'m currently rate-limited by the AI service. Please wait a moment and try again!' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get race time predictions
router.get('/predictions', isAuthenticated, async (req, res) => {
  try {
    const predictions = await predictRaceTimes(req.user.id);
    res.json(predictions);
  } catch (error) {
    console.error('Coach predictions error:', error.status, error.message, error.code);
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return res.json({ error: 'AI predictions temporarily unavailable due to rate limits. Please try again shortly.' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get training analysis
router.get('/analysis', isAuthenticated, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const analysis = await analyzeTraining(req.user.id, parseInt(days));
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/analysis/snapshots', isAuthenticated, async (req, res) => {
  try {
    const snapshots = await getRecentAnalysisSnapshots(req.user.id, 12);
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Voice coaching - emotionally intelligent AI response
router.post('/voice', isAuthenticated, async (req, res) => {
  try {
    const { transcript, activityData, activityId } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    const response = await voiceCoaching(req.user.id, transcript, activityData, activityId);
    res.json(response);
  } catch (error) {
    console.error('Coach voice error:', error.status, error.message, error.code);
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return res.json({ message: 'Great effort out there! The AI coach is briefly unavailable, but keep up the good work!', emotion: 'neutral', emotionConfidence: 'low' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
