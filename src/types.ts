export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export type UsageInstruction = 'Before Food' | 'After Food' | 'While Eating' | "Doesn't Matter";
export type ScheduleType = 'Every Day' | 'Specific Days of Week' | 'Days Interval';
export type FrequencyType = 'Once Daily' | 'Twice Daily' | '3 Times a Day';
export type PillShape = 'Round' | 'Oval' | 'Capsule';
export type PillColor = 'Violet' | 'Indigo' | 'Blue' | 'Green' | 'Yellow' | 'Orange' | 'Red' | 'White' | 'Black';
export type ReminderSound = 'Chime' | 'Bell' | 'Soft Alert' | 'Digital';

export interface UserProfile {
  name: string;
  photo?: string;
  dob: string;
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  times: string[]; // Support multiple times
  timeOfDay: TimeOfDay; // Primary time of day for sorting
  image?: string;
  shape: PillShape;
  color: PillColor;
  usage: UsageInstruction;
  schedule: {
    type: ScheduleType;
    specificDays?: number[]; // 0-6 for Sun-Sat
    interval?: number;
    startDate: string;
    endDateType: 'Duration' | 'Date';
    durationDays?: number;
    endDate?: string;
  };
  frequency: FrequencyType;
  taken?: boolean;
  reminderSound: ReminderSound;
}

export const TIME_OF_DAY_ORDER: TimeOfDay[] = ['Morning', 'Afternoon', 'Evening', 'Night'];
