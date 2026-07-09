export type ScheduleSlotState = {
  memberIds?: string[];
  time: string;
  names: string[];
};

export type ScheduleDayState = {
  day: string;
  date: string;
  isoDate: string;
  slots: ScheduleSlotState[];
};
