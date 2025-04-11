export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const tag = url.searchParams.get('tag');
    const isWeb = url.searchParams.get('web') === 'true';

    // 修改初始检查逻辑
    if (!tag && !isWeb) {
      return new Response('Tag parameter is required', { status: 400 });
    }

    const currentDate = new Date();
    const utcTime = currentDate.getTime();
    const utcPlus8Time = utcTime + (8 * 60 * 60 * 1000);
    const currentUTCPlus8Date = new Date(utcPlus8Time).toISOString().replace('.000Z', '+08:00');
    const today = currentUTCPlus8Date.slice(0, 10);

    const db = env.DB;

    // Create and update necessary tables
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT UNIQUE
      )
    `).run();

    // Add last_cleanup_date column if it doesn't exist
    try {
      await db.prepare(`SELECT last_cleanup_date FROM tags LIMIT 1`).run();
    } catch (e) {
      // Column doesn't exist, add it
      await db.prepare(`
        ALTER TABLE tags 
        ADD COLUMN last_cleanup_date TEXT
      `).run();
      // Set default value for existing records
      await db.prepare(`
        UPDATE tags 
        SET last_cleanup_date = date('now')
        WHERE last_cleanup_date IS NULL
      `).run();
    }

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS visits (
        tag_id INTEGER,
        visit_time TEXT,
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS history_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag_id INTEGER,
        date TEXT,
        count INTEGER,
        UNIQUE(tag_id, date),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      )
    `).run();

    // 当没有 tag 且是网页请求时，显示总览页面
    if (!tag && isWeb) {
      // 获取所有 tag 的统计数据
      const allTagsStats = await db.prepare(`
        SELECT 
          t.tag,
          COALESCE(
            (SELECT SUM(count) FROM history_stats WHERE tag_id = t.id), 
            0
          ) + COALESCE(
            (SELECT COUNT(*) FROM visits WHERE tag_id = t.id AND date(visit_time) = ?),
            0
          ) as total_hits,
          COALESCE(
            (SELECT COUNT(*) FROM visits WHERE tag_id = t.id AND date(visit_time) = ?),
            0
          ) as today_hits
        FROM tags t
        ORDER BY total_hits DESC
      `).bind(today, today).all();

      // HTML template for overview page
      const overviewHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>访问统计总览</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; max-width: 800px; margin: 0 auto; padding: 20px; }
        .stats-container { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; background: white; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f8f8; }
        tr:hover { background-color: #f5f5f5; }
        .tag-link { color: #0066cc; text-decoration: none; }
        .tag-link:hover { text-decoration: underline; }
        h1 { color: #333; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>访问统计总览</h1>
    <div class="stats-container">
        <table>
            <thead>
                <tr>
                    <th>标签</th>
                    <th>总访问量</th>
                    <th>今日访问量</th>
                </tr>
            </thead>
            <tbody>
                ${allTagsStats.results.map(stat => `
                    <tr>
                        <td><a class="tag-link" href="?tag=${encodeURIComponent(stat.tag)}&web=true">${stat.tag}</a></td>
                        <td>${stat.total_hits}</td>
                        <td>${stat.today_hits}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

      return new Response(overviewHtml, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    // Get or insert tag
    let tagInfo = await db.prepare(`SELECT id, last_cleanup_date FROM tags WHERE tag = ?`).bind(tag).first();
    if (!tagInfo) {
      await db.prepare(`INSERT INTO tags (tag, last_cleanup_date) VALUES (?, ?)`).bind(tag, today).run();
      tagInfo = { id: (await db.prepare(`SELECT id FROM tags WHERE tag = ?`).bind(tag).first())?.id, last_cleanup_date: today };
    }
    const tagId = tagInfo.id;

    // Check if cleanup is needed (once per day)
    if (tagInfo.last_cleanup_date !== today) {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date(utcPlus8Time - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      // Archive old data before cleanup
      await db.prepare(`
        INSERT OR IGNORE INTO history_stats (tag_id, date, count)
        SELECT tag_id, date(visit_time), COUNT(*)
        FROM visits 
        WHERE tag_id = ? AND date(visit_time) < date(?)
        GROUP BY tag_id, date(visit_time)
      `).bind(tagId, today).run();

      // Clean up old visit records (older than 30 days)
      await db.prepare(`
        DELETE FROM visits 
        WHERE tag_id = ? AND date(visit_time) < date(?)
      `).bind(tagId, thirtyDaysAgo).run();

      // Update last cleanup date
      await db.prepare(`
        UPDATE tags 
        SET last_cleanup_date = ? 
        WHERE id = ?
      `).bind(today, tagId).run();
    }

    // Insert new visit
    await db.prepare(`
      INSERT INTO visits (tag_id, visit_time) 
      VALUES (?, ?)
    `).bind(tagId, currentUTCPlus8Date).run();

    // Get statistics
    const historicalHits = (await db.prepare(`
      SELECT COALESCE(SUM(count), 0) as count 
      FROM history_stats 
      WHERE tag_id = ?
    `).bind(tagId).first())?.count || 0;

    const todayHits = (await db.prepare(`
      SELECT COUNT(*) as count 
      FROM visits 
      WHERE tag_id = ? AND date(visit_time) = ?
    `).bind(tagId, today).first())?.count || 0;

    const totalHits = historicalHits + todayHits;

    // Get daily statistics for the last 30 days
    const dailyStats = await db.prepare(`
      SELECT date(visit_time) as date, COUNT(*) as count 
      FROM visits 
      WHERE tag_id = ? AND date(visit_time) >= date(?, '-30 days')
      GROUP BY date(visit_time)
      ORDER BY date(visit_time)
    `).bind(tagId, today).all();

    if (isWeb) {
      // HTML template for web view
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>访问统计 - ${tag}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; max-width: 800px; margin: 0 auto; padding: 20px; }
        .stats-container { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        h1 { color: #333; }
        .stat-box { display: inline-block; padding: 15px; margin: 10px; background: white; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    </style>
</head>
<body>
    <h1>访问统计 - ${tag}</h1>
    <div class="stats-container">
        <div class="stat-box">
            <h3>总访问量</h3>
            <p>${totalHits}</p>
        </div>
        <div class="stat-box">
            <h3>今日访问量</h3>
            <p>${todayHits}</p>
        </div>
    </div>
    <div class="chart-container">
        <canvas id="visitsChart"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('visitsChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ${JSON.stringify(dailyStats.results.map(row => row.date))},
                datasets: [{
                    label: '每日访问量',
                    data: ${JSON.stringify(dailyStats.results.map(row => row.count))},
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    </script>
</body>
</html>`;

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=UTF-8',
          'Cache-Control': 'no-store',
        }
      });
    }

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