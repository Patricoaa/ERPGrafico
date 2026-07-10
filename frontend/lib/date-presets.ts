import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from 'date-fns'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

export function today() {
  const now = new Date()
  return { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) }
}

export function thisWeek() {
  const now = new Date()
  return { from: fmt(startOfWeek(now, { weekStartsOn: 1 })), to: fmt(endOfWeek(now, { weekStartsOn: 1 })) }
}

export function thisMonth() {
  const now = new Date()
  return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) }
}

export function thisQuarter() {
  const now = new Date()
  return { from: fmt(startOfQuarter(now)), to: fmt(endOfQuarter(now)) }
}

export function thisYear() {
  const now = new Date()
  return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) }
}
