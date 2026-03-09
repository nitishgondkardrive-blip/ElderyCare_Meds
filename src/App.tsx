import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App as CapApp } from '@capacitor/app';
import { 
  Plus, 
  Clock, 
  Camera, 
  Check, 
  Trash2, 
  X, 
  Pill,
  Bell,
  Calendar,
  Info,
  CalendarDays,
  History as HistoryIcon,
  Volume2,
  Pencil,
  Search
} from 'lucide-react';
import { 
  Medicine, 
  TimeOfDay, 
  TIME_OF_DAY_ORDER, 
  UsageInstruction, 
  ScheduleType, 
  FrequencyType,
  PillShape,
  PillColor,
  UserProfile,
  ReminderSound
} from './types';

interface Dose {
  id: string; // unique for this instance: medId-time-date
  medicineId: string;
  name: string;
  dosage: string;
  time: string;
  timeOfDay: TimeOfDay;
  image?: string;
  shape: PillShape;
  color: PillColor;
  usage: UsageInstruction;
  taken: boolean;
  date: string; // YYYY-MM-DD
  additionalInstructions?: string;
}

const PillVisual = ({ shape, color, size = 'md' }: { shape: PillShape, color: PillColor, size?: 'sm' | 'md' }) => {
  const colorMap: Record<PillColor, string> = {
    Violet: 'bg-violet-400',
    Indigo: 'bg-indigo-400',
    Blue: 'bg-blue-400',
    Green: 'bg-green-400',
    Yellow: 'bg-yellow-400',
    Orange: 'bg-orange-400',
    Red: 'bg-red-400',
    White: 'bg-white border border-slate-200',
    Black: 'bg-slate-900'
  };

  const baseClasses = `${colorMap[color]} shadow-inner relative flex items-center justify-center`;
  
  if (shape === 'Round') {
    return (
      <div className={`${baseClasses} rounded-full ${size === 'sm' ? 'w-10 h-10' : 'w-16 h-16'}`}>
        <div className="absolute inset-0 rounded-full bg-white/20 blur-[1px] translate-x-[-2px] translate-y-[-2px]" />
        <div className="w-full h-[1px] bg-black/10 absolute top-1/2 -translate-y-1/2" />
      </div>
    );
  }
  if (shape === 'Oval') {
    return (
      <div className={`${baseClasses} rounded-[100%] ${size === 'sm' ? 'w-12 h-8' : 'w-20 h-12'}`}>
        <div className="absolute inset-0 rounded-[100%] bg-white/20 blur-[1px] translate-x-[-2px] translate-y-[-2px]" />
      </div>
    );
  }
  return ( // Capsule
    <div className={`${baseClasses} rounded-full ${size === 'sm' ? 'w-12 h-6' : 'w-20 h-10'}`}>
      <div className="absolute inset-0 rounded-full bg-white/20 blur-[1px] translate-x-[-2px] translate-y-[-2px]" />
      <div className="h-full w-[1px] bg-black/10 absolute left-1/2 -translate-x-1/2" />
    </div>
  );
};

