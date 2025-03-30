export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const tag = url.searchParams.get('tag');
  
      if (!tag) {
        return new Response('Tag parameter is required', { status: 400 });
      }
  
      const currentDate = new Date();
      const currentUTCDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
      const currentUTCPlus8Date = new Date(currentUTCDate.getTime() + 8 * 60 * 60 * 1000);
  
      // Initialize the database
      const db = env.DB;
  
      // Ensure necessary tables exist
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS hits (
          tag TEXT,
          total_hits INTEGER,
          PRIMARY KEY (tag)
        )
      `).run();
  
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS daily_hits (
          tag TEXT,
          date TEXT,
          hits INTEGER,
          PRIMARY KEY (tag, date)
        )
      `).run();
  
      // Increment total hits
      await db.prepare(`
        INSERT INTO hits (tag, total_hits)
        VALUES (?, 1)
        ON CONFLICT(tag) DO UPDATE SET total_hits = total_hits + 1
      `).bind(tag).run();
  
      // Increment today's hits
      const dateStr = currentUTCPlus8Date.toISOString();
      await db.prepare(`
        INSERT INTO daily_hits (tag, date, hits)
        VALUES (?, ?, 1)
        ON CONFLICT(tag, date) DO UPDATE SET hits = hits + 1
      `).bind(tag, dateStr).run();
  
      // Retrieve counts
      const totalHits = (await db.prepare(`SELECT total_hits FROM hits WHERE tag = ?`).bind(tag).first())?.total_hits || 0;
      const todayHits = (await db.prepare(`SELECT hits FROM daily_hits WHERE tag = ? AND date = ?`).bind(tag, dateStr).first())?.hits || 0;
  
      // Generate SVG
      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="150" height="30">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#f0f0f0;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#e6e6e6;stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="150" height="30" rx="5" fill="url(#grad)" stroke="#d0d0d0" stroke-width="1"/>
          <text x="75" y="20" font-family="Arial, sans-serif" font-size="14" fill="#333" text-anchor="middle">
            ${totalHits} / ${todayHits}
          </text>
        </svg>
      `.trim();

      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
          'X-Total-Hits': totalHits.toString(),
          'X-Today-Hits': todayHits.toString(),
          'X-Record-Time': currentUTCPlus8Date.toISOString(),
          'X-Tag': tag
        }
      });
    }
  };