import { Between } from 'typeorm';

export const AfterDate = (date: Date) => {
  const endDate = new Date(date.getTime());
  endDate.setFullYear(endDate.getFullYear() + 100);
  return Between(date, endDate);
};
