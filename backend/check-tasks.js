const db = require('./db');

async function checkDatabase() {
    try {
        console.log('Checking database...');
        
        // Check if users table has data
        const [users] = await db.query('SELECT * FROM users');
        console.log(`Found ${users.length} users:`, users.map(u => ({ id: u.id, username: u.username, role: u.role })));
        
        // Check if tasks table has data
        const [tasks] = await db.query('SELECT * FROM tasks');
        console.log(`Found ${tasks.length} tasks:`, tasks.map(t => ({ id: t.id, title: t.title, status: t.status })));
        
        // Check if tasks table exists and has correct structure
        const [columns] = await db.query('DESCRIBE tasks');
        console.log('Tasks table structure:', columns.map(c => ({ field: c.Field, type: c.Type })));
        
        // Check if users table exists and has correct structure
        const [userColumns] = await db.query('DESCRIBE users');
        console.log('Users table structure:', userColumns.map(c => ({ field: c.Field, type: c.Type })));
        
    } catch (error) {
        console.error('Database check failed:', error.message);
    }
}

checkDatabase();
