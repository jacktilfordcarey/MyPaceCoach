import express from 'express';
import { body, validationResult } from 'express-validator';
import { isAuthenticated } from '../middleware/auth.js';
import CalendarEvent from '../models/CalendarEvent.js';

const router = express.Router();

router.get('/', isAuthenticated, async (req, res) => {
  try {
    const events = await CalendarEvent.findAll({
      where: { userId: req.user.id },
      order: [['eventDate', 'ASC']]
    });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', isAuthenticated, [
  body('title').notEmpty().withMessage('Title is required'),
  body('eventDate').optional({ checkFalsy: true }).if(body('eventDate').exists()).notEmpty().withMessage('Date is required'),
  body('raceDate').optional({ checkFalsy: true }).if(body('raceDate').exists()).notEmpty().withMessage('Date is required'),
  body('type').optional().isIn(['race', 'training']).withMessage('Type must be race or training')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const payload = {
      ...req.body,
      userId: req.user.id,
      type: req.body.type || 'training',
      eventDate: req.body.eventDate || req.body.raceDate || req.body.date,
      status: req.body.status || 'active'
    };

    const event = await CalendarEvent.create(payload);

    res.status(201).json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const event = await CalendarEvent.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    const payload = {
      ...req.body,
      type: req.body.type || event.type,
      eventDate: req.body.eventDate || req.body.raceDate || req.body.date || event.eventDate
    };

    await event.update(payload);
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const event = await CalendarEvent.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    await event.destroy();
    res.json({ message: 'Calendar event deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
