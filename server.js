const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const app = express();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database setup - using persistent file for Railway
const dbPath = path.join(dataDir, 'votes.db');
const db = new sqlite3.Database(dbPath);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_name TEXT NOT NULL,
    venue_name TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(voter_name, venue_name)
  )`);
});

// API Routes
app.get('/api/votes', (req, res) => {
  db.all(`SELECT venue_name, category, COUNT(*) as count, 
          GROUP_CONCAT(voter_name) as voters 
          FROM votes 
          GROUP BY venue_name, category`, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const voteData = {};
    rows.forEach(row => {
      voteData[row.venue_name] = {
        count: row.count,
        voters: row.voters ? row.voters.split(',') : [],
        category: row.category
      };
    });
    
    res.json(voteData);
  });
});

app.post('/api/vote', (req, res) => {
  const { voterName, venueName, category, isVoting } = req.body;
  
  if (!voterName || !venueName || !category) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  if (isVoting) {
    // Add vote
    db.run(`INSERT OR IGNORE INTO votes (voter_name, venue_name, category) VALUES (?, ?, ?)`,
      [voterName, venueName, category], function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, action: 'voted' });
      });
  } else {
    // Remove vote
    db.run(`DELETE FROM votes WHERE voter_name = ? AND venue_name = ?`,
      [voterName, venueName], function(err) {
        if (err) {
          console.error(err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, action: 'unvoted' });
      });
  }
});

app.get('/api/voters', (req, res) => {
  db.all(`SELECT DISTINCT voter_name FROM votes`, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows.map(row => row.voter_name));
  });
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bangkok Trip Planner running on port ${PORT}`);
  console.log(`🗳️ Database initialized at ${dbPath}`);
});
