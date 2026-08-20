import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendar, goals } from '../api'
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Trophy,
  Dumbbell,
  Pencil,
  Trash2,
  Clock3,
  MapPin,
  Sparkles
} from 'lucide-react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'

export default function Goals() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const queryClient = useQueryClient()

  const { data: goalsList, isLoading: goalsLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goals.getAll().then(res => res.data)
  })

  const { data: calendarEvents = [], isLoading: calendarLoading } = useQuery({
    queryKey: ['calendar'],
    queryFn: () => calendar.getAll().then(res => res.data)
  })

  const events = useMemo(() => {
    const apiEvents = (calendarEvents || []).map((event) => ({
      ...event,
      id: event.id,
      title: event.title,
      date: new Date(event.eventDate || event.date),
      type: event.type,
      typeLabel: event.type === 'race' ? 'Race' : 'Training',
      raceDate: event.eventDate || event.raceDate,
      raceType: event.raceType,
      targetTime: event.targetTime,
      description: event.description
    }))

    const fallbackGoals = (goalsList || [])
      .filter((goal) => goal.raceDate || goal.startDate)
      .map((goal) => ({
        ...goal,
        title: goal.title,
        date: new Date(goal.raceDate || goal.startDate),
        type: goal.type === 'race' ? 'race' : 'training',
        typeLabel: goal.type === 'race' ? 'Race' : 'Training',
        eventDate: goal.raceDate || goal.startDate,
        raceDate: goal.raceDate,
        raceType: goal.raceType,
        targetTime: goal.targetTime,
        description: goal.description
      }))

    return apiEvents.length > 0 ? apiEvents : fallbackGoals
  }, [calendarEvents, goalsList])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const monthEnd = endOfMonth(currentMonth)
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  const selectedDateEvents = useMemo(() => {
    const target = format(selectedDate, 'yyyy-MM-dd')
    return events.filter((event) => format(new Date(event.date), 'yyyy-MM-dd') === target)
  }, [events, selectedDate])

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      const event = calendarEvents.find((item) => item.id === id)
      return event ? calendar.delete(id) : goals.delete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    }
  })

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (id && calendarEvents.some((event) => event.id === id)) {
        return calendar.update(id, data)
      }
      return calendar.create(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      setShowAddModal(false)
      setEditingEvent(null)
    }
  })

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--text-muted)' }}>Schedule</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Race & Training Calendar</h1>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center justify-center space-x-2 text-sm">
          <Plus className="w-4 h-4" />
          <span>Add Event</span>
        </button>
      </div>

      {goalsLoading || calendarLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_0.9fr] gap-6">
          <div className="card p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{format(currentMonth, 'MMMM yyyy')}</h2>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => setCurrentMonth(new Date())} className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Today</button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 mt-2">
              {calendarDays.map((day) => {
                const dayEvents = events.filter((event) => isSameDay(new Date(event.date), day))
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = isSameDay(day, selectedDate)

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`min-h-[120px] rounded-xl border p-2 text-left transition ${isSelected ? 'border-teal-500 ring-1 ring-teal-500' : 'border-transparent'}`}
                    style={{
                      backgroundColor: isCurrentMonth ? 'var(--bg-surface)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent)' : 'var(--border-subtle)',
                      opacity: isCurrentMonth ? 1 : 0.6
                    }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{format(day, 'd')}</span>
                    </div>

                    <div className="space-y-1.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-md px-2 py-1 text-[10px] font-medium truncate"
                          style={{
                            backgroundColor: event.type === 'race' ? 'rgba(20, 184, 166, 0.18)' : 'rgba(59, 130, 246, 0.14)',
                            color: event.type === 'race' ? '#14b8a6' : '#60a5fa'
                          }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>+{dayEvents.length - 2} more</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{format(selectedDate, 'EEEE, MMM d')}</h3>
                <button onClick={() => {
                  setEditingEvent(null)
                  setShowAddModal(true)
                }} className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>+ Add</button>
              </div>

              {selectedDateEvents.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No races or training sessions scheduled.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDateEvents.map((event) => (
                    <div key={event.id} className="rounded-xl p-3" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {event.type === 'race' ? <Trophy className="w-3.5 h-3.5 text-teal-500" /> : <Dumbbell className="w-3.5 h-3.5 text-blue-500" />}
                            <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>{event.typeLabel}</span>
                          </div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                          {event.raceType && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{event.raceType}</p>}
                        </div>
                        <div className="flex items-center space-x-1">
                          <button onClick={() => { setEditingEvent(event); setShowAddModal(true) }} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" style={{ color: 'var(--text-secondary)' }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(event.id)} className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30" style={{ color: '#ef4444' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {event.description && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{event.description}</p>}

                      <div className="mt-3 space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <div className="flex items-center space-x-1.5"><Clock3 className="w-3.5 h-3.5" /> <span>{event.targetTime || 'Flexible timing'}</span></div>
                        {event.raceDate && <div className="flex items-center space-x-1.5"><CalendarDays className="w-3.5 h-3.5" /> <span>{format(new Date(event.raceDate), 'MMM d, yyyy')}</span></div>}
                        <div className="flex items-center space-x-1.5"><MapPin className="w-3.5 h-3.5" /> <span>{event.type === 'race' ? 'Race build-up' : 'Planned session'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Sparkles className="w-4 h-4 text-teal-500" />
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Upcoming</h3>
              </div>
              <div className="space-y-3">
                {events
                  .slice()
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .slice(0, 5)
                  .map((event) => (
                    <div key={event.id} className="flex justify-between items-center rounded-lg px-2 py-2" style={{ backgroundColor: 'var(--bg-surface)' }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{event.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{event.typeLabel}</p>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{format(new Date(event.date), 'MMM d')}</span>
                    </div>
                  ))}
              </div>
            </div>
          </aside>
        </div>
      )}

      {showAddModal && (
        <AddEventModal
          event={editingEvent}
          onClose={() => {
            setShowAddModal(false)
            setEditingEvent(null)
          }}
          onSubmit={(data) => saveMutation.mutate({ id: editingEvent?.id || null, data })}
          isSubmitting={saveMutation.isPending}
        />
      )}
    </div>
  )
}

function AddEventModal({ event, onClose, onSubmit, isSubmitting }) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    category: event?.type === 'race' ? 'race' : 'training',
    raceType: event?.raceType || '5K',
    targetTime: event?.targetTime || '',
    date: event?.eventDate || event?.raceDate ? format(new Date(event?.eventDate || event?.raceDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  })

  const handleSubmit = (e) => {
    e.preventDefault()

    const payload = {
      title: formData.title,
      description: formData.description,
      type: formData.category === 'race' ? 'race' : 'training',
      raceType: formData.category === 'race' ? formData.raceType : 'Training Session',
      targetTime: formData.targetTime || '',
      eventDate: formData.date,
      raceDate: formData.date,
      status: 'active'
    }

    onSubmit(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="rounded-xl max-w-lg w-full p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{event ? 'Edit Event' : 'Add Event'}</h2>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="input" required placeholder="e.g., Brighton 10K" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Event type</label>
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
              <option value="race">Race</option>
              <option value="training">Training</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{formData.category === 'race' ? 'Race distance' : 'Session type'}</label>
              <select value={formData.raceType} onChange={(e) => setFormData({ ...formData, raceType: e.target.value })} className="input">
                {formData.category === 'race' ? (
                  <>
                    <option value="5K">5K</option>
                    <option value="10K">10K</option>
                    <option value="Half Marathon">Half Marathon</option>
                    <option value="Marathon">Marathon</option>
                    <option value="10 Mile">10 Mile</option>
                  </>
                ) : (
                  <>
                    <option value="Tempo">Tempo</option>
                    <option value="Intervals">Intervals</option>
                    <option value="Long Run">Long Run</option>
                    <option value="Recovery">Recovery</option>
                    <option value="Steady State">Steady State</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Target time</label>
              <input type="text" value={formData.targetTime} onChange={(e) => setFormData({ ...formData, targetTime: e.target.value })} className="input" placeholder="HH:MM:SS" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
            <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="input" required />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <textarea rows="3" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input" placeholder="Goal context, training focus, race notes..." />
          </div>

          <div className="flex space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : event ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
