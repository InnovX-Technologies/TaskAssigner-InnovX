const mysql = require('mysql2');

// First, connect without specifying database to create it if needed
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Akmhiu@#0204'
});

console.log('Testing database connection...');

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err.message);
    process.exit(1);
  }
  
  console.log('Connected to MySQL server');
  
  // Create database if it doesn't exist
  connection.query('CREATE DATABASE IF NOT EXISTS task_assigner', (err) => {
    if (err) {
      console.error('Error creating database:', err.message);
      process.exit(1);
    }
    
    console.log('Database task_assigner created or already exists');
    
    // Use the database
    connection.query('USE task_assigner', (err) => {
      if (err) {
        console.error('Error using database:', err.message);
        process.exit(1);
      }
      
      console.log('Using database task_assigner');
      
      // Test a simple query
      connection.query('SELECT 1 as test', (err, results) => {
        if (err) {
          console.error('Error executing test query:', err.message);
        } else {
          console.log('Database connection test successful:', results[0]);
        }
        
        connection.end();
        console.log('Database connection test completed');
      });
    });
  });
}); 