export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tag = url.searchParams.get('tag');

    if (!tag) {
      return new Response('Tag parameter is required', { status: 400 });
    }

    const currentDate = new Date();
    const currentUTCDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate(), currentDate.getUTCHours(), currentDate.getUTCMinutes(), currentDate.getUTCSeconds()));
    const currentUTCPlus8Date = new Date(currentUTCDate.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('.000Z', '+08:00');

    // Initialize the database
    const db = env.DB;

    // Ensure necessary tables exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT UNIQUE
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag_id INTEGER,
        visit_time TEXT,
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      )
    `).run();

    // Get or insert tag
    let tagId = (await db.prepare(`SELECT id FROM tags WHERE tag = ?`).bind(tag).first())?.id;
    if (!tagId) {
      await db.prepare(`INSERT INTO tags (tag) VALUES (?)`).bind(tag).run();
      tagId = (await db.prepare(`SELECT id FROM tags WHERE tag = ?`).bind(tag).first())?.id;
    }

    // Insert visit record
    const visitTime = currentUTCPlus8Date.toString();
    await db.prepare(`INSERT INTO visits (tag_id, visit_time) VALUES (?, ?)`).bind(tagId, visitTime).run();

    // Retrieve counts
    const totalHits = (await db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tag_id = ?`).bind(tagId).first())?.count || 0;
    const todayHits = (await db.prepare(`SELECT COUNT(*) as count FROM visits WHERE tag_id = ? AND visit_time >= ?`).bind(tagId, currentUTCPlus8Date.toString().slice(0, 10)).first())?.count || 0;

    // Generate SVG
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="30"><defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#f0f0f0;stop-opacity:1" /><stop offset="100%" style="stop-color:#e6e6e6;stop-opacity:1" /></linearGradient></defs><rect width="150" height="30" rx="5" fill="url(#grad)" stroke="#d0d0d0" stroke-width="1"/><text x="75" y="20" font-family="Arial, sans-serif" font-size="14" fill="#333" text-anchor="middle">${totalHits} / ${todayHits}</text></svg>`.trim();

    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'X-Total-Hits': totalHits.toString(),
        'X-Today-Hits': todayHits.toString(),
        'X-Record-Time': currentUTCPlus8Date.toString(),
        'X-Tag': tag
      }
    });
  }
};