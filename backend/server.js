const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Set JWT secret from environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Middleware to check JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  console.log('JWT_SECRET:', JWT_SECRET);
  console.log('Token:', token);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Middleware for admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Authentication endpoints (no auth required)
// Register endpoint
app.post('/auth/register', async (req, res) => {
  const { username, email, password, role } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }
  
  try {
    // Check if user already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, role || 'user']
    );
    
    res.status(201).json({ 
      message: 'User registered successfully',
      user: { id: result.insertId, username, email, role: role || 'user' }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login endpoint
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }
  
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Protected routes (require authentication)
app.use(authenticateToken);

// Get all users (all authenticated users)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create user (admin only)
app.post('/users', requireAdmin, async (req, res) => {
  const { username, email, password, role } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }
  
  try {
    // Check if user already exists
    const [existingUsers] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, role || 'user']
    );
    
    res.status(201).json({
      message: 'User created successfully',
      user: { id: result.insertId, username, email, role: role || 'user' }
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user (admin only)
app.put('/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { username, email, role } = req.body;
  
  try {
    await db.query(
      'UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?',
      [username, email, role, id]
    );
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete user (admin only)
app.delete('/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all tasks
app.get('/tasks', async (req, res) => {
  try {
    let query = `
      SELECT t.*, u.username as assignee_name 
      FROM tasks t 
      LEFT JOIN users u ON t.assignee_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    
    // Filtering
    if (req.query.status) {
      query += ' AND t.status = ?';
      params.push(req.query.status);
    }
    if (req.query.assignee_id) {
      query += ' AND t.assignee_id = ?';
      params.push(req.query.assignee_id);
    }
    if (req.query.priority) {
      query += ' AND t.priority = ?';
      params.push(req.query.priority);
    }
    if (req.query.due_date) {
      query += ' AND t.due_date = ?';
      params.push(req.query.due_date);
    }
    if (req.query.search) {
      query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }
    
    // Sorting
    query += ' ORDER BY t.created_at DESC';
    
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create task
app.post('/tasks', async (req, res) => {
  const { title, description, assignee_id, status, due_date, priority } = req.body;
  
  if (!title || !assignee_id) {
    return res.status(400).json({ message: 'Title and assignee are required' });
  }
  
  try {
    // Capitalize first letter of priority if provided, default to 'Medium'
    const normalizedPriority = priority ? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() : 'Medium';
    
    const [result] = await db.query(
      'INSERT INTO tasks (title, description, assignee_id, status, due_date, priority) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description, assignee_id, status || 'pending', due_date, normalizedPriority]
    );
    
    // Get the created task with assignee name
    const [taskRows] = await db.query(
      `SELECT t.*, u.username as assignee_name 
       FROM tasks t 
       LEFT JOIN users u ON t.assignee_id = u.id 
       WHERE t.id = ?`,
      [result.insertId]
    );
    
    // Create notification for assignee
    await db.query(
      'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
      [assignee_id, `You have been assigned a new task: ${title}`]
    );
    
    res.status(201).json({
      message: 'Task created successfully',
      task: taskRows[0]
    });
  } catch (err) {
    console.error('Create task error:', err.message, err.sqlMessage || '', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update task
app.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, assignee_id, status, due_date, priority } = req.body;
  
  try {
    // Capitalize first letter of priority if provided
    const normalizedPriority = priority ? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() : 'Medium';
    
    await db.query(
      'UPDATE tasks SET title = ?, description = ?, assignee_id = ?, status = ?, due_date = ?, priority = ? WHERE id = ?',
      [title, description, assignee_id, status, due_date, normalizedPriority, id]
    );
    
    // Get the updated task with assignee name
    const [taskRows] = await db.query(
      `SELECT t.*, u.username as assignee_name 
       FROM tasks t 
       LEFT JOIN users u ON t.assignee_id = u.id 
       WHERE t.id = ?`,
      [id]
    );
    
    // Create notification for assignee if changed
    if (assignee_id) {
      await db.query(
        'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
        [assignee_id, `A task has been assigned/updated: ${title}`]
      );
    }
    
    res.json({
      message: 'Task updated successfully',
      task: taskRows[0]
    });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete task
app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await db.query('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get comments for a task
app.get('/tasks/:id/comments', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [rows] = await db.query(
      'SELECT c.*, u.username FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.task_id = ? ORDER BY c.created_at DESC',
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add comment to task
app.post('/tasks/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).json({ message: 'Comment text is required' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO comments (task_id, user_id, comment) VALUES (?, ?, ?)',
      [id, req.user.id, text]
    );
    
    // Get the created comment with user info
    const [commentRows] = await db.query(
      'SELECT c.*, u.username FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?',
      [result.insertId]
    );
    
    res.status(201).json({
      message: 'Comment added successfully',
      comment: commentRows[0]
    });
  } catch (err) {
    console.error('Add comment error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete comment
app.delete('/comments/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await db.query('DELETE FROM comments WHERE id = ?', [id]);
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get notifications for current user
app.get('/notifications', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark notification as read
app.put('/notifications/:id/read', async (req, res) => {
  const { id } = req.params;
  
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark all notifications as read
app.put('/notifications/read-all', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk operations
// Bulk update task status
app.put('/tasks/bulk-status', async (req, res) => {
  const { taskIds, status } = req.body;
  
  if (!Array.isArray(taskIds) || taskIds.length === 0 || !status) {
    return res.status(400).json({ message: 'Task IDs array and status are required' });
  }
  
  try {
    await db.query(
      `UPDATE tasks SET status = ? WHERE id IN (${taskIds.map(() => '?').join(',')})`,
      [status, ...taskIds]
    );
    res.json({ message: 'Tasks updated successfully' });
  } catch (err) {
    console.error('Bulk update status error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Bulk delete tasks
app.delete('/tasks/bulk-delete', async (req, res) => {
  const { taskIds } = req.body;
  
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ message: 'Task IDs array is required' });
  }
  
  try {
    await db.query(
      `DELETE FROM tasks WHERE id IN (${taskIds.map(() => '?').join(',')})`,
      taskIds
    );
    res.json({ message: 'Tasks deleted successfully' });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
}); 