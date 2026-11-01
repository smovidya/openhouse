export interface BoothStats {
  id: string;
  name: string | null;
  department: string | null;
  type: "booth" | "tcas" | "central_activity";
  scans: number;
}

export interface WorkshopRoundStats {
  slotId: string;
  roundNumber: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  advance: number;
  walkIn: number;
  /** Attendees who actually checked in (showed up) for this round. */
  attended: number;
  /** Advance-booked attendees who checked in for this round. */
  advanceArrived: number;
  /** Walk-in attendees who checked in for this round. */
  walkInArrived: number;
}

export interface WorkshopStats {
  slug: string;
  title: string;
  hostDepartment: string;
  hostDepartmentAbbr: string;
  rounds: WorkshopRoundStats[];
}

export interface WorkshopRoundAttendee {
  id: string;
  firstname: string;
  lastname: string;
  school: string | null;
  registeredAt: string;
  type: "advance" | "walk-in";
  /** Whether this attendee has checked in for the round. */
  checkedIn: boolean;
}

/** Event-day breakdown of a count: day 1 (31 Oct), day 2 (1 Nov), then total. */
export interface DaySplit {
  day1: number;
  day2: number;
  total: number;
}

export interface DashboardStats {
  registered: number;
  attended: number;
  totalCheckins: number;
  activeNow: number;
  /** Distinct event attendees per event day (entry check-in). */
  attendedByDay: DaySplit;
  /** Check-in log count per event day. */
  checkinsByDay: DaySplit;
  booths: BoothStats[];
  hourly: { hour: string; count: number }[];
  /** Hourly check-ins at entry checkpoints only (distinct event arrival). */
  hourlyEntry: { hour: string; count: number }[];
  workshops: WorkshopStats[];
  updatedAt: string;
}

export interface DashboardFeedItem {
  id: string;
  createdAt: string;
  firstname: string;
  lastnameInitial: string;
  checkpointName: string | null;
  checkpointType: string;
}
