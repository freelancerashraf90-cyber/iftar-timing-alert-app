# Iftar Timing Alert App

## Current State
New project with no existing code.

## Requested Changes (Diff)

### Add
- A countdown timer for Iftar (breaking fast at sunset) for the current date and user's location/city
- A countdown timer for Sehri (pre-dawn meal) for the current date and user's location/city
- Prayer times fetched from a public API (Al Adhan API via HTTP outcalls) based on city/country input
- Browser notification alert 10 minutes before Iftar time
- Browser notification alert 10 minutes before Sehri time
- A city/country input form so the user can specify their location
- Display of today's full Iftar and Sehri (Fajr) times
- Visual indication when the countdown is in the "10-minute alert" zone
- Audio alert/beep when the 10-minute warning triggers

### Modify
- None (new project)

### Remove
- None (new project)

## Implementation Plan
1. Backend: Use http-outcalls component to call the Al Adhan API (https://api.aladhan.com/v1/timingsByCity) to fetch daily prayer times for a given city and country. Expose a canister method `getPrayerTimes(city: Text, country: Text) : async Result<PrayerTimes, Text>` that returns Fajr (Sehri end) and Maghrib (Iftar) times.
2. Frontend: 
   - City/country input form with submit button
   - Two large countdown timer cards: one for Iftar (Maghrib), one for Sehri (Fajr)
   - Timers count down in HH:MM:SS format using local time
   - At 10-minute mark, request browser Notification permission and fire an alert notification
   - Visual highlight/pulse animation when timer enters 10-minute warning zone
   - Display the actual time for each event (e.g., "Iftar at 6:32 PM")
   - Handle timezone: parse the times returned by the API and compare against the user's local clock
   - Persist city/country in localStorage so user doesn't re-enter each time
