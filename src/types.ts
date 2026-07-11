export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN'
}

export interface User {
  id: number;
  username: string;
  email: string;
  passwordHash?: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Hymn {
  id: number;
  hymnNumber: number;
  title: string;
  lyrics: string;
  chorus?: string;
  category: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  date?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  expiryDate?: string;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  id: number;
  book: string;
  chapter: number;
  verse: string;
  displayText: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomMessage {
  id: number;
  type: 'WELCOME' | 'OFFERING' | 'COMMUNION' | 'PRAYER_POINTS' | 'CLOSING' | 'SPECIAL_PROGRAM';
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentDisplay {
  id: number;
  displayType: 'HYMN' | 'ANNOUNCEMENT' | 'CITATION' | 'MESSAGE' | 'WELCOME_SLIDE';
  recordId: number;
  lastUpdated: string;
  status: string;
  data?: any; // Hydrated content for the frontend
}

export interface ActivityLog {
  id: number;
  action: string;
  username: string;
  details: string;
  timestamp: string;
}

export interface DisplayHistory {
  id: number;
  displayType: string;
  recordId: number;
  title: string;
  displayedAt: string;
}

export interface ChurchSettings {
  churchName: string;
  headerText: string;
  footerText: string;
  footerBibleVerse: string;
  footerContact: string;
  footerAddress: string;
  footerPhone: string;
  footerEmail: string;
  footerCopyright: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  fontFamily: 'sans' | 'serif' | 'mono';
  logoUrl?: string; // base64 logo string
}
