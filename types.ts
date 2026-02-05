
export enum UserRole {
  TRAINER = 'trainer',
  CLIENT = 'client'
}

export interface UserProfile {
  uid: string;
  name: string;
  phone: string;
  role: UserRole;
  registeredOn: number;
  accessCode?: string; // Trainer-set password for client login
}

export interface VideoCategory {
  id: string;
  name: string;
  icon?: string;
}

export interface VideoItem {
  id: string;
  categoryId: string;
  title: string;
  url: string; // URL to the video (YouTube/Vimeo or direct link)
  description?: string;
  addedOn: number;
}

export interface DietPlan {
  id: string;
  date: number;
  nutrients: string;
  meals: string;
  notes: string;
}

export interface ScheduleItem {
  id: string;
  title: string;
  time: string; // Display time string
  timestamp: number; // For sorting
  trainer: string;
  invitedUids: string[];
}

export interface ActiveClass {
  meetingId: string | null;
  status: 'live' | 'idle';
  trainerName: string;
  startTime?: number;
  invitedUids?: string[];
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
}