export default function App() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [takenDoseKeys, setTakenDoseKeys] = useState<string[]>([]); // Array of "medId-time-date"
  const [isAdding, setIsAdding] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'history' | 'settings'>('today');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Profile Form State
  const [profileName, setProfileName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>(undefined);
  const [profileDob, setProfileDob] = useState('');
  
  // Reminder Popup State
  const [dueDose, setDueDose] = useState<Dose | null>(null);
  const [lastPoppedKey, setLastPoppedKey] = useState<string>(''); // medId-time-date
  const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newImage, setNewImage] = useState<string | undefined>(undefined);
  const [newShape, setNewShape] = useState<PillShape>('Round');
  const [newColor, setNewColor] = useState<PillColor>('Blue');
  const [newUsage, setNewUsage] = useState<UsageInstruction>("Doesn't Matter");
  const [newFrequency, setNewFrequency] = useState<FrequencyType>('Once Daily');
  const [newTimes, setNewTimes] = useState<string[]>(['08:00']);
  const [newReminderSound, setNewReminderSound] = useState<ReminderSound>('Chime');
  const [newAdditionalInstructions, setNewAdditionalInstructions] = useState('');
  
  const [newScheduleType, setNewScheduleType] = useState<ScheduleType>('Every Day');
  const [newSpecificDays, setNewSpecificDays] = useState<number[]>([1, 2, 3, 4, 5]);
  
  // History Filter State
  const [historySearch, setHistorySearch] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default to last 7 days
    return d.toISOString().split('T')[0];
  });
  const [historyEndDate, setHistoryEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [newInterval, setNewInterval] = useState<number>(2);
  const [newStartDate, setNewStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newEndDateType, setNewEndDateType] = useState<'Duration' | 'Date'>('Duration');
  const [newDurationDays, setNewDurationDays] = useState<number>(7);
  const [newEndDate, setNewEndDate] = useState<string>('');

  const medFileInputRef = useRef<HTMLInputElement>(null);
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        const status = await LocalNotifications.requestPermissions();
        console.log('Notification permission status:', status);
        
        // Create a high-importance channel for Android
        await LocalNotifications.createChannel({
          id: 'medication-reminders',
          name: 'Medication Reminders',
          description: 'Critical reminders for taking your medicine',
          importance: 5, // Max importance for sound and heads-up
          visibility: 1, // Show on lock screen
          vibration: true,
          sound: 'res://default' // Use system default sound for reliability
        });
      } catch (e) {
        console.warn('LocalNotifications not available', e);
      }
    };
    requestPermissions();

    // Listener for when a notification is clicked
    const actionListener = LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const { medId, time, date } = notificationAction.notification.extra;
      if (medId && time && date) {
        const med = medicines.find(m => m.id === medId);
        if (med) {
          const doseId = `${medId}-${time}-${date}`;
          const dose: Dose = {
            id: doseId,
            medicineId: med.id,
            name: med.name,
            dosage: med.dosage,
            time: time,
            timeOfDay: getTimeOfDay(time),
            image: med.image,
            shape: med.shape,
            color: med.color,
            usage: med.usage,
            taken: takenDoseKeys.includes(doseId),
            date: date,
            additionalInstructions: med.additionalInstructions
          };
          setDueDose(dose);
          setActiveTab('today');
        }
      }
    });

    // Listener for when a notification is received while app is in foreground
    const receivedListener = LocalNotifications.addListener('localNotificationReceived', (notification) => {
      const { medId, time, date } = notification.extra;
      if (medId && time && date) {
        const med = medicines.find(m => m.id === medId);
        if (med) {
          const doseId = `${medId}-${time}-${date}`;
          if (!takenDoseKeys.includes(doseId)) {
            const dose: Dose = {
              id: doseId,
              medicineId: med.id,
              name: med.name,
              dosage: med.dosage,
              time: time,
              timeOfDay: getTimeOfDay(time),
              image: med.image,
              shape: med.shape,
              color: med.color,
              usage: med.usage,
              taken: false,
              date: date,
              additionalInstructions: med.additionalInstructions
            };
            setDueDose(dose);
            setLastPoppedKey(doseId);
            startAlerting(med.reminderSound);
          }
        }
      }
    });

    return () => {
      actionListener.then(l => l.remove());
      receivedListener.then(l => l.remove());
    };
  }, [medicines, takenDoseKeys]);

  useEffect(() => {
    const savedMeds = localStorage.getItem('elderly_meds_v3');
    const savedTaken = localStorage.getItem('elderly_meds_taken_v3');
    const savedProfile = localStorage.getItem('elderly_meds_profile_v3');
    if (savedMeds) setMedicines(JSON.parse(savedMeds));
    if (savedTaken) setTakenDoseKeys(JSON.parse(savedTaken));
    if (savedProfile) {
      const profile = JSON.parse(savedProfile);
      setUserProfile(profile);
      setProfileName(profile.name);
      setProfilePhoto(profile.photo);
      setProfileDob(profile.dob);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('elderly_meds_v3', JSON.stringify(medicines));
    localStorage.setItem('elderly_meds_taken_v3', JSON.stringify(takenDoseKeys));
    if (userProfile) {
      localStorage.setItem('elderly_meds_profile_v3', JSON.stringify(userProfile));
    }
    
    // Schedule system notifications
    const syncNotifications = async () => {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        const notifications = [];
        const today = new Date();
        
        // Schedule for the next 3 days
        for (let i = 0; i < 3; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];

          medicines.forEach(med => {
            if (isMedScheduledForDate(med, dateStr)) {
              med.times.forEach((time, timeIdx) => {
                const [hour, minute] = time.split(':').map(Number);
                const scheduleDate = new Date(date);
                scheduleDate.setHours(hour, minute, 0, 0);

                if (scheduleDate > new Date()) {
                  // Create a deterministic ID: medId(last 4 digits) + dayOffset + timeIdx
                  const medShortId = parseInt(med.id.slice(-4)) || 0;
                  const notificationId = (medShortId * 100) + (i * 10) + timeIdx;
                  
                  notifications.push({
                    title: `💊 Time for ${med.name}`,
                    body: `Take ${med.dosage} (${med.usage})`,
                    id: notificationId,
                    schedule: { at: scheduleDate, allowWhileIdle: true },
                    sound: 'res://default',
                    channelId: 'medication-reminders',
                    extra: { medId: med.id, time, date: dateStr }
                  });
                }
              });
            }
          });
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
        }
      } catch (e) {
        console.warn('Failed to schedule notifications', e);
      }
    };
    syncNotifications();
  }, [medicines, takenDoseKeys, userProfile]);

  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      if (isCameraOpen) {
        stopCamera();
      } else if (isAdding) {
        setIsAdding(false);
        resetForm();
      } else if (dueDose) {
        setDueDose(null);
      } else if (activeTab !== 'today') {
        setActiveTab('today');
      } else {
        setShowExitConfirm(true);
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [isCameraOpen, isAdding, dueDose, activeTab]);

  useEffect(() => {
    const checkDoses = () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      medicines.forEach(med => {
        if (isMedScheduledForDate(med, todayStr)) {
          med.times.forEach(time => {
            const doseId = `${med.id}-${time}-${todayStr}`;
            const [hour, minute] = time.split(':').map(Number);
            const doseTime = new Date(now);
            doseTime.setHours(hour, minute, 0, 0);

            const diffMinutes = (now.getTime() - doseTime.getTime()) / (1000 * 60);
            
            // Trigger if:
            // 1. It's past the time
            // 2. AND it's not taken
            // 3. AND it hasn't been popped in this session
            if (diffMinutes >= 0 && !takenDoseKeys.includes(doseId) && lastPoppedKey !== doseId) {
              const dose: Dose = {
                id: doseId,
                medicineId: med.id,
                name: med.name,
                dosage: med.dosage,
                time: time,
                timeOfDay: getTimeOfDay(time),
                image: med.image,
                shape: med.shape,
                color: med.color,
                usage: med.usage,
                taken: false,
                date: todayStr,
                additionalInstructions: med.additionalInstructions
              };
              setDueDose(dose);
              setLastPoppedKey(doseId);
              startAlerting(med.reminderSound);
            }
          });
        }
      });
    };

    const interval = setInterval(checkDoses, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [medicines, takenDoseKeys, lastPoppedKey]);

  const startAlerting = (sound: ReminderSound) => {
    // Stop any existing alerting
    if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
    
    // Initial alert
    playReminderSound(sound);
    if (navigator.vibrate) navigator.vibrate([500, 200, 500]);

    // Repeat every 4 seconds until dismissed
    soundIntervalRef.current = setInterval(() => {
      playReminderSound(sound);
      if (navigator.vibrate) navigator.vibrate([500, 200, 500]);
    }, 4000);
  };

  const stopAlerting = () => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
  };

  const playReminderSound = (sound: ReminderSound) => {
    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AudioContextClass) return;
      
      const audioCtx = new AudioContextClass();
      
      // Resume context if suspended (browser policy)
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const playNote = (freq: number, start: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.2) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime + start);
        gain.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + start + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(audioCtx.currentTime + start);
        osc.stop(audioCtx.currentTime + start + duration);
      };

      if (sound === 'Chime') {
        playNote(523.25, 0, 0.5); // C5
        playNote(659.25, 0.1, 0.5); // E5
        playNote(783.99, 0.2, 0.5); // G5
      } else if (sound === 'Bell') {
        playNote(440, 0, 1.2, 'triangle', 0.3); // A4
        playNote(880, 0.05, 1.0, 'sine', 0.1); // A5
      } else if (sound === 'Soft Alert') {
        playNote(392, 0, 0.4, 'sine', 0.15); // G4
        playNote(493.88, 0.2, 0.4, 'sine', 0.15); // B4
      } else if (sound === 'Digital') {
        playNote(1200, 0, 0.1, 'square', 0.1);
        playNote(1200, 0.15, 0.1, 'square', 0.1);
      } else if (sound === 'Gentle') {
        playNote(329.63, 0, 0.8, 'sine', 0.1); // E4
        playNote(392.00, 0.2, 0.8, 'sine', 0.1); // G4
      } else if (sound === 'Piano') {
        playNote(523.25, 0, 0.6, 'sine', 0.2); // C5
        playNote(587.33, 0.1, 0.6, 'sine', 0.2); // D5
        playNote(659.25, 0.2, 0.6, 'sine', 0.2); // E5
        playNote(783.99, 0.3, 0.8, 'sine', 0.2); // G5
      } else if (sound === 'Guitar') {
        playNote(196.00, 0, 0.5, 'triangle', 0.2); // G3
        playNote(246.94, 0.1, 0.5, 'triangle', 0.2); // B3
        playNote(293.66, 0.2, 0.5, 'triangle', 0.2); // D4
      } else if (sound === 'Zen') {
        playNote(220.00, 0, 2.0, 'sine', 0.15); // A3
        playNote(440.00, 0.5, 1.5, 'sine', 0.05); // A4
      } else if (sound === 'Nature') {
        playNote(1500, 0, 0.05, 'sine', 0.1);
        playNote(1800, 0.05, 0.05, 'sine', 0.1);
        playNote(1500, 0.1, 0.05, 'sine', 0.1);
        playNote(1800, 0.15, 0.05, 'sine', 0.1);
      }
    } catch (e) {
      console.error('Audio generation failed:', e);
    }
  };
  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getTimeOfDay = (time: string): TimeOfDay => {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Night';
  };

  const isMedScheduledForDate = (med: Medicine, dateStr: string) => {
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);
    
    const startDate = new Date(med.schedule.startDate);
    startDate.setHours(0, 0, 0, 0);

    // Check if before start date
    if (targetDate < startDate) return false;

    // Check end date
    if (med.schedule.endDateType === 'Date' && med.schedule.endDate) {
      const endDate = new Date(med.schedule.endDate);
      endDate.setHours(0, 0, 0, 0);
      if (targetDate > endDate) return false;
    } else if (med.schedule.endDateType === 'Duration' && med.schedule.durationDays) {
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + med.schedule.durationDays - 1);
      endDate.setHours(0, 0, 0, 0);
      if (targetDate > endDate) return false;
    }

    // Check schedule type
    if (med.schedule.type === 'Every Day') return true;
    
    if (med.schedule.type === 'Specific Days of Week' && med.schedule.specificDays) {
      return med.schedule.specificDays.includes(targetDate.getDay());
    }

    if (med.schedule.type === 'Days Interval' && med.schedule.interval) {
      const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays % med.schedule.interval === 0;
    }

    return false;
  };

  const handleFrequencyChange = (freq: FrequencyType) => {
    setNewFrequency(freq);
    if (freq === 'Once Daily') setNewTimes(['08:00']);
    else if (freq === 'Twice Daily') setNewTimes(['08:00', '20:00']);
    else if (freq === '3 Times a Day') setNewTimes(['08:00', '14:00', '20:00']);
  };

  const updateTime = (index: number, value: string) => {
    const updated = [...newTimes];
    updated[index] = value;
    setNewTimes(updated);
  };

  const handleSaveMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDosage) return;

    if (editingMedId) {
      setMedicines(medicines.map(m => m.id === editingMedId ? {
        ...m,
        name: newName,
        dosage: newDosage,
        times: newTimes,
        timeOfDay: getTimeOfDay(newTimes[0]),
        image: newImage,
        shape: newShape,
        color: newColor,
        usage: newUsage,
        frequency: newFrequency,
        schedule: {
          type: newScheduleType,
          specificDays: newScheduleType === 'Specific Days of Week' ? newSpecificDays : undefined,
          interval: newScheduleType === 'Days Interval' ? newInterval : undefined,
          startDate: newStartDate,
          endDateType: newEndDateType,
          durationDays: newEndDateType === 'Duration' ? newDurationDays : undefined,
          endDate: newEndDateType === 'Date' ? newEndDate : undefined,
        },
        reminderSound: newReminderSound,
        additionalInstructions: newAdditionalInstructions
      } : m));
    } else {
      const newMed: Medicine = {
        id: Date.now().toString(),
        name: newName,
        dosage: newDosage,
        times: newTimes,
        timeOfDay: getTimeOfDay(newTimes[0]),
        image: newImage,
        shape: newShape,
        color: newColor,
        usage: newUsage,
        frequency: newFrequency,
        schedule: {
          type: newScheduleType,
          specificDays: newScheduleType === 'Specific Days of Week' ? newSpecificDays : undefined,
          interval: newScheduleType === 'Days Interval' ? newInterval : undefined,
          startDate: newStartDate,
          endDateType: newEndDateType,
          durationDays: newEndDateType === 'Duration' ? newDurationDays : undefined,
          endDate: newEndDateType === 'Date' ? newEndDate : undefined,
        },
        taken: false,
        reminderSound: newReminderSound,
        additionalInstructions: newAdditionalInstructions
      };
      setMedicines([...medicines, newMed]);
    }

    setIsAdding(false);
    resetForm();
  };

  const handleEditMed = (medId: string) => {
    const med = medicines.find(m => m.id === medId);
    if (!med) return;

    setEditingMedId(med.id);
    setNewName(med.name);
    setNewDosage(med.dosage);
    setNewImage(med.image);
    setNewShape(med.shape);
    setNewColor(med.color);
    setNewUsage(med.usage);
    setNewFrequency(med.frequency);
    setNewTimes(med.times);
    setNewReminderSound(med.reminderSound);
    setNewAdditionalInstructions(med.additionalInstructions || '');
    setNewScheduleType(med.schedule.type);
    setNewSpecificDays(med.schedule.specificDays || [1, 2, 3, 4, 5]);
    setNewInterval(med.schedule.interval || 2);
    setNewStartDate(med.schedule.startDate);
    setNewEndDateType(med.schedule.endDateType);
    setNewDurationDays(med.schedule.durationDays || 7);
    setNewEndDate(med.schedule.endDate || '');
    
    setIsAdding(true);
  };

  const resetForm = () => {
    setEditingMedId(null);
    setNewName('');
    setNewDosage('');
    setNewImage(undefined);
    setNewShape('Round');
    setNewColor('Blue');
    setNewUsage("Doesn't Matter");
    setNewFrequency('Once Daily');
    setNewTimes(['08:00']);
    setNewReminderSound('Chime');
    setNewAdditionalInstructions('');
    setNewScheduleType('Every Day');
    setNewSpecificDays([1, 2, 3, 4, 5]);
    setNewInterval(2);
    setNewStartDate(new Date().toISOString().split('T')[0]);
    setNewEndDateType('Duration');
    setNewDurationDays(7);
    setNewEndDate('');
  };

  const toggleTaken = (doseId: string) => {
    if (takenDoseKeys.includes(doseId)) {
      setTakenDoseKeys(takenDoseKeys.filter(k => k !== doseId));
    } else {
      setTakenDoseKeys([...takenDoseKeys, doseId]);
    }
  };

  const deleteMed = (id: string) => {
    if (confirm('Are you sure you want to remove this medicine?')) {
      setMedicines(medicines.filter(m => m.id !== id));
      // Clean up taken keys for this med
      setTakenDoseKeys(takenDoseKeys.filter(k => !k.startsWith(id)));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setNewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: UserProfile = {
      name: profileName,
      photo: profilePhoto,
      dob: profileDob
    };
    setUserProfile(profile);
    setActiveTab('today');
  };

  const handleProfilePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsCameraOpen(false);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setNewImage(dataUrl);
        stopCamera();
      }
    }
  };

  // Generate doses for today
  const allTodayDoses = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const doses: Dose[] = [];
    
    medicines.forEach(med => {
      if (isMedScheduledForDate(med, todayStr)) {
        med.times.forEach(time => {
          const doseId = `${med.id}-${time}-${todayStr}`;
          doses.push({
            id: doseId,
            medicineId: med.id,
            name: med.name,
            dosage: med.dosage,
            time: time,
            timeOfDay: getTimeOfDay(time),
            image: med.image,
            shape: med.shape,
            color: med.color,
            usage: med.usage,
            taken: takenDoseKeys.includes(doseId),
            date: todayStr,
            additionalInstructions: med.additionalInstructions
          });
        });
      }
    });

    return doses.sort((a, b) => a.time.localeCompare(b.time));
  }, [medicines, takenDoseKeys]);

  // Next 3 Upcoming (Not taken)
  const upcomingDoses = useMemo(() => {
    return allTodayDoses.filter(d => !d.taken).slice(0, 3);
  }, [allTodayDoses]);

  // History (Filtered)
  const filteredHistory = useMemo(() => {
    const doses: Dose[] = [];
    
    takenDoseKeys.forEach(key => {
      const parts = key.split('-');
      // Handle case where medId might contain hyphens (though Date.now().toString() shouldn't)
      // Actually medId is Date.now().toString() which is numeric string.
      const medId = parts[0];
      const time = parts[1];
      const date = parts[2];
      
      const med = medicines.find(m => m.id === medId);
      
      if (med) {
        const matchesSearch = med.name.toLowerCase().includes(historySearch.toLowerCase());
        const matchesDate = date >= historyStartDate && date <= historyEndDate;
        
        if (matchesSearch && matchesDate) {
          doses.push({
            id: key,
            medicineId: med.id,
            name: med.name,
            dosage: med.dosage,
            time: time,
            timeOfDay: getTimeOfDay(time),
            image: med.image,
            shape: med.shape,
            color: med.color,
            usage: med.usage,
            taken: true,
            date: date,
            additionalInstructions: med.additionalInstructions
          });
        }
      }
    });
    
    return doses.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
  }, [takenDoseKeys, medicines, historySearch, historyStartDate, historyEndDate]);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-screen w-full max-w-md mx-auto bg-slate-50 flex flex-col font-sans overflow-x-hidden">
      {/* Header */}
      <header className="bg-white px-6 pt-12 pb-6 shadow-sm rounded-b-[2.5rem] flex-shrink-0">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Pill size={28} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'today' ? 'Med Reminders' : activeTab === 'history' ? 'History' : 'Settings'}
              </h1>
              <p className="text-slate-500 font-medium mt-1">
                {activeTab === 'settings' ? 'Manage your settings' : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          {activeTab !== 'settings' && (
            <button 
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 active:scale-95 transition-transform"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8 space-y-8 overflow-y-auto safe-bottom">
        <AnimatePresence mode="wait">
          {activeTab === 'today' ? (
            <motion.div
              key="today"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {upcomingDoses.length > 0 ? (
                <div className="grid gap-5">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Next 3 Reminders</h2>
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                      {upcomingDoses.length} total
                    </span>
                  </div>
                  {upcomingDoses.map(dose => (
                    <motion.div
                      layout
                      key={dose.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-[2rem] p-6 shadow-sm border-2 border-transparent hover:border-indigo-100 transition-all"
                    >
                      <div className="flex gap-5">
                        <div className="w-24 h-24 rounded-3xl bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-200">
                          {dose.image ? (
                            <img src={dose.image} alt={dose.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <PillVisual shape={dose.shape} color={dose.color} />
                          )}
                        </div>

                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-indigo-600 font-black text-base">
                              {dose.time}
                            </span>
                            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full uppercase">
                              {dose.usage}
                            </span>
                          </div>
                          <h3 className="text-2xl font-bold text-slate-900 leading-tight mb-1">
                            {dose.name}
                          </h3>
                          <p className="text-slate-500 font-bold text-lg">
                            {dose.dosage}
                          </p>
                          {dose.additionalInstructions && (
                            <p className="text-slate-400 text-xs mt-2 italic line-clamp-2">
                              {dose.additionalInstructions}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col justify-center gap-2">
                          <button
                            onClick={() => handleEditMed(dose.medicineId)}
                            className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 border-2 border-slate-100 flex items-center justify-center active:scale-90 transition-all"
                          >
                            <Pencil size={20} />
                          </button>
                          <button
                            onClick={() => toggleTaken(dose.id)}
                            className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 border-4 border-slate-200 flex items-center justify-center active:scale-90 transition-all"
                          >
                            <Check size={32} strokeWidth={4} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center">
                    <Check size={48} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">All Done!</h3>
                    <p className="text-slate-500 text-lg">You've taken all your scheduled medicines for now.</p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Filters */}
              <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search medicine name..." 
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl py-3 pl-12 pr-12 text-sm font-medium outline-none transition-all"
                  />
                  {historySearch && (
                    <button 
                      onClick={() => setHistorySearch('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">From</label>
                    <input 
                      type="date" 
                      value={historyStartDate}
                      onChange={(e) => setHistoryStartDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl p-2 text-xs font-bold outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">To</label>
                    <input 
                      type="date" 
                      value={historyEndDate}
                      onChange={(e) => setHistoryEndDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl p-2 text-xs font-bold outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">History</h2>
                <div className="flex items-center gap-2">
                  {(historySearch || historyStartDate !== new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || historyEndDate !== new Date().toISOString().split('T')[0]) && (
                    <button 
                      onClick={() => {
                        setHistorySearch('');
                        const d = new Date();
                        d.setDate(d.getDate() - 7);
                        setHistoryStartDate(d.toISOString().split('T')[0]);
                        setHistoryEndDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="text-[10px] font-bold text-indigo-500 uppercase hover:text-indigo-700"
                    >
                      Reset Filters
                    </button>
                  )}
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg">
                    {filteredHistory.length} doses
                  </span>
                </div>
              </div>
              
              {filteredHistory.length > 0 ? (
                <div className="grid gap-4">
                  {filteredHistory.map(dose => (
                    <div key={dose.id} className="bg-emerald-50/50 rounded-3xl p-5 border-2 border-emerald-100 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white flex-shrink-0 overflow-hidden flex items-center justify-center border border-emerald-100">
                        {dose.image ? (
                          <img src={dose.image} alt={dose.name} className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                        ) : (
                          <PillVisual shape={dose.shape} color={dose.color} size="sm" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-600 font-bold text-sm">{dose.time}</span>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Taken on {new Date(dose.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 line-through decoration-emerald-300">{dose.name}</h3>
                        <p className="text-slate-400 text-sm">{dose.dosage}</p>
                      </div>
                      <button 
                        onClick={() => toggleTaken(dose.id)}
                        className="p-3 text-emerald-500 bg-white rounded-2xl shadow-sm"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-50">
                  <HistoryIcon size={64} className="text-slate-300" />
                  <p className="text-slate-500 font-bold">No history found for these filters.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                  My Medicines
                </h2>
                <div className="space-y-4">
                  {medicines.length > 0 ? (
                    medicines.map(med => (
                      <div key={med.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-white flex-shrink-0 flex items-center justify-center border border-slate-200 overflow-hidden">
                            {med.image ? (
                              <img src={med.image} alt={med.name} className="w-full h-full object-cover" />
                            ) : (
                              <PillVisual shape={med.shape} color={med.color} size="sm" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 truncate">{med.name}</h4>
                            <p className="text-xs text-slate-500 font-medium truncate">{med.dosage} • {med.frequency}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleEditMed(med.id)}
                            className="p-2 bg-white text-indigo-600 rounded-xl shadow-sm border border-indigo-50"
                          >
                            <Pencil size={18} />
                          </button>
                          <button 
                            onClick={() => deleteMed(med.id)}
                            className="p-2 bg-white text-red-500 rounded-xl shadow-sm border border-red-50"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-400 py-4 font-medium">No medicines added yet.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                  User Profile
                </h2>
                
                <form onSubmit={handleSaveProfile} className="space-y-8">
                  <div className="flex flex-col items-center space-y-4">
                    <div 
                      onClick={() => profileFileInputRef.current?.click()} 
                      className="w-32 h-32 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-indigo-300 transition-all shadow-inner"
                    >
                      {profilePhoto ? (
                        <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center">
                          <Camera size={32} className="text-slate-300 group-hover:text-indigo-400" />
                          <span className="text-[10px] font-bold text-slate-400 mt-2">Add Photo</span>
                        </div>
                      )}
                    </div>
                    <input type="file" ref={profileFileInputRef} onChange={handleProfilePhotoUpload} accept="image/*" className="hidden" />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                      <input 
                        type="text" 
                        placeholder="Enter your name" 
                        value={profileName} 
                        onChange={(e) => setProfileName(e.target.value)} 
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-lg font-medium outline-none transition-all" 
                        required 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Date of Birth</label>
                      <input 
                        type="date" 
                        value={profileDob} 
                        onChange={(e) => setProfileDob(e.target.value)} 
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-lg font-medium outline-none transition-all" 
                        required 
                      />
                    </div>

                    {profileDob && (
                      <div className="bg-indigo-50 p-6 rounded-3xl flex items-center justify-between">
                        <span className="text-indigo-700 font-bold">Calculated Age</span>
                        <span className="text-2xl font-black text-indigo-600">{calculateAge(profileDob)} Years</span>
                      </div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-indigo-600 text-white py-5 rounded-3xl text-lg font-bold shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all"
                  >
                    Save Profile
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 opacity-50">
                <h2 className="text-xl font-bold text-slate-800 mb-4">App Settings</h2>
                <div className="space-y-4">
                  <p className="text-slate-500 text-sm">Version 3.2.0 (ElderlyCare Meds)</p>
                  <button 
                    onClick={async () => {
                      const testTime = new Date();
                      testTime.setSeconds(testTime.getSeconds() + 10);
                      await LocalNotifications.schedule({
                        notifications: [{
                          title: "🔔 Test Reminder",
                          body: "This is a test to verify notifications are working.",
                          id: 999999,
                          schedule: { at: testTime, allowWhileIdle: true },
                          sound: 'res://default',
                          channelId: 'medication-reminders'
                        }]
                      });
                      alert("Test notification scheduled for 10 seconds from now. Please lock your phone to test.");
                    }}
                    className="w-full bg-slate-100 text-indigo-600 py-3 rounded-2xl font-bold text-sm"
                  >
                    Test Notification (10s)
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xs rounded-[2.5rem] p-8 space-y-6 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <X size={40} className="text-red-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">Exit App?</h3>
                <p className="text-slate-500">Are you sure you want to close the application?</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold active:scale-95 transition-all"
                >
                  No
                </button>
                <button
                  onClick={() => CapApp.exitApp()}
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-bold shadow-lg shadow-red-100 active:scale-95 transition-all"
                >
                  Yes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Medicine Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-0"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] p-8 space-y-8 shadow-2xl overflow-y-auto max-h-[95vh]"
            >
              <div className="flex justify-between items-center sticky top-0 bg-white pb-4 z-10">
                <h2 className="text-2xl font-bold text-slate-900">{editingMedId ? 'Edit Medicine' : 'Add Medicine'}</h2>
                <button onClick={() => { setIsAdding(false); resetForm(); }} className="p-2 bg-slate-100 rounded-full text-slate-500"><X size={24} /></button>
              </div>

              <form onSubmit={handleSaveMedicine} className="space-y-10 pb-10">
                {/* Basic Info */}
                <section className="space-y-6">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative group">
                      <div 
                        onClick={() => medFileInputRef.current?.click()} 
                        className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-indigo-300 transition-all shadow-inner"
                      >
                        {newImage ? <img src={newImage} alt="Preview" className="w-full h-full object-cover" /> : (
                          <div className="flex flex-col items-center">
                            <PillVisual shape={newShape} color={newColor} />
                            <span className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">Medicine Photo</span>
                          </div>
                        )}
                      </div>
                      {newImage && (
                        <button 
                          type="button"
                          onClick={() => setNewImage(undefined)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-2 rounded-full shadow-lg"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    <div className="flex gap-3 w-full">
                      <button 
                        type="button"
                        onClick={() => medFileInputRef.current?.click()}
                        className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
                      >
                        <Plus size={18} />
                        Upload
                      </button>
                      <button 
                        type="button"
                        onClick={startCamera}
                        className="flex-1 bg-indigo-50 text-indigo-600 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all border border-indigo-100"
                      >
                        <Camera size={18} />
                        Take Photo
                      </button>
                    </div>
                    
                    <input type="file" ref={medFileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                  </div>

                  {/* Camera Modal */}
                  <AnimatePresence>
                    {isCameraOpen && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black z-[100] flex flex-col"
                      >
                        <div className="flex-1 relative overflow-hidden">
                          <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover"
                          />
                          <canvas ref={canvasRef} className="hidden" />
                          
                          <button 
                            onClick={stopCamera}
                            className="absolute top-8 right-6 p-3 bg-white/20 backdrop-blur-md rounded-full text-white"
                          >
                            <X size={24} />
                          </button>
                        </div>
                        
                        <div className="bg-black p-10 flex flex-col items-center gap-8">
                          <div className="text-white/60 text-xs font-bold uppercase tracking-widest">Center the medicine in the frame</div>
                          <button 
                            onClick={capturePhoto}
                            className="w-20 h-20 rounded-full border-4 border-white p-1"
                          >
                            <div className="w-full h-full bg-white rounded-full active:scale-90 transition-transform" />
                          </button>
                          <div className="h-4" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Shape & Color Selection */}
                  {!newImage && (
                    <div className="space-y-6 bg-slate-50 p-6 rounded-[2rem]">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Pill Shape</label>
                        <div className="flex justify-around items-center gap-2">
                          {(['Round', 'Oval', 'Capsule'] as PillShape[]).map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setNewShape(s)}
                              className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${newShape === s ? 'bg-white shadow-sm scale-105' : 'opacity-40'}`}
                            >
                              <div className={`bg-slate-400 shadow-inner ${s === 'Round' ? 'w-8 h-8 rounded-full' : s === 'Oval' ? 'w-10 h-6 rounded-[100%]' : 'w-10 h-5 rounded-full'}`} />
                              <span className="text-[10px] font-bold">{s}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Pill Color</label>
                        <div className="flex justify-around gap-2 flex-wrap">
                          {(['Violet', 'Indigo', 'Blue', 'Green', 'Yellow', 'Orange', 'Red', 'White', 'Black'] as PillColor[]).map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewColor(c)}
                              className={`w-10 h-10 rounded-full transition-all ${newColor === c ? 'ring-4 ring-indigo-200 scale-110' : ''} ${
                                c === 'Violet' ? 'bg-violet-400' : 
                                c === 'Indigo' ? 'bg-indigo-400' : 
                                c === 'Blue' ? 'bg-blue-400' : 
                                c === 'Green' ? 'bg-green-400' : 
                                c === 'Yellow' ? 'bg-yellow-400' : 
                                c === 'Orange' ? 'bg-orange-400' : 
                                c === 'Red' ? 'bg-red-400' : 
                                c === 'White' ? 'bg-white border border-slate-200' : 'bg-slate-900'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">Medicine Name</label>
                      <input type="text" placeholder="e.g. Aspirin" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-lg font-medium outline-none transition-all" required />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 uppercase tracking-wider ml-1">Dosage</label>
                      <input type="text" placeholder="e.g. 1 Tablet" value={newDosage} onChange={(e) => setNewDosage(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-lg font-medium outline-none transition-all" required />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-end ml-1">
                        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Additional Instructions</label>
                        <span className={`text-[10px] font-bold ${newAdditionalInstructions.split(/\s+/).filter(Boolean).length > 200 ? 'text-red-500' : 'text-slate-400'}`}>
                          {newAdditionalInstructions.split(/\s+/).filter(Boolean).length} / 200 words
                        </span>
                      </div>
                      <textarea 
                        placeholder="e.g. Take with a full glass of water. Do not crush." 
                        value={newAdditionalInstructions} 
                        onChange={(e) => {
                          const words = e.target.value.split(/\s+/).filter(Boolean);
                          if (words.length <= 200 || e.target.value.length < newAdditionalInstructions.length) {
                            setNewAdditionalInstructions(e.target.value);
                          }
                        }} 
                        className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-2xl p-4 text-lg font-medium outline-none transition-all min-h-[120px] resize-none"
                      />
                    </div>
                  </div>
                </section>

                {/* Usage */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-800"><Info size={20} className="text-indigo-500" /><h3 className="text-lg font-bold">How to use?</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    {['Before Food', 'After Food', 'While Eating', "Doesn't Matter"].map((opt) => (
                      <button key={opt} type="button" onClick={() => setNewUsage(opt as UsageInstruction)} className={`p-4 rounded-2xl text-sm font-bold border-2 transition-all ${newUsage === opt ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600'}`}>{opt}</button>
                    ))}
                  </div>
                </section>

                {/* Frequency */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-800"><Clock size={20} className="text-indigo-500" /><h3 className="text-lg font-bold">Frequency</h3></div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      {['Once Daily', 'Twice Daily', '3 Times a Day'].map((freq) => (
                        <button key={freq} type="button" onClick={() => handleFrequencyChange(freq as FrequencyType)} className={`p-3 rounded-xl text-xs font-bold border-2 transition-all ${newFrequency === freq ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-transparent text-slate-600'}`}>{freq}</button>
                      ))}
                    </div>
                    <div className="grid gap-3">
                      {newTimes.map((time, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-transparent focus-within:border-indigo-500 transition-all">
                          <span className="text-slate-400 font-bold text-sm">Time {idx + 1}</span>
                          <input type="time" value={time} onChange={(e) => updateTime(idx, e.target.value)} className="bg-transparent flex-1 text-lg font-bold outline-none" />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Schedule */}
                <section className="space-y-6">
                  <div className="flex items-center gap-2 text-slate-800"><CalendarDays size={20} className="text-indigo-500" /><h3 className="text-lg font-bold">Schedule</h3></div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2">
                      {['Every Day', 'Specific Days of Week', 'Days Interval'].map((type) => (
                        <button key={type} type="button" onClick={() => setNewScheduleType(type as ScheduleType)} className={`p-4 rounded-2xl text-sm font-bold border-2 text-left flex justify-between items-center transition-all ${newScheduleType === type ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-600'}`}>{type}{newScheduleType === type && <Check size={18} />}</button>
                      ))}
                    </div>
                    {newScheduleType === 'Specific Days of Week' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-indigo-50/50 p-4 rounded-2xl grid grid-cols-7 gap-1">
                        {daysOfWeek.map((day, idx) => (
                          <button key={day} type="button" onClick={() => setNewSpecificDays(newSpecificDays.includes(idx) ? newSpecificDays.filter(d => d !== idx) : [...newSpecificDays, idx])} className={`w-full aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all ${newSpecificDays.includes(idx) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}>{day}</button>
                        ))}
                      </motion.div>
                    )}
                    {newScheduleType === 'Days Interval' && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-indigo-50/50 p-4 rounded-2xl flex items-center gap-4">
                        <span className="text-sm font-bold text-indigo-700">Every</span>
                        <input type="number" min="1" value={newInterval} onChange={(e) => setNewInterval(parseInt(e.target.value))} className="w-20 bg-white border-2 border-indigo-100 rounded-xl p-2 text-center font-bold outline-none" />
                        <span className="text-sm font-bold text-indigo-700">Days</span>
                      </motion.div>
                    )}
                    <div className="grid grid-cols-1 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Start Date</label>
                        <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold outline-none" />
                      </div>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setNewEndDateType('Duration')} className={`flex-1 p-3 rounded-xl text-xs font-bold border-2 ${newEndDateType === 'Duration' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>Number of Days</button>
                          <button type="button" onClick={() => setNewEndDateType('Date')} className={`flex-1 p-3 rounded-xl text-xs font-bold border-2 ${newEndDateType === 'Date' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>End Date</button>
                        </div>
                        {newEndDateType === 'Duration' ? (
                          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl">
                            <span className="text-sm font-bold text-slate-500">For</span>
                            <input type="number" min="1" value={newDurationDays} onChange={(e) => setNewDurationDays(parseInt(e.target.value))} className="w-20 bg-white border-2 border-slate-200 rounded-xl p-2 text-center font-bold outline-none" />
                            <span className="text-sm font-bold text-slate-500">Days</span>
                          </div>
                        ) : (
                          <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-4 font-bold outline-none" />
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Reminder Sound */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-800"><Volume2 size={20} className="text-indigo-500" /><h3 className="text-lg font-bold">Reminder Sound</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    {(['Chime', 'Bell', 'Soft Alert', 'Digital', 'Gentle', 'Piano', 'Guitar', 'Zen', 'Nature'] as ReminderSound[]).map((sound) => (
                      <button 
                        key={sound} 
                        type="button" 
                        onClick={() => {
                          setNewReminderSound(sound);
                          playReminderSound(sound);
                        }} 
                        className={`p-4 rounded-2xl text-sm font-bold border-2 flex items-center justify-between transition-all ${newReminderSound === sound ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-600'}`}
                      >
                        {sound}
                        <Volume2 size={16} className={newReminderSound === sound ? 'text-white' : 'text-slate-400'} />
                      </button>
                    ))}
                  </div>
                </section>

                <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-3xl text-xl font-bold shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all sticky bottom-0">Save Reminder</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="bg-white border-t border-slate-100 px-8 py-4 flex justify-around items-center safe-bottom flex-shrink-0">
        <button 
          onClick={() => setActiveTab('today')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'today' ? 'text-indigo-600' : 'text-slate-300'}`}
        >
          <Calendar size={24} strokeWidth={2.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Today</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-300'}`}
        >
          <HistoryIcon size={24} strokeWidth={2.5} />
          <span className="text-[10px] font-bold uppercase tracking-widest">History</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-indigo-600' : 'text-slate-300'}`}
        >
          <div className={`w-6 h-6 rounded-full overflow-hidden border-2 transition-all ${activeTab === 'settings' ? 'border-indigo-600' : 'border-slate-300'}`}>
            {userProfile?.photo ? (
              <img src={userProfile.photo} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                <Plus size={12} className="text-slate-400" />
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Settings</span>
        </button>
      </nav>

      {/* Reminder Pop-up Modal */}
      <AnimatePresence>
        {dueDose && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-red-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ 
                scale: [1, 1.02, 1],
                transition: { repeat: Infinity, duration: 2 }
              }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl text-center space-y-8 border-4 border-red-500"
            >
              <div className="flex flex-col items-center space-y-4">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center"
                >
                  <Bell size={48} className="text-red-600" />
                </motion.div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">Time for Medicine!</h2>
                <p className="text-red-600 font-black text-xl animate-pulse">It's {dueDose.time}</p>
              </div>

              <div className="bg-slate-50 rounded-[2rem] p-6 border-2 border-red-50 flex items-center gap-4 text-left">
                <div className="w-20 h-20 rounded-2xl bg-white flex-shrink-0 overflow-hidden flex items-center justify-center border border-red-100">
                  {dueDose.image ? (
                    <img src={dueDose.image} alt={dueDose.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <PillVisual shape={dueDose.shape} color={dueDose.color} size="sm" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{dueDose.name}</h3>
                  <p className="text-red-600 font-black">{dueDose.dosage}</p>
                  <p className="text-slate-400 text-xs font-bold uppercase mt-1">{dueDose.usage}</p>
                  {dueDose.additionalInstructions && (
                    <div className="mt-2 p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                      <p className="text-slate-600 text-[11px] italic leading-relaxed">
                        "{dueDose.additionalInstructions}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    toggleTaken(dueDose.id);
                    setDueDose(null);
                    stopAlerting();
                  }}
                  className="w-full bg-emerald-600 text-white py-5 rounded-3xl text-xl font-bold shadow-xl shadow-emerald-200 active:scale-95 transition-all"
                >
                  I've Taken It
                </button>
                <button 
                  onClick={async () => {
                    const med = medicines.find(m => m.id === dueDose.medicineId);
                    if (med) {
                      const snoozeTime = new Date();
                      snoozeTime.setMinutes(snoozeTime.getMinutes() + 5);
                      
                      await LocalNotifications.schedule({
                        notifications: [{
                          title: `⏰ Snoozed: ${med.name}`,
                          body: `Reminder for ${med.dosage} was snoozed for 5 minutes.`,
                          id: Math.floor(Math.random() * 1000000),
                          schedule: { at: snoozeTime, allowWhileIdle: true },
                          sound: 'res://default',
                          channelId: 'medication-reminders',
                          extra: { medId: med.id, time: dueDose.time, date: dueDose.date }
                        }]
                      });
                    }
                    setDueDose(null);
                    stopAlerting();
                  }}
                  className="w-full bg-slate-100 text-slate-500 py-4 rounded-3xl text-lg font-bold active:scale-95 transition-all"
                >
                  Snooze (5 mins)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
