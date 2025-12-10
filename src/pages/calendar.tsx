
import { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import Head from 'next/head';
import timeGridPlugin from '@fullcalendar/timegrid';

export default function CalendarPage() {
const calendarRef = useRef<any>(null); // or more properly: RefObject<FullCalendar>

  const [calendarView, setCalendarView] = useState('dayGridMonth');
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'tv' | 'movie'>('all');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
const popupRef = useRef<HTMLDivElement>(null);

  const formatEpisodeCode = (code: string): string => {
    const singleMatch = code.match(/^S(\d+)E(\d+)$/i);
    if (singleMatch) {
      const season = parseInt(singleMatch[1], 10);
      const episode = parseInt(singleMatch[2], 10);
      return `Season ${season}, Episode ${episode}`;
    }

    const rangeSameSeason = code.match(/^S(\d+)E(\d+)–E(\d+)$/i);
    if (rangeSameSeason) {
      const season = parseInt(rangeSameSeason[1], 10);
      const epStart = parseInt(rangeSameSeason[2], 10);
      const epEnd = parseInt(rangeSameSeason[3], 10);
      return `Season ${season}, Episodes ${epStart}–${epEnd}`;
    }

    const rangeDiffSeason = code.match(/^S(\d+)E(\d+)–S(\d+)E(\d+)$/i);
    if (rangeDiffSeason) {
      const s1 = parseInt(rangeDiffSeason[1], 10);
      const e1 = parseInt(rangeDiffSeason[2], 10);
      const s2 = parseInt(rangeDiffSeason[3], 10);
      const e2 = parseInt(rangeDiffSeason[4], 10);
      return `Season ${s1}, Episode ${e1} – Season ${s2}, Episode ${e2}`;
    }

    return code;
  };

  const extractSeasonNumber = (code: string) => {
    const match = code.match(/^S(\d+)/i);
    return match ? parseInt(match[1], 10) : '';
  };

  const extractEpisodeNumber = (code: string) => {
    const match = code.match(/E(\d+)$/i);
    return match ? parseInt(match[1], 10) : '';
  };

  const getEventClass = (_event?: any) => 'event-neutral';


  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const view = isMobile ? 'dayGridDay' : 'dayGridMonth';
      setCalendarView(view);
      calendarRef.current?.getApi().changeView(view);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const filterWrapper = document.querySelector('.fc-customFilter-button');
    if (filterWrapper) {
      const existing = filterWrapper.querySelector('select');
      if (existing) return;

      const dropdown = document.createElement('select');
      dropdown.className = 'calendar-filter';
      dropdown.innerHTML = `
        <option value="all">All</option>
        <option value="tv">TV Only</option>
        <option value="movie">Movies Only</option>
      `;
      dropdown.value = filter;
      dropdown.onchange = (e) => {
        const val = (e.target as HTMLSelectElement).value as 'all' | 'tv' | 'movie';
        setFilter(val);
      };

      filterWrapper.innerHTML = '';
      filterWrapper.appendChild(dropdown);
    }
  }, [filter]);

useEffect(() => {
  function handleClickOutside(event: MouseEvent) {
    if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
      setSelectedEvent(null);
      document.body.style.overflow = '';
    }
  }

  if (selectedEvent) {
    document.addEventListener('mousedown', handleClickOutside);
  }

  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [selectedEvent]);


  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/calendar');
        const data = await res.json();
        const enriched = data.map((e: any) => {
          const isMovie = e.type === 'movie' || (!e.type && !e.episodeCode);
          const calendarTitle = isMovie
            ? e.year ? `${e.title} (${e.year})` : e.title
            : e.episodeCode ? `${e.title} - ${e.episodeCode}` : e.title;

          const fanart = e.images?.find((img: any) => img.coverType === 'fanart')?.remoteUrl || e.fanart;

          return {
            ...e,
            calendarTitle,
            displayTitle: e.year ? `${e.title} (${e.year})` : e.title,
            type: e.type || (e.title.includes('S') && e.title.includes('E') ? 'tv' : 'movie'),
            tmdbId: e.tmdbId || e.series?.tmdbId || null,
            fanart,
          };
        });
        setEvents(enriched);
      } catch (err) {
        console.error('Failed to load events:', err);
      }
    };
    loadEvents();
  }, []);

  const filteredEvents = events.filter((e) =>
    filter === 'all' ? true : e.type === filter
  );

 return (
  <>
      <Head>
        <title>Calendar - Jellyseerr</title>
      </Head>
<div className="calendar-wrapper">
<FullCalendar
  ref={calendarRef}
  plugins={[dayGridPlugin, timeGridPlugin]}
  initialView={calendarView}
  locale="en-au"
  firstDay={1}
  views={{
    dayGridMonth: {
      dayHeaderFormat: { weekday: 'short' },
    },
    timeGridWeek: {
      dayHeaderFormat: {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        omitCommas: true,
      },
    },
    dayGridDay: {
      dayHeaderFormat: {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      },
    },
  }}
  headerToolbar={{
    start: 'prev,today,next',
    center: 'title',
    end: 'dayGridDay,dayGridWeek,dayGridMonth customFilter',
  }}
  customButtons={{
    customFilter: {
      text: '',
      click: () => {},
    },
  }}
  fixedWeekCount={false}
  contentHeight="auto"
  events={filteredEvents.map((e) => ({
    title: e.calendarTitle,
    start: e.start,
    className: getEventClass(e),
    extendedProps: { ...e },
  }))}
        eventDidMount={(info) => {
          if (info.el && info.event.extendedProps.type === 'tv') {
            const title = info.event.extendedProps.displayTitle || info.event.title || '';
            const code = info.event.extendedProps.episodeCode || '';
            const epTitle = info.event.extendedProps.episodeTitle || '';
            const tooltipText = [title, code, epTitle].filter(Boolean).join('\n');
            info.el.setAttribute('title', tooltipText);
          }
        }}
        eventClick={(info) => {
          const scrollY = window.scrollY;
          info.jsEvent.preventDefault();
          info.jsEvent.stopPropagation();
          info.jsEvent.cancelBubble = true;
          info.jsEvent.stopImmediatePropagation?.();
          window.scrollTo({ top: scrollY });
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollY });
          });



          setSelectedEvent({
            fanart: info.event.extendedProps.fanart,
            title: info.event.extendedProps.title,
            displayTitle: info.event.extendedProps.displayTitle,
            start: info.event.startStr,
            status: info.event.extendedProps.status,
            description: info.event.extendedProps.description,
            episodeTitle: info.event.extendedProps.episodeTitle,
            episodeCode: info.event.extendedProps.episodeCode,
            type: info.event.extendedProps.type,
            tmdbId: info.event.extendedProps.tmdbId,
            year: info.event.extendedProps.year,
            certification: info.event.extendedProps.certification,
            runtime: info.event.extendedProps.runtime,
            genres: info.event.extendedProps.genres,
            episodes: info.event.extendedProps.episodes,
          });
          document.body.style.overflow = 'hidden';
        }}
        eventContent={(arg) => {
          const event = arg.event.extendedProps;
          const container = document.createElement('div');
          container.className = 'fc-event-custom';

          const titleLine = document.createElement('div');
          titleLine.className = 'fc-event-title';
          const dot =
            event.type === 'tv'
              ? '<span class="media-dot tv-dot"></span>'
              : event.type === 'movie'
              ? '<span class="media-dot movie-dot"></span>'
              : '';
          titleLine.innerHTML = `${dot}${event.title || arg.event.title || ''}`;

          const subLine = document.createElement('div');
          let subText = '';
          let isAvailable = false;

          if (event.episodes && Array.isArray(event.episodes)) {
            const codes = event.episodes.map((e: any) => e.episodeCode).filter(Boolean);
            subText =
              codes.length === 1
                ? codes[0]
                : `${codes[0].slice(0, 3)}${codes[0].slice(3)}–${codes[codes.length - 1].slice(3)}`;
            isAvailable = event.episodes[0].status === 'Available';
          } else if (event.episodeCode) {
            subText = event.episodeCode;
            isAvailable = event.status === 'Available';
          } else if (event.type === 'movie') {
            isAvailable = event.status === 'Available';
            const cert = event.certification || '';
            const runtime = event.runtime ? `${event.runtime} minutes` : '';
            subText = [cert, runtime].filter(Boolean).join(' | ');
          }

          subLine.innerHTML = `${subText} ${
            isAvailable ? '<span class="tick-icon">✅</span>' : ''
          }`;
          subLine.className = 'fc-event-sub';

          container.appendChild(titleLine);
          container.appendChild(subLine);



          return { domNodes: [container] };
        }}
      />

      {/* ✅ LEGEND GOES HERE */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="media-dot tv-dot"></span> TV Show
        </div>
        <div className="legend-item">
          <span className="media-dot movie-dot"></span> Movie
        </div>
        <div className="legend-item">
          <span className="tick-icon">✅</span> Available
        </div>
      </div>


      {selectedEvent && (
        <div className="popup-overlay">
          <div className="popup-content">
            <div
              className="popup-background"
              style={{
                backgroundImage: selectedEvent?.fanart
                  ? `url(${selectedEvent.fanart})`
                  : undefined,
              }}
            ></div>
            <div className="popup-foreground" ref={popupRef}>
              <h2 className="popup-title">
                {selectedEvent.displayTitle || selectedEvent.title}
              </h2>

              {Array.isArray(selectedEvent.episodes) &&
              selectedEvent.episodes.length > 0 ? (
                <>
                  <h3 className="popup-episode">
                    Season{' '}
                    {extractSeasonNumber(selectedEvent.episodes[0]?.episodeCode)}
                  </h3>
                  <div className="popup-episodes-list">
                    {selectedEvent.episodes.map((ep: any, idx: number) => (
                      <div key={idx} className="popup-episode">
                        Episode {extractEpisodeNumber(ep.episodeCode)}
                        {ep.episodeTitle ? ` – ${ep.episodeTitle}` : ''}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {selectedEvent.episodeCode && (
                    <h3 className="popup-episode">
                      {formatEpisodeCode(selectedEvent.episodeCode)}
                    </h3>
                  )}
                  {selectedEvent.episodeTitle && (
                    <p className="popup-description">
                      {selectedEvent.episodeTitle}
                    </p>
                  )}
                  {selectedEvent.seriesOverview && (
                    <p className="popup-description">
                      {selectedEvent.seriesOverview}
                    </p>
                  )}
                  {selectedEvent.description && (
                    <p>{selectedEvent.description}</p>
                  )}
                </>
              )}

              {selectedEvent.type === 'movie' && (
                <p className="popup-meta">
                  {[selectedEvent.certification,
                    selectedEvent.runtime ? `${selectedEvent.runtime} minutes` : null,
                    selectedEvent.genres?.join(', ')
                  ]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              )}

<div className="popup-footer">
  <div className="popup-status-badge">
    {Array.isArray(selectedEvent.episodes) && selectedEvent.episodes.length > 0 ? (
      (() => {
        const allAvailable = selectedEvent.episodes.every((ep: any) => ep.status === 'Available');
        const anyRequested = selectedEvent.episodes.some((ep: any) => ep.status === 'Requested');

        if (allAvailable) {
          return <span className="badge badge-available">Available</span>;
        } else if (anyRequested) {
          return <span className="badge badge-requested">Requested</span>;
        } else {
          return null;
        }
      })()
    ) : selectedEvent.status === 'Available' ? (
      <span className="badge badge-available">Available</span>
    ) : (
      <span className="badge badge-requested">Requested</span>
    )}
  </div>

                <div className="popup-actions">
                  <button
                    className="popup-close-btn"
                    onClick={() => {
                      const scrollY = window.scrollY;
                      requestAnimationFrame(() => {
                        window.scrollTo({ top: scrollY });
                      });
                      setSelectedEvent(null);
                      document.body.style.overflow = '';
                    }}
                  >
                    Close
                  </button>

                  {selectedEvent.type === 'tv' && selectedEvent.tmdbId && (
                    <a
                      href={`/tv/${selectedEvent.tmdbId}`}
                      className="calendar-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Series
                    </a>
                  )}

                  {selectedEvent.type === 'movie' && selectedEvent.tmdbId && (
                    <a
                      href={`/movie/${selectedEvent.tmdbId}`}
                      className="calendar-link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View Movie
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>


    <style jsx global>{`
  /* Popup Layout */
  .popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 100vw;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  }

  .popup-content {
    position: relative;
    overflow: hidden;
    border-radius: 1rem;
    background: #1d2635;
    padding: 2rem;
    color: #fff;
    width: 90vw;
    max-width: 700px;
  }

  .popup-background {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    filter: blur(1px) brightness(0.6);
    z-index: 0;
  }
.fc-event {
  cursor: pointer;
}
.event-neutral {
  color: inherit !important;
}
.popup-episodes-list {
  margin-bottom: 1rem;
}

.popup-episodes-list .popup-episode {
  font-size: 0.875rem;
  font-weight: normal;
  color: #e5e7eb;
  margin-bottom: 0.25rem;
}

.popup-episode {
  margin-bottom: 0.25rem;
}
.fc-event-title {
  font-weight: bold;
  font-size: 0.9rem;
  color: #ffffff;
}
.media-dot {
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  border-radius: 50%;
  margin-right: 0.4em;
  vertical-align: middle;
}

.tv-dot {
  background-color: #3b82f6; /* blue-500 */
}

.movie-dot {
  background-color: #f97316; /* orange-500 */
}

.fc-event-sub {
  font-size: 0.75rem;
  color: #a0aec0;
}
  .popup-foreground {
    position: relative;
    z-index: 1;
    color: white;
  }

  .popup-title {
    font-size: 1.5rem;
    font-weight: bold;
  color: #ffffff; /* White */
    margin-bottom: 0.25rem;
  }

  .popup-episode {
    font-size: 1.1rem;
    font-weight: bold;
    margin-bottom: 0.75rem;
  }

  .popup-description {
    margin-bottom: 0.75rem;
  color: #e5e7eb; /* Light grey, same as calendar episode list */
  }

  .popup-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
  }
.calendar-legend {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #e5e7eb;
  flex-wrap: wrap;
  padding-left: 0.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
  .popup-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .popup-close-btn {
    background-color: transparent;
    border: 1px solid #4b5563;
    color: #e5e7eb;
    padding: 6px 12px;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
  }

  .popup-close-btn:hover {
    background-color: #2d3748;
  }

  .popup-meta {
    font-size: 0.75rem;
    color: #a0aec0;
    margin-top: 1rem;
  }

  .popup-close {
    display: none;
  }

  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    color: #fff;
    display: inline-block;
  }

  .badge-available {
    background-color: #22c55e;
  }

  .badge-requested {
    background-color: #6366f1;
  }

  .calendar-link {
    display: inline-block;
    background-color: #3949ab;
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    text-decoration: none;
  }

  .calendar-link:hover {
    background-color: #5c6bc0;
  }

  /* Calendar Layout */
.calendar-wrapper {
  width: 100%;
  max-width: 100%;
  margin: 0;
  padding: 1rem;
  border-radius: 1rem;
  background-color: #151e2c;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}


  .calendar-filter {
    padding: 4px 8px;
    border-radius: 6px;
    background-color: #1d2635;
    color: white;
    border: 1px solid #374151;
    font-size: 0.875rem;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
  }

  .fc {
    background-color: #1d2635;
    border-radius: 1rem;
    padding: 1rem;
  width: 100% !important;
  }

.fc .fc-scrollgrid {
  width: 100% !important;
}

  .fc-daygrid-event {
    border-radius: 0.5rem;
    padding: 2px 4px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fc-daygrid-event-dot {
    display: none !important;
  }

  .event-available {
    color: #81c784 !important;
  }

  .event-pending {
    color: #ffb74d !important;
  }

  .event-expired {
    color: #e57373 !important;
  }

  .fc-toolbar-title {
    color: #ffffff;
  }

  .fc-button {
    background-color: #1d2635;
    border: 1px solid #374151;
    color: #e5e7eb;
    font-weight: 500;
    border-radius: 0.3rem;
  }

  .fc-button:hover {
    background-color: #374151;
    color: #ffffff;
  }

  .fc-col-header-cell {
    color: #ccc;
  }

  .fc-daygrid-day-number {
    color: #fff;
    font-weight: bold;
  }

  .fc-day-today {
    background-color: inherit !important;
  }

  .fc-day-today .fc-daygrid-day-number {
    background-color: #3949ab;
    padding: 4px 6px;
    border-radius: 6px;
    color: #fff !important;
  }

  .fc-dayGridDay-view .fc-col-header {
    display: none !important;
  }

  .fc-timegrid-slot-label,
  .fc-timegrid-axis {
    display: none !important;
  }

  .fc .fc-toolbar .fc-button.fc-customFilter-button {
    background-color: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
  }

  /* Mobile Styles */
  @media (max-width: 768px) {
    .fc-header-toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .fc-header-toolbar .fc-toolbar-chunk {
      width: 100%;
      justify-content: center;
      display: flex;
      flex-wrap: wrap;
    }

    .calendar-filter {
      margin-left: 0;
      margin-top: 0.5rem;
    }

    .fc-button[title="month view"],
    .fc-button[title="week view"] {
      display: none !important;
    }

    .fc-button[title="day view"] {
      font-size: 0;
    }

    .fc-button[title="day view"]::after {
      content: "•";
      font-size: 0.5rem;
      color: #1d2635;
    }
.fc-event-custom {
  white-space: normal;
  line-height: 1.2;
}

.fc-event-title {
  font-weight: bold;
  font-size: 0.9rem;
  color: #fff;
}

.fc-event-sub {
  font-size: 0.75rem;
  color: #bbb;
}

  }
`}</style>

    </>
  );
}
